import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { handleMessage, handleClose, getSessionCount } from './websocket/handler';
import { searchByHum, SearchResult } from './services/humSearchService';
import {
  createSession as createLiveSession,
  processChunk as processLiveChunk,
  stopSession as stopLiveSession,
  isLiveHumAvailable,
} from './services/humSearchLiveService';
import { createJob, setJobProcessing, setJobCompleted, setJobFailed, getJobStatus } from './services/jobQueue';
import { getSupabaseClient, isSupabaseConfigured, getSupabaseProjectRef, getSupabaseUrlPrefix } from './config/supabase';
import {
  submitTemplate,
  fetchTemplates,
  voteTemplate,
  incrementTemplateUsage,
  getStructureHash,
} from './services/templateService';
import {
  formatSong,
  isFormatSongEnabled,
  serializeSectionsToLyrics,
} from './services/formatSongService';

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

function getClientKey(req: Request): string {
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

// CORS configuration: allow comma-separated origins so both www and non-www work
const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:3000';
const corsOrigins = corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean);
// If single origin contains parleap.com, also allow the other variant (www vs non-www)
let allowedOrigins: string | string[] = corsOrigins.length > 1 ? corsOrigins : corsOrigins[0];
if (corsOrigins.length === 1 && corsOrigins[0].includes('parleap.com')) {
  const base = corsOrigins[0];
  const other = base.startsWith('https://www.') ? base.replace('https://www.', 'https://') : base.replace('https://', 'https://www.');
  if (other !== base) allowedOrigins = [base, other];
}
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
const corsLog = Array.isArray(allowedOrigins) ? allowedOrigins.join(', ') : allowedOrigins;
console.log('🌐 CORS allowed origins:', corsLog);

// Middleware
// Increase body size limit to 10MB for audio uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`[API] ${req.method} ${req.url} ${res.statusCode} - ${durationMs}ms`);
  });
  next();
});
app.use((req: Request, res: Response, next: NextFunction) => {
  const key = getClientKey(req);
  if (isHttpRateLimited(key)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }
  next();
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
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
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: getSessionCount(),
    supabaseConfigured: isSupabaseConfigured(),
    supabaseUrlPrefix: getSupabaseUrlPrefix(),
    supabaseProjectRef: getSupabaseProjectRef(),
  });
});

// Debug: show raw event_items for an event (temporary diagnostic)
app.get('/api/debug/event-items/:eventId', async (req: Request, res: Response) => {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
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

// Community template endpoints (structure-only)
app.post('/api/templates', async (req: Request, res: Response) => {
  const { ccliNumber, lineCount, sections = [], slides = [], linesPerSlide, sourceVersion, userId } = req.body || {};
  if (!ccliNumber || !lineCount || !Array.isArray(slides)) {
    res.status(400).json({ error: 'ccliNumber, lineCount, slides are required' });
    return;
  }
  const result = await submitTemplate(
    {
      ccliNumber,
      lineCount,
      linesPerSlide,
      sections,
      slides,
      sourceVersion,
    },
    userId
  );
  if (result.limitReached) {
    res.status(200).json({ success: false, error: result.error, limitReached: true });
    return;
  }
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true, id: result.id, structureHash: result.id ? getStructureHash({ ccliNumber, lineCount, linesPerSlide, sections, slides, sourceVersion }) : null });
});

app.get('/api/templates', async (req: Request, res: Response) => {
  const ccli = req.query.ccli as string | undefined;
  const lineCount = req.query.lineCount ? Number(req.query.lineCount) : undefined;
  if (!ccli) {
    res.status(400).json({ error: 'ccli query param required' });
    return;
  }
  const templates = await fetchTemplates(ccli, lineCount);
  res.json({ templates });
});

app.post('/api/templates/:id/vote', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, vote } = req.body || {};
  if (!id || !vote) {
    res.status(400).json({ error: 'template id and vote required' });
    return;
  }
  const numericVote = Number(vote) === -1 ? -1 : 1;
  const result = await voteTemplate(id, userId ?? null, numericVote as 1 | -1);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

app.post('/api/templates/:id/usage', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'template id required' });
    return;
  }
  await incrementTemplateUsage(id);
  res.json({ success: true });
});

// Smart Paste / Auto-Format: extract and structure lyrics from raw text (OpenAI gpt-4o-mini)
app.post('/api/format-song', async (req: Request, res: Response) => {
  try {
    if (!isFormatSongEnabled()) {
      res.status(503).json({ error: 'Auto-format is not configured. Set OPENAI_API_KEY on the backend.' });
      return;
    }
    const { rawText } = req.body ?? {};
    if (typeof rawText !== 'string' || !rawText.trim()) {
      res.status(400).json({ error: 'rawText is required and must be a non-empty string' });
      return;
    }
    const result = await formatSong(rawText);
    if (!result) {
      res.status(500).json({ error: 'Failed to format song' });
      return;
    }
    const lyrics = serializeSectionsToLyrics(result.sections);
    res.json({
      title: result.title,
      artist: result.artist,
      sections: result.sections,
      lyrics,
    });
  } catch (err) {
    console.error('[FormatSong] Route error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Auto-format failed',
    });
  }
});

// Hum-to-Search endpoint
// Accepts audio as base64 WAV in JSON body
app.post('/api/hum-search', async (req: Request, res: Response) => {
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

// Job status endpoint - always return 200 with status in body so client can show real errors
app.get('/api/hum-search/:jobId', (req: Request, res: Response) => {
  try {
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
      res.json({
        success: false,
        status: 'failed',
        error: job.error || 'Search failed',
      });
    } else {
      res.json({
        success: true,
        status: job.status,
        message: job.status === 'processing' ? 'Still processing...' : 'Pending...',
      });
    }
  } catch (err) {
    console.error('[HumSearch] Job status error:', err);
    res.status(500).json({
      success: false,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// Live hum-to-search (YouTube-style: stream chunks, match on the go). Requires EMBEDDING_SERVICE_URL.
app.get('/api/hum-search/live/available', (_req: Request, res: Response) => {
  res.json({ available: isLiveHumAvailable() });
});

app.post('/api/hum-search/live/start', (_req: Request, res: Response) => {
  if (!isLiveHumAvailable()) {
    res.status(503).json({
      error: 'Live hum search requires the embedding service. Set EMBEDDING_SERVICE_URL on the backend.',
    });
    return;
  }
  const sessionId = createLiveSession();
  res.json({ success: true, sessionId });
});

app.post('/api/hum-search/live/chunk', async (req: Request, res: Response) => {
  if (!isLiveHumAvailable()) {
    res.status(503).json({
      error: 'Live hum search requires the embedding service.',
    });
    return;
  }
  try {
    const { sessionId, audio } = req.body;
    if (!sessionId || !audio) {
      res.status(400).json({ error: 'Missing sessionId or audio' });
      return;
    }
    const result = await processLiveChunk(sessionId, audio);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Processing failed';
    if (msg.includes('Session not found')) {
      res.status(404).json({ error: msg });
      return;
    }
    console.error('[HumSearchLive] Chunk error:', err);
    res.status(500).json({ error: msg });
  }
});

app.post('/api/hum-search/live/stop', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (sessionId) stopLiveSession(sessionId);
  res.json({ success: true });
});

app.use((err: Error, _req: Request, res: Response) => {
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
