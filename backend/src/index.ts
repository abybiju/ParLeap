import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { handleMessage, handleClose, getSessionCount } from './websocket/handler';
import { searchByHum, SearchResult } from './services/humSearchService';
import { createJob, setJobProcessing, setJobCompleted, setJobFailed, getJobStatus } from './services/jobQueue';
import { supabase, isSupabaseConfigured, getSupabaseProjectRef, getSupabaseUrlPrefix } from './config/supabase';

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
// Increase body size limit to 10MB for audio uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
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
    supabaseConfigured: isSupabaseConfigured,
    supabaseUrlPrefix: getSupabaseUrlPrefix(),
    supabaseProjectRef: getSupabaseProjectRef(),
  });
});

// Debug: show raw event_items for an event (temporary diagnostic)
app.get('/api/debug/event-items/:eventId', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    res.json({ error: 'Supabase not configured' });
    return;
  }
  const { eventId } = req.params;
  const { data, error } = await supabase
    .from('event_items')
    .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title')
    .eq('event_id', eventId)
    .order('sequence_order', { ascending: true });
  res.json({ eventId, itemCount: data?.length ?? 0, items: data, error });
});

// Hum-to-Search endpoint
// Accepts audio as base64 WAV in JSON body
app.post('/api/hum-search', async (req, res) => {
  const startTime = Date.now();
  try {
    const { audio, limit = 5, threshold = 0.5 } = req.body;

    if (!audio) {
      console.log('[HumSearch] Missing audio data');
      res.status(400).json({ error: 'Missing audio data' });
      return;
    }

    // Decode base64 audio to buffer
    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(audio, 'base64');
    } catch (err) {
      console.error('[HumSearch] Failed to decode base64:', err);
      res.status(400).json({ error: 'Invalid base64 audio data' });
      return;
    }

    console.log(`[HumSearch] Received ${audioBuffer.length} bytes of audio`);

    // Validate WAV format - check for RIFF header
    if (audioBuffer.length < 12) {
      console.error('[HumSearch] Audio buffer too small:', audioBuffer.length);
      res.status(400).json({ error: 'Invalid audio format - file too small' });
      return;
    }

    const header = audioBuffer.slice(0, 4).toString('ascii');
    const format = audioBuffer.slice(8, 12).toString('ascii');
    
    if (header !== 'RIFF' || format !== 'WAVE') {
      console.error(`[HumSearch] Invalid audio format - header: ${header}, format: ${format}`);
      console.log(`[HumSearch] First 12 bytes:`, Array.from(audioBuffer.slice(0, 12)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
      res.status(400).json({ error: 'Invalid audio format - expected WAV (RIFF/WAVE)' });
      return;
    }

    console.log('[HumSearch] Audio format validated as WAV');

    // Create async job and return immediately
    const jobId = createJob();
    console.log(`[HumSearch] Created job ${jobId}, processing in background...`);

    // Return job ID immediately
    res.json({
      success: true,
      jobId,
      status: 'processing',
      message: 'Processing audio...',
    });

    // Process in background (don't await)
    (async () => {
      try {
        setJobProcessing(jobId);
        const results = await searchByHum(audioBuffer, limit, threshold);
        const duration = Date.now() - startTime;
        console.log(`[HumSearch] Job ${jobId} completed in ${duration}ms, found ${results.length} results`);
        setJobCompleted(jobId, results);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[HumSearch] Job ${jobId} failed after ${duration}ms:`, error);
        setJobFailed(jobId, error instanceof Error ? error.message : 'Search failed');
      }
    })();
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[HumSearch] Error after ${duration}ms:`, error);
    
    // Log stack trace for debugging
    if (error instanceof Error) {
      console.error('[HumSearch] Error stack:', error.stack);
    }
    
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Search failed',
    });
  }
});

// Job status endpoint
app.get('/api/hum-search/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = getJobStatus(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.status === 'completed') {
    const results = job.result as SearchResult[] | undefined;
    res.json({
      success: true,
      status: 'completed',
      results: results || [],
      count: results?.length || 0,
    });
  } else if (job.status === 'failed') {
    res.status(500).json({
      success: false,
      status: 'failed',
      error: job.error,
    });
  } else {
    res.json({
      success: true,
      status: job.status,
      message: job.status === 'processing' ? 'Still processing...' : 'Pending...',
    });
  }
});

app.use((err: Error, _req: express.Request, res: express.Response) => {
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

