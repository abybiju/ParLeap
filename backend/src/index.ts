import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { handleMessage, handleClose, getSessionCount } from './websocket/handler';

const app = express();
const PORT = process.env.PORT || 3001;

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const HTTP_RATE_WINDOW_MS = numberEnv(process.env.HTTP_RATE_LIMIT_WINDOW_MS, 60000);
const HTTP_RATE_LIMIT = numberEnv(process.env.HTTP_RATE_LIMIT_MAX, 120);

interface RateLimitState {
  windowStart: number;
  count: number;
}

const httpRateLimits = new Map<string, RateLimitState>();

function getClientKey(req: express.Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] || 'unknown';
  }
  return req.socket.remoteAddress || 'unknown';
}

function isHttpRateLimited(key: string): boolean {
  const now = Date.now();
  const state = httpRateLimits.get(key) ?? { windowStart: now, count: 0 };
  if (now - state.windowStart > HTTP_RATE_WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  state.count += 1;
  httpRateLimits.set(key, state);
  return state.count > HTTP_RATE_LIMIT;
}

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`[API] ${req.method} ${req.url} ${res.statusCode} - ${durationMs}ms`);
  });
  next();
});
app.use((req, res, next) => {
  const key = getClientKey(req);
  if (isHttpRateLimited(key)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'ParLeap Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      websocket: 'wss://[domain]/',
    },
    protocol: {
      clientMessages: ['START_SESSION', 'AUDIO_DATA', 'MANUAL_OVERRIDE', 'STOP_SESSION', 'PING'],
      serverMessages: [
        'SESSION_STARTED',
        'TRANSCRIPT_UPDATE',
        'DISPLAY_UPDATE',
        'SONG_CHANGED',
        'SESSION_ENDED',
        'ERROR',
        'PONG',
      ],
    },
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: getSessionCount(),
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[API] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[API] Uncaught exception:', error);
});

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log(`[WS] New connection (total: ${wss.clients.size})`);

  ws.on('message', async (data) => {
    const message = data.toString();
    await handleMessage(ws, message);
  });

  ws.on('close', () => {
    handleClose(ws);
    console.log(`[WS] Connection closed (remaining: ${wss.clients.size})`);
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });
});

