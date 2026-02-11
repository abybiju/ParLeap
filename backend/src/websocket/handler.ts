/**
 * WebSocket Message Handler
 * 
 * Processes incoming WebSocket messages and manages session state
 */

import type { WebSocket } from 'ws';
import { compareTwoStrings } from 'string-similarity';
import {
  type ClientMessage,
  type ServerMessage,
  type SessionStartedMessage,
  type EventSettingsUpdatedMessage,
  type TranscriptUpdateMessage,
  type DisplayUpdateMessage,
  type SongChangedMessage,
  type ErrorMessage,
  type PongMessage,
  type TimingMetadata,
  isStartSessionMessage,
  isUpdateEventSettingsMessage,
  isAudioDataMessage,
  isManualOverrideMessage,
  isStopSessionMessage,
  isPingMessage,
  isSttWindowRequestMessage,
} from '../types/websocket';
import { validateClientMessage } from '../types/schemas';
import { fetchEventData, type SongData, type SetlistItemData } from '../services/eventService';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  type BibleReference,
  detectBibleVersionCommand,
  fetchBibleVerse,
  findBibleReference,
  getBibleVersionIdByAbbrev,
  getDefaultBibleVersionId,
  wrapBibleText,
} from '../services/bibleService';
import { transcribeAudioChunk, createStreamingRecognition, sttProvider, isElevenLabsConfigured } from '../services/sttService';
import {
  findBestMatchAcrossAllSongs,
  createSongContext,
  validateConfig,
  type MatcherConfig,
  type SongContext,
  type MultiSongMatchResult,
} from '../services/matcherService';

// ============================================
// Timing Utilities
// ============================================

/**
 * Create timing metadata for a response
 */
function createTiming(receivedAt: number, processingStartAt: number): TimingMetadata {
  const now = Date.now();
  return {
    serverReceivedAt: receivedAt,
    serverSentAt: now,
    processingTimeMs: now - processingStartAt,
  };
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MATCH_STALE_MS = parseNumberEnv(process.env.MATCHER_STALE_MS, 12000);
const MATCH_RECOVERY_WINDOW_MS = parseNumberEnv(process.env.MATCHER_RECOVERY_WINDOW_MS, 10000);
const MATCH_RECOVERY_COOLDOWN_MS = parseNumberEnv(process.env.MATCHER_RECOVERY_COOLDOWN_MS, 15000);
const BIBLE_FOLLOW_MIN_WORDS = parseNumberEnv(process.env.BIBLE_FOLLOW_MIN_WORDS, 4);
const BIBLE_FOLLOW_MATCH_THRESHOLD = parseNumberEnv(process.env.BIBLE_FOLLOW_MATCH_THRESHOLD, 0.55);
const BIBLE_FOLLOW_MATCH_MARGIN = parseNumberEnv(process.env.BIBLE_FOLLOW_MATCH_MARGIN, 0.05);
const BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS = parseNumberEnv(process.env.BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS, 1800);
const BIBLE_FOLLOW_DEBOUNCE_MATCHES = parseNumberEnv(process.env.BIBLE_FOLLOW_DEBOUNCE_MATCHES, 2);

/** Smart Bible Listen: when true, for BIBLE setlist items we wait for STT_WINDOW_REQUEST before starting ElevenLabs. Kill switch: set to false to restore always-on STT. */
const BIBLE_SMART_LISTEN_ENABLED = process.env.BIBLE_SMART_LISTEN_ENABLED === 'true';
/** STT window duration (ms) after wake word. Default 30s. */
const BIBLE_SMART_LISTEN_WINDOW_MS = parseNumberEnv(process.env.BIBLE_SMART_LISTEN_WINDOW_MS, 30000);

function preprocessBufferText(text: string, maxWords = 12): string {
  const fillers = new Set(['uh', 'um', 'oh', 'ah', 'uhh', 'umm', 'hmm']);
  const words = text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .filter((w) => !fillers.has(w));

  const deduped: string[] = [];
  for (const w of words) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== w) {
      deduped.push(w);
    }
  }

  const sliced = deduped.slice(-maxWords);
  return sliced.join(' ');
}

function normalizeMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMatchScore(buffer: string, verseText: string): number {
  const normalizedBuffer = normalizeMatchText(buffer);
  const normalizedVerse = normalizeMatchText(verseText);
  if (!normalizedBuffer || !normalizedVerse) {
    return 0;
  }
  const bufferWords = normalizedBuffer.split(/\s+/).filter(Boolean);
  const verseWords = normalizedVerse.split(/\s+/).filter(Boolean);
  if (verseWords.length <= bufferWords.length) {
    return compareTwoStrings(normalizedBuffer, normalizedVerse);
  }

  const windowSize = Math.max(1, bufferWords.length);
  let bestScore = 0;
  for (let i = 0; i <= verseWords.length - windowSize; i += 1) {
    const windowText = verseWords.slice(i, i + windowSize).join(' ');
    const score = compareTwoStrings(normalizedBuffer, windowText);
    if (score > bestScore) {
      bestScore = score;
    }
  }
  return bestScore;
}

function buildBibleRefKey(reference: BibleReference, versionId: string | null | undefined): string {
  return `${versionId ?? 'unknown'}:${reference.book}:${reference.chapter}:${reference.verse}`;
}

// ============================================
// WebSocket Rate Limiting
// ============================================

interface WsRateState {
  windowStart: number;
  count: number;
  audioWindowStart: number;
  audioCount: number;
}

const WS_RATE_WINDOW_MS = parseNumberEnv(process.env.WS_RATE_LIMIT_WINDOW_MS, 10000);
const WS_CONTROL_LIMIT = parseNumberEnv(process.env.WS_RATE_LIMIT_CONTROL, 30);
const WS_AUDIO_LIMIT = parseNumberEnv(process.env.WS_RATE_LIMIT_AUDIO, 120);
const wsRateLimits = new Map<WebSocket, WsRateState>();

function isRateLimited(ws: WebSocket, messageType: string): boolean {
  const now = Date.now();
  const state = wsRateLimits.get(ws) ?? {
    windowStart: now,
    count: 0,
    audioWindowStart: now,
    audioCount: 0,
  };

  if (messageType === 'AUDIO_DATA') {
    if (now - state.audioWindowStart > WS_RATE_WINDOW_MS) {
      state.audioWindowStart = now;
      state.audioCount = 0;
    }
    state.audioCount += 1;
    wsRateLimits.set(ws, state);
    return state.audioCount > WS_AUDIO_LIMIT;
  }

  if (now - state.windowStart > WS_RATE_WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  state.count += 1;
  wsRateLimits.set(ws, state);
  return state.count > WS_CONTROL_LIMIT;
}

// ============================================
// Session State
// ============================================

interface SessionState {
  sessionId: string;
  eventId: string;
  eventName: string;
  projectorFont?: string | null;
  bibleMode?: boolean;
  bibleVersionId?: string | null;
  bibleFollow?: boolean;
  bibleFollowRef?: BibleReference | null;
  bibleFollowHit?: {
    targetKey: string;
    hitCount: number;
    lastHitAt: number;
  };
  bibleFollowCache?: Map<string, { text: string; book: string; chapter: number; verse: number; versionAbbrev: string }>;
  songs: SongData[];
  setlistItems?: SetlistItemData[]; // Polymorphic setlist items
  currentSongIndex: number;
  currentItemIndex?: number; // Index in polymorphic setlist (not just songs)
  currentSlideIndex: number; // Slide index (for display)
  currentLineIndex: number; // Line index (for matching) - tracks which line we're matching against
  rollingBuffer: string;
  isActive: boolean;
  isAutoFollowing: boolean; // Can be disabled by operator for manual control
  // Matcher state
  songContext?: SongContext;
  matcherConfig: MatcherConfig;
  lastMatchConfidence?: number;
  sttStream?: ReturnType<typeof createStreamingRecognition>;
  lastTranscriptText?: string;
  lastTranscriptAt?: number;
  lastAudioChunkAt?: number;
  lastSttRestartAt?: number;
  lastBibleRefKey?: string;
  lastBibleRefAt?: number;
  allowBackwardUntil?: number;
  lastStrongMatchAt?: number;
  lastRecoveryAt?: number;
  // Debouncing for song switches (prevents false positives)
  suggestedSongSwitch?: {
    songId: string;
    songIndex: number;
    confidence: number;
    firstDetectedAt: number; // Timestamp when first detected
    matchCount: number; // How many consecutive times we've seen this match
  };
  lastSongSwitchAt?: number; // Timestamp of last song switch (for cooldown)
  // End-trigger debouncing for slide advance
  endTriggerHit?: {
    lineIndex: number;
    lastHitAt: number;
    hitCount: number;
  };
  // Audio chunk tracking for logging
  audioChunkCount?: number; // Track number of audio chunks received (for diagnostic logging)
  // Smart Bible Listen: STT window active until this timestamp (only when BIBLE_SMART_LISTEN_ENABLED and current item is BIBLE)
  sttWindowActiveUntil?: number;
  /** Client opted in to Smart Listen; gate only applies when true. Default false so we never drop audio unless client enables it. */
  smartListenEnabled?: boolean;
}


// Map of WebSocket connections to their session state
const sessions = new Map<WebSocket, SessionState>();

// ============================================
// Message Sending Helpers
// ============================================

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, code: string, message: string, details?: unknown): void {
  const errorMessage: ErrorMessage = {
    type: 'ERROR',
    payload: { code, message, details },
  };
  send(ws, errorMessage);
}

/**
 * True when the current setlist item is BIBLE (used for Smart Listen gate).
 */
function currentItemIsBible(session: SessionState): boolean {
  const items = session.setlistItems;
  const idx = session.currentItemIndex ?? 0;
  if (!items || idx < 0 || idx >= items.length) return false;
  return items[idx].type === 'BIBLE';
}

/**
 * Smart Listen gate: when true, we do not start ElevenLabs on first audio for BIBLE items; we wait for STT_WINDOW_REQUEST.
 * Only active when (1) backend env BIBLE_SMART_LISTEN_ENABLED, (2) client sent smartListenEnabled: true in START_SESSION, (3) current item is BIBLE.
 */
function shouldUseSmartListenGate(session: SessionState): boolean {
  return BIBLE_SMART_LISTEN_ENABLED === true && session.smartListenEnabled === true && currentItemIsBible(session);
}

/**
 * Broadcast a message to all WebSocket clients connected to the same eventId
 */
function broadcastToEvent(eventId: string, message: ServerMessage): void {
  let sentCount = 0;
  for (const [ws, session] of sessions.entries()) {
    if (session.eventId === eventId && session.isActive && ws.readyState === ws.OPEN) {
      send(ws, message);
      sentCount++;
    }
  }
  if (sentCount > 0) {
    console.log(`[WS] Broadcasted ${message.type} to ${sentCount} client(s) for event ${eventId}`);
  }
}

async function getBibleVerseCached(
  session: SessionState,
  reference: BibleReference,
  versionId: string | null | undefined
) {
  if (!versionId) return null;
  const cacheKey = buildBibleRefKey(reference, versionId);
  if (!session.bibleFollowCache) {
    session.bibleFollowCache = new Map();
  }
  const cached = session.bibleFollowCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const verse = await fetchBibleVerse(reference, versionId);
  if (verse) {
    session.bibleFollowCache.set(cacheKey, verse);
  }
  return verse;
}

// ============================================
// STT Stream Helpers
// ============================================

function initElevenLabsStream(session: SessionState, ws: WebSocket): void {
  const stream = createStreamingRecognition();
  stream.on('data', (result: { text: string; isFinal: boolean; confidence: number }) => {
    const processingStart = Date.now();
    const receivedAtNow = Date.now();
    void handleTranscriptionResult(ws, session, result, receivedAtNow, processingStart).catch((error) => {
      console.error('[WS] Error handling transcription result:', error);
    });
  });
  stream.on('error', (error: Error) => {
    console.error('[STT] ❌ ElevenLabs stream error:', error);
    sendError(ws, 'STT_ERROR', 'ElevenLabs stream error', { message: error.message });
  });
  stream.on('end', () => {
    console.log('[STT] ElevenLabs stream ended');
    // Clear stream reference so it can be recreated if needed
    session.sttStream = undefined;
  });
  session.sttStream = stream;
  console.log('[STT] ✅ ElevenLabs stream initialized');
}

function restartElevenLabsStream(session: SessionState, ws: WebSocket, reason: string): void {
  if (session.sttStream) {
    try {
      session.sttStream.end();
    } catch (error) {
      console.warn('[STT] ⚠️ Failed to end ElevenLabs stream cleanly:', error);
    }
  }
  session.sttStream = undefined;
  session.lastSttRestartAt = Date.now();
  console.warn(`[STT] 🔄 Restarting ElevenLabs stream (${reason})`);
  initElevenLabsStream(session, ws);
}

// ============================================
// Message Handlers
// ============================================

/**
 * Handle START_SESSION message
 * Initializes session state and loads event data from Supabase
 */
async function handleStartSession(
  ws: WebSocket,
  payload: { eventId: string; smartListenEnabled?: boolean },
  receivedAt: number
): Promise<void> {
  const eventId = payload.eventId;
  const smartListenEnabled = payload.smartListenEnabled === true;
  const processingStart = Date.now();
  console.log(`[WS] Starting session for event: ${eventId}, smartListenEnabled: ${smartListenEnabled}`);

  // Check if session already exists for this WebSocket
  if (sessions.has(ws)) {
    sendError(ws, 'SESSION_EXISTS', 'A session is already active for this connection');
    return;
  }

  // Check if there's already an active session for this eventId (from another client)
  // If so, sync the new client to the current state
  // IMPORTANT: Only consider sessions with OPEN WebSocket connections (not stale)
  let existingSession: SessionState | null = null;
  let existingSessionWithSTT: SessionState | null = null;
  for (const [existingWs, existing] of sessions.entries()) {
    // Only consider truly active sessions (WebSocket must be OPEN)
    if (existing.eventId === eventId && existing.isActive && existingWs.readyState === ws.OPEN) {
      existingSession = existing;
      // Track if any existing session has an STT stream
      if (existing.sttStream) {
        existingSessionWithSTT = existing;
        console.log(`[WS] Found existing session with STT stream for event ${eventId}`);
      } else {
        console.log(`[WS] Found existing session WITHOUT STT stream for event ${eventId} (likely projector view)`);
      }
      console.log(`[WS] Syncing new client to current state (song ${existing.currentSongIndex}, slide ${existing.currentSlideIndex})`);
      break;
    }
  }

  // Fetch real event data from Supabase
  const eventData = await fetchEventData(eventId);
  
  if (!eventData) {
    console.error(`[WS] Failed to fetch event data for ${eventId}`);
    sendError(ws, 'EVENT_NOT_FOUND', `Event ${eventId} not found or no setlist configured`, { eventId });
    return;
  }

  console.log(`[WS] Fetched event "${eventData.name}" with ${eventData.songs.length} songs`);

  if (eventData.songs.length === 0) {
    console.warn(`[WS] Event ${eventId} has no songs in setlist`);
    sendError(ws, 'EMPTY_SETLIST', 'Event has no songs in setlist. Please add songs to the event before starting a session.', { eventId });
    return;
  }

  const sessionId = `session_${Date.now()}`;
  
  // Initialize matcher configuration
  // Lower threshold for better matching (0.6 = 60% similarity required)
  const matcherConfig: MatcherConfig = validateConfig({
    similarityThreshold: parseNumberEnv(process.env.MATCHER_SIMILARITY_THRESHOLD, 0.6),
    minBufferLength: parseNumberEnv(process.env.MATCHER_MIN_BUFFER_LENGTH, 2), // Lower from 3 to 2 words
    bufferWindow: parseNumberEnv(process.env.MATCHER_BUFFER_WINDOW, 100),
    debug: process.env.DEBUG_MATCHER === 'true' || process.env.NODE_ENV !== 'production', // Enable debug in dev
  });

  // If there's an existing session, sync to its current state
  // Otherwise, start from the beginning
  const currentItemIndex = existingSession?.currentItemIndex ?? 0;
  const currentSongIndex = existingSession?.currentSongIndex ?? 0;
  const currentSlideIndex = existingSession?.currentSlideIndex ?? 0;
  
  // Find current item in polymorphic setlist
  const setlistItems = eventData.setlistItems || [];
  const currentSetlistItem = setlistItems[currentItemIndex];
  
  // Find current song (only if current item is a SONG type)
  // For backward compatibility: if no setlistItems, use songs array directly
  let actualSongIndex = currentSongIndex;
  
  if (setlistItems.length > 0 && currentSetlistItem) {
    // Find the song index based on setlist item
    if (currentSetlistItem.type === 'SONG' && currentSetlistItem.songId) {
      actualSongIndex = eventData.songs.findIndex((s) => s.id === currentSetlistItem.songId);
      if (actualSongIndex === -1) actualSongIndex = 0;
    } else {
      // Current item is BIBLE or MEDIA - find next SONG item
      const nextSongItem = setlistItems.slice(currentItemIndex).find((item) => item.type === 'SONG');
      if (nextSongItem?.songId) {
        actualSongIndex = eventData.songs.findIndex((s) => s.id === nextSongItem.songId);
        if (actualSongIndex === -1) actualSongIndex = 0;
      } else {
        actualSongIndex = 0;
      }
    }
  }
  
  const currentSong = eventData.songs[actualSongIndex] || eventData.songs[0];
  
  // Determine current line index from slide index (for matching)
  // If slides exist, find the first line of the current slide
  let currentLineIndex = currentSlideIndex;
  if (currentSong && currentSong.slides && currentSong.slides.length > 0 && currentSlideIndex < currentSong.slides.length) {
    currentLineIndex = currentSong.slides[currentSlideIndex].startLineIndex;
  } else if (currentSong && currentSong.lineToSlideIndex && currentSong.lineToSlideIndex.length > 0) {
    // Fallback: find first line that maps to this slide
    currentLineIndex = currentSong.lineToSlideIndex.findIndex(slideIdx => slideIdx === currentSlideIndex);
    if (currentLineIndex === -1) currentLineIndex = 0;
  }
  
  const songContext = currentSong ? createSongContext(
    { id: currentSong.id, sequence_order: actualSongIndex + 1 },
    currentSong,
    currentLineIndex // Use line index for matching
  ) : undefined;
  
  const session: SessionState = {
    sessionId,
    eventId,
    eventName: eventData.name,
    projectorFont: existingSession?.projectorFont ?? eventData.projectorFont ?? null,
    bibleMode: existingSession?.bibleMode ?? eventData.bibleMode ?? false,
    bibleVersionId: existingSession?.bibleVersionId ?? eventData.bibleVersionId ?? null,
    bibleFollow: existingSession?.bibleFollow ?? false,
    bibleFollowRef: existingSession?.bibleFollowRef ?? null,
    bibleFollowHit: undefined,
    bibleFollowCache: existingSession?.bibleFollowCache ?? undefined,
    songs: eventData.songs,
    setlistItems: eventData.setlistItems, // Include polymorphic setlist items
    currentSongIndex: actualSongIndex,
    currentItemIndex, // Track position in polymorphic setlist
    currentSlideIndex,
    currentLineIndex, // Track line index separately for matching
    rollingBuffer: existingSession?.rollingBuffer || '',
    isActive: true,
    isAutoFollowing: true, // Auto-follow enabled by default
    songContext,
    matcherConfig,
    lastMatchConfidence: existingSession?.lastMatchConfidence || 0,
    lastStrongMatchAt: existingSession?.lastStrongMatchAt ?? Date.now(),
    lastRecoveryAt: existingSession?.lastRecoveryAt ?? 0,
    suggestedSongSwitch: undefined,
    lastSongSwitchAt: undefined,
    smartListenEnabled,
  };

  // For ElevenLabs: Use lazy initialization - create stream only when first audio arrives
  // This prevents connection timeout if audio capture hasn't started yet
  // For other providers or if existing session has STT, share it
  if (existingSessionWithSTT && existingSessionWithSTT.sttStream) {
    // Share existing STT stream with new session (operator reconnected or projector connecting after operator)
    console.log('[STT] 📡 Reusing existing STT stream from another session');
    session.sttStream = existingSessionWithSTT.sttStream;
  } else if (sttProvider === 'elevenlabs' && !isElevenLabsConfigured) {
    // Log warning if ElevenLabs is selected but not configured
    console.warn('[STT] ⚠️  ElevenLabs selected but ELEVENLABS_API_KEY not configured - STT will not work');
  }
  // Note: ElevenLabs stream will be created lazily in handleAudioData when first audio chunk arrives

  sessions.set(ws, session);

  // Send session started confirmation with full setlist for caching
  const setlistPayload = session.songs.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    lines: song.lines, // For backward compatibility and matching
    slides: song.slides?.map(slide => ({
      lines: slide.lines,
      slideText: slide.slideText,
    })),
    lineToSlideIndex: song.lineToSlideIndex,
  }));

  console.log(`[WS] Sending SESSION_STARTED with ${setlistPayload.length} songs in setlist and ${session.setlistItems?.length ?? 0} setlist items`);
  if (session.setlistItems && session.setlistItems.length > 0) {
    console.log('[WS] setlistItems payload:', JSON.stringify(session.setlistItems.slice(0, 5)));
  } else {
    console.log('[WS] setlistItems is undefined or empty');
  }

  const response: SessionStartedMessage = {
    type: 'SESSION_STARTED',
    payload: {
      sessionId,
      eventId,
      eventName: session.eventName,
      projectorFont: session.projectorFont ?? null,
      bibleMode: session.bibleMode ?? false,
      bibleVersionId: session.bibleVersionId ?? null,
      bibleFollow: session.bibleFollow ?? false,
      totalSongs: session.songs.length,
      currentSongIndex,
      currentItemIndex: session.currentItemIndex,
      currentSlideIndex,
      setlist: setlistPayload,
      setlistItems: session.setlistItems, // Include polymorphic setlist items
    },
    timing: createTiming(receivedAt, processingStart),
  };

  send(ws, response);

  // Log STT configuration for debugging
  console.log(`[WS] STT Provider: ${sttProvider}, Configured: ${sttProvider === 'elevenlabs' ? isElevenLabsConfigured : 'N/A'}`);
  if (sttProvider === 'elevenlabs' && !isElevenLabsConfigured) {
    console.warn('[WS] ⚠️  ElevenLabs selected but ELEVENLABS_API_KEY not set in backend/.env');
  }

  // Send current display update (synced to existing session if available)
  if (currentSong && currentSong.slides && currentSong.slides.length > 0 && currentSlideIndex < currentSong.slides.length) {
    const currentSlide = currentSong.slides[currentSlideIndex];
    console.log(`[WS] Sending slide ${currentSlideIndex}: ${currentSlide.lines.length} lines - "${currentSlide.slideText.substring(0, 50)}..."`);
    const displayUpdate: DisplayUpdateMessage = {
      type: 'DISPLAY_UPDATE',
      payload: {
        lineText: currentSlide.lines[0] || '', // Backward compatibility
        slideText: currentSlide.slideText,
        slideLines: currentSlide.lines,
        slideIndex: currentSlideIndex,
        lineIndex: currentLineIndex,
        songId: currentSong.id,
        songTitle: currentSong.title,
        isAutoAdvance: false,
      },
      timing: createTiming(receivedAt, processingStart),
    };
    send(ws, displayUpdate);
  } else if (currentSong && currentSong.lines.length > 0 && currentLineIndex < currentSong.lines.length) {
    // Fallback for songs without slides (backward compatibility)
    const displayUpdate: DisplayUpdateMessage = {
      type: 'DISPLAY_UPDATE',
      payload: {
        lineText: currentSong.lines[currentLineIndex],
        slideText: currentSong.lines[currentLineIndex],
        slideLines: [currentSong.lines[currentLineIndex]],
        slideIndex: currentSlideIndex,
        lineIndex: currentLineIndex,
        songId: currentSong.id,
        songTitle: currentSong.title,
        isAutoAdvance: false,
      },
      timing: createTiming(receivedAt, processingStart),
    };
    send(ws, displayUpdate);
  }

  console.log(`[WS] Session started: ${sessionId} with ${session.songs.length} songs (synced to song ${currentSongIndex}, slide ${currentSlideIndex})`);
}

/**
 * Handle UPDATE_EVENT_SETTINGS message
 * Broadcasts updated settings to all clients
 */
function handleUpdateEventSettings(
  ws: WebSocket,
  settings: { projectorFont?: string; bibleMode?: boolean; bibleVersionId?: string | null; bibleFollow?: boolean },
  receivedAt: number
): void {
  const processingStart = Date.now();
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }

  if (settings.projectorFont) {
    session.projectorFont = settings.projectorFont;
  }
  const previousBibleMode = session.bibleMode ?? false;
  if (settings.bibleMode !== undefined) {
    session.bibleMode = settings.bibleMode;
    if (!settings.bibleMode) {
      session.bibleFollow = false;
      session.bibleFollowRef = null;
      session.bibleFollowHit = undefined;
    }
  }
  if (settings.bibleVersionId !== undefined) {
    session.bibleVersionId = settings.bibleVersionId;
  }
  if (settings.bibleFollow !== undefined) {
    session.bibleFollow = settings.bibleFollow;
    if (!settings.bibleFollow) {
      session.bibleFollowRef = null;
      session.bibleFollowHit = undefined;
    }
  }

  const settingsMessage: EventSettingsUpdatedMessage = {
    type: 'EVENT_SETTINGS_UPDATED',
    payload: {
      projectorFont: session.projectorFont ?? null,
      bibleMode: session.bibleMode ?? false,
      bibleVersionId: session.bibleVersionId ?? null,
      bibleFollow: session.bibleFollow ?? false,
    },
    timing: createTiming(receivedAt, processingStart),
  };

  broadcastToEvent(session.eventId, settingsMessage);

  if (previousBibleMode && !session.bibleMode) {
    session.allowBackwardUntil = Date.now() + 20000;
    const currentSong = session.songs[session.currentSongIndex];
    if (currentSong) {
      let slideLines: string[] = [];
      let slideText = '';
      if (currentSong.slides && session.currentSlideIndex < currentSong.slides.length) {
        const slide = currentSong.slides[session.currentSlideIndex];
        slideLines = slide.lines;
        slideText = slide.slideText;
      } else if (currentSong.lines[session.currentSlideIndex]) {
        slideLines = [currentSong.lines[session.currentSlideIndex]];
        slideText = slideLines[0];
      }

      if (slideLines.length > 0) {
        const displayMsg: DisplayUpdateMessage = {
          type: 'DISPLAY_UPDATE',
          payload: {
            lineText: slideLines[0],
            slideText,
            slideLines,
            slideIndex: session.currentSlideIndex,
            songId: currentSong.id,
            songTitle: currentSong.title,
            isAutoAdvance: false,
          },
          timing: createTiming(receivedAt, processingStart),
        };
        broadcastToEvent(session.eventId, displayMsg);
      }
    }
  }
}

async function handleTranscriptionResult(
  ws: WebSocket,
  session: SessionState,
  transcriptionResult: { text: string; isFinal: boolean; confidence: number },
  receivedAt: number,
  processingStart: number
): Promise<void> {
  // Send transcript to the session that received it (usually the one with STT stream)
  // Matching will be processed for this session
  // Default to allowing partial matching to provide faster feedback
  const allowPartialMatching =
    process.env.MATCHER_ALLOW_PARTIAL === undefined
      ? true
      : process.env.MATCHER_ALLOW_PARTIAL === 'true';
  const shouldAttemptMatch = transcriptionResult.isFinal || allowPartialMatching;
  const trimmedText = transcriptionResult.text.trim();

  // Log transcription for debugging
  if (trimmedText.length > 0) {
    console.log(`[WS] 🎤 Transcription: "${trimmedText}" (isFinal=${transcriptionResult.isFinal}, confidence=${transcriptionResult.confidence?.toFixed(2) || 'N/A'})`);
  }

  if (session.matcherConfig.debug) {
    console.log(`[WS] 📝 Transcript received: isFinal=${transcriptionResult.isFinal}, allowPartial=${allowPartialMatching}, shouldAttemptMatch=${shouldAttemptMatch}, text="${trimmedText}"`);
  }

  if (trimmedText.length > 0) {
    session.lastTranscriptText = trimmedText;
  }

  const transcriptMessage: TranscriptUpdateMessage = {
    type: 'TRANSCRIPT_UPDATE',
    payload: {
      text: transcriptionResult.text,
      isFinal: transcriptionResult.isFinal,
      confidence: transcriptionResult.confidence,
    },
    timing: createTiming(receivedAt, processingStart),
  };

  // Broadcast transcript to all sessions for this event (operator + projector views)
  broadcastToEvent(session.eventId, transcriptMessage);
  const transcriptNow = Date.now();
  session.lastTranscriptAt = transcriptNow;

  if (shouldAttemptMatch) {
    const matchText = trimmedText.length > 0 ? trimmedText : session.lastTranscriptText;
    if (!matchText) {
      if (session.matcherConfig.debug) {
        console.log(`[WS] ⚠️  Skipping match: no text (trimmedText="${trimmedText}", lastTranscript="${session.lastTranscriptText}")`);
      }
      return;
    }

    // For ElevenLabs (and similar streaming STT), transcripts are cumulative
    // So we REPLACE the buffer instead of appending to avoid duplication
    // For chunk-based STT (Google), we append
    if (sttProvider === 'elevenlabs') {
      // ElevenLabs sends cumulative transcripts - use directly
      session.rollingBuffer = matchText;
    } else {
      // Other providers send deltas - append
      session.rollingBuffer += ' ' + matchText;
      const words = session.rollingBuffer.split(' ');
      if (words.length > 100) {
        session.rollingBuffer = words.slice(-100).join(' ');
      }
    }

    const cleanedBuffer = preprocessBufferText(session.rollingBuffer, 15); // Increased from 12 to 15 words
    
    if (session.matcherConfig.debug) {
      console.log(`[WS] Rolling buffer updated: "${cleanedBuffer.slice(-50)}..."`);
      console.log(`[WS] Cleaned buffer for matching: "${cleanedBuffer}"`);
    }

    const lastStrongMatchAt = session.lastStrongMatchAt ?? 0;
    const lastRecoveryAt = session.lastRecoveryAt ?? 0;
    const hasRecentSpeech = matchText.trim().length > 0;
    const shouldRecoverMatcher =
      !session.bibleMode &&
      hasRecentSpeech &&
      lastStrongMatchAt > 0 &&
      transcriptNow - lastStrongMatchAt > MATCH_STALE_MS &&
      transcriptNow - lastRecoveryAt > MATCH_RECOVERY_COOLDOWN_MS;

    if (shouldRecoverMatcher) {
      session.allowBackwardUntil = transcriptNow + MATCH_RECOVERY_WINDOW_MS;
      session.lastRecoveryAt = transcriptNow;
      console.log(
        `[WS] 🔄 Matcher recovery: no strong match for ${transcriptNow - lastStrongMatchAt}ms, ` +
          `allowing backward search for ${MATCH_RECOVERY_WINDOW_MS}ms`
      );
    }

    if (session.bibleMode) {
      const versionCommand = detectBibleVersionCommand(transcriptionResult.text);
      if (versionCommand) {
        const versionId = await getBibleVersionIdByAbbrev(versionCommand);
        if (versionId) {
          session.bibleVersionId = versionId;
          if (isSupabaseConfigured && supabase) {
            try {
              await supabase
                .from('events')
                .update({ bible_version_id: versionId, bible_mode: true })
                .eq('id', session.eventId);
            } catch (error) {
              console.warn('[WS] Failed to persist bible version change:', error);
            }
          }
          const settingsMessage: EventSettingsUpdatedMessage = {
            type: 'EVENT_SETTINGS_UPDATED',
            payload: {
              projectorFont: session.projectorFont ?? null,
              bibleMode: session.bibleMode ?? true,
              bibleVersionId: session.bibleVersionId ?? null,
              bibleFollow: session.bibleFollow ?? false,
            },
            timing: createTiming(receivedAt, processingStart),
          };
          broadcastToEvent(session.eventId, settingsMessage);
        }
        return;
      }

      const reference =
        findBibleReference(transcriptionResult.text) ?? findBibleReference(cleanedBuffer);
      if (reference) {
        if (!session.bibleVersionId) {
          const fallbackVersionId = await getDefaultBibleVersionId();
          if (fallbackVersionId) {
            session.bibleVersionId = fallbackVersionId;
          } else {
            console.warn('[WS] Bible mode active but no bibleVersionId set.');
            return;
          }
        }

        const verse = await getBibleVerseCached(session, reference, session.bibleVersionId);
        if (!verse) {
          return;
        }

        const refKey = `${verse.book}:${verse.chapter}:${verse.verse}:${verse.versionAbbrev}`;
        const now = Date.now();
        if (session.lastBibleRefKey === refKey && session.lastBibleRefAt && now - session.lastBibleRefAt < 2500) {
          return;
        }

        session.lastBibleRefKey = refKey;
        session.lastBibleRefAt = now;
        session.bibleFollow = true;
        session.bibleFollowRef = reference;
        session.bibleFollowHit = undefined;

        const verseLines = wrapBibleText(verse.text);
        const verseTitle = `${verse.book} ${verse.chapter}:${verse.verse} • ${verse.versionAbbrev}`;

        const displayMsg: DisplayUpdateMessage = {
          type: 'DISPLAY_UPDATE',
          payload: {
            lineText: verseLines[0] ?? verse.text,
            slideText: verseLines.join('\n'),
            slideLines: verseLines,
            slideIndex: 0,
            songId: `bible:${verse.book}:${verse.chapter}:${verse.verse}`,
            songTitle: verseTitle,
            isAutoAdvance: true,
          },
          timing: createTiming(receivedAt, processingStart),
        };

        broadcastToEvent(session.eventId, displayMsg);

        const settingsMessage: EventSettingsUpdatedMessage = {
          type: 'EVENT_SETTINGS_UPDATED',
          payload: {
            projectorFont: session.projectorFont ?? null,
            bibleMode: session.bibleMode ?? true,
            bibleVersionId: session.bibleVersionId ?? null,
            bibleFollow: session.bibleFollow ?? false,
          },
          timing: createTiming(receivedAt, processingStart),
        };
        broadcastToEvent(session.eventId, settingsMessage);
        return;
      }

      if (!session.bibleFollow || !session.bibleFollowRef) {
        return;
      }

      if (!session.bibleVersionId) {
        const fallbackVersionId = await getDefaultBibleVersionId();
        if (fallbackVersionId) {
          session.bibleVersionId = fallbackVersionId;
        } else {
          console.warn('[WS] Bible mode active but no bibleVersionId set.');
          return;
        }
      }

      const normalizedBuffer = normalizeMatchText(cleanedBuffer);
      const bufferWordCount = normalizedBuffer.split(/\s+/).filter(Boolean).length;
      if (bufferWordCount < BIBLE_FOLLOW_MIN_WORDS) {
        return;
      }

      const followRef = session.bibleFollowRef;
      const followEndVerse = followRef.endVerse ?? null;
      if (followEndVerse !== null && followRef.verse >= followEndVerse) {
        return;
      }

      const currentVerse = await getBibleVerseCached(session, followRef, session.bibleVersionId);
      if (!currentVerse) {
        return;
      }

      let nextRef: BibleReference = {
        book: followRef.book,
        chapter: followRef.chapter,
        verse: followRef.verse + 1,
      };

      if (followEndVerse !== null && nextRef.verse > followEndVerse && nextRef.chapter === followRef.chapter) {
        return;
      }

      let nextVerse = await getBibleVerseCached(session, nextRef, session.bibleVersionId);

      if (!nextVerse) {
        if (followEndVerse !== null) {
          return;
        }
        const nextChapterRef: BibleReference = {
          book: followRef.book,
          chapter: followRef.chapter + 1,
          verse: 1,
        };
        nextVerse = await getBibleVerseCached(session, nextChapterRef, session.bibleVersionId);
        if (!nextVerse) {
          return;
        }
        nextRef = nextChapterRef;
      }

      const currentScore = getMatchScore(normalizedBuffer, currentVerse.text);
      const nextScore = getMatchScore(normalizedBuffer, nextVerse.text);

      if (nextScore >= BIBLE_FOLLOW_MATCH_THRESHOLD && nextScore >= currentScore + BIBLE_FOLLOW_MATCH_MARGIN) {
        const now = Date.now();
        const targetKey = buildBibleRefKey(nextRef, session.bibleVersionId);
        if (session.bibleFollowHit &&
            session.bibleFollowHit.targetKey === targetKey &&
            now - session.bibleFollowHit.lastHitAt <= BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) {
          session.bibleFollowHit.hitCount += 1;
          session.bibleFollowHit.lastHitAt = now;
        } else {
          session.bibleFollowHit = {
            targetKey,
            hitCount: 1,
            lastHitAt: now,
          };
        }

        if (session.bibleFollowHit.hitCount >= BIBLE_FOLLOW_DEBOUNCE_MATCHES) {
          session.bibleFollowHit = undefined;
          const nextEndVerse =
            followEndVerse !== null && nextRef.chapter === followRef.chapter ? followEndVerse : null;
          session.bibleFollowRef = {
            ...nextRef,
            endVerse: nextEndVerse,
          };
          session.bibleFollow = true;

          const refKey = `${nextVerse.book}:${nextVerse.chapter}:${nextVerse.verse}:${nextVerse.versionAbbrev}`;
          session.lastBibleRefKey = refKey;
          session.lastBibleRefAt = now;

          const verseLines = wrapBibleText(nextVerse.text);
          const verseTitle = `${nextVerse.book} ${nextVerse.chapter}:${nextVerse.verse} • ${nextVerse.versionAbbrev}`;

          const displayMsg: DisplayUpdateMessage = {
            type: 'DISPLAY_UPDATE',
            payload: {
              lineText: verseLines[0] ?? nextVerse.text,
              slideText: verseLines.join('\n'),
              slideLines: verseLines,
              slideIndex: 0,
              songId: `bible:${nextVerse.book}:${nextVerse.chapter}:${nextVerse.verse}`,
              songTitle: verseTitle,
              isAutoAdvance: true,
            },
            timing: createTiming(receivedAt, processingStart),
          };

          broadcastToEvent(session.eventId, displayMsg);
        }
      } else if (session.bibleFollowHit) {
        const now = Date.now();
        if (now - session.bibleFollowHit.lastHitAt > BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) {
          session.bibleFollowHit = undefined;
        }
      }
      return;
    }

    if (!session.songContext) {
      console.log(`[WS] ⚠️  Skipping match: no songContext for session`);
      return;
    }

      // Always log matcher attempt for debugging production issues
      console.log(`[WS] 🔍 Attempting match with buffer: "${cleanedBuffer.slice(0, 50)}..."`);
      console.log(`[WS] 🔍 Current song: "${session.songContext?.title || 'N/A'}"`);
      console.log(`[WS] 🔍 Current line: "${session.songContext?.lines[session.songContext?.currentLineIndex || 0] || 'N/A'}"`);
      console.log(`[WS] 🔍 Auto-following: ${session.isAutoFollowing}`);

      if (session.songContext) {
        const allowBackward = session.allowBackwardUntil !== undefined && Date.now() < session.allowBackwardUntil;
        const matcherConfig = allowBackward
          ? {
              ...session.matcherConfig,
              allowBackward: true,
              lookAheadWindow: session.songContext.lines.length,
            }
          : session.matcherConfig;

        // PHASE 1: Multi-song matching with debouncing
        const multiSongResult: MultiSongMatchResult = findBestMatchAcrossAllSongs(
          cleanedBuffer,
          session.songContext,
          session.songs,
          session.currentSongIndex,
          matcherConfig
        );

        const matchResult = multiSongResult.currentSongMatch;
        session.lastMatchConfidence = matchResult.confidence;
        if (session.allowBackwardUntil && matchResult.matchFound) {
          session.allowBackwardUntil = undefined;
        }

        // Always log match result for debugging
        console.log(`[WS] 📊 Current song match: found=${matchResult.matchFound}, confidence=${(matchResult.confidence * 100).toFixed(1)}%`);
        if (matchResult.matchFound) {
          console.log(`[WS] 📊 Matched line ${matchResult.currentLineIndex}: "${matchResult.matchedText}"`);
        }

        // PHASE 1: Handle song switch suggestions with debouncing
        const SONG_SWITCH_COOLDOWN_MS = 3000; // 3 seconds cooldown after any song switch
        const SONG_SWITCH_DEBOUNCE_MATCHES = 2; // Require 2 consecutive matches before switching
        const now = Date.now();

        if (multiSongResult.suggestedSongSwitch && session.isAutoFollowing) {
          const suggestion = multiSongResult.suggestedSongSwitch;
          
          // Check if we're in cooldown period
          if (session.lastSongSwitchAt && (now - session.lastSongSwitchAt < SONG_SWITCH_COOLDOWN_MS)) {
            if (session.matcherConfig.debug) {
              console.log(`[WS] 🚫 Song switch suggestion ignored (cooldown: ${SONG_SWITCH_COOLDOWN_MS - (now - session.lastSongSwitchAt)}ms remaining)`);
            }
          } else if (session.suggestedSongSwitch && 
                     session.suggestedSongSwitch.songId === suggestion.songId) {
            // Same song detected again - increment match count
            session.suggestedSongSwitch.matchCount++;
            console.log(`[WS] 🔁 Song switch suggestion sustained (${session.suggestedSongSwitch.matchCount}/${SONG_SWITCH_DEBOUNCE_MATCHES}): "${suggestion.songTitle}"`);

            // DEBOUNCING: Only switch after N consecutive matches (prevents false positives)
            // LOWERED THRESHOLD: Auto-switch at 50%+ confidence (user requested immediate switching)
            if (session.suggestedSongSwitch.matchCount >= SONG_SWITCH_DEBOUNCE_MATCHES && 
                suggestion.confidence >= 0.50) {
              // AUTO-SWITCH: Reasonable confidence + sustained match
              console.log(`[WS] 🎵 AUTO-SWITCHING to song "${suggestion.songTitle}" (sustained ${session.suggestedSongSwitch.matchCount} matches @ ${(suggestion.confidence * 100).toFixed(1)}%)`);
              
              // Perform the song switch
              session.currentSongIndex = suggestion.songIndex;
              session.currentSlideIndex = suggestion.matchedLineIndex;
              session.songContext = createSongContext(
                { id: suggestion.songId, sequence_order: suggestion.songIndex + 1 },
                session.songs[suggestion.songIndex],
                suggestion.matchedLineIndex
              );
              session.rollingBuffer = ''; // Clear buffer on song change
              session.lastSongSwitchAt = now;
              session.lastStrongMatchAt = now;
              session.suggestedSongSwitch = undefined; // Clear suggestion

              // Broadcast SONG_CHANGED to all clients
              const songChangedMsg: SongChangedMessage = {
                type: 'SONG_CHANGED',
                payload: {
                  songId: suggestion.songId,
                  songTitle: suggestion.songTitle,
                  songIndex: suggestion.songIndex,
                  totalSlides: session.songs[suggestion.songIndex].lines.length,
                },
                timing: createTiming(receivedAt, processingStart),
              };
              broadcastToEvent(session.eventId, songChangedMsg);

              // Send initial DISPLAY_UPDATE for the new song
              const switchedSong = session.songs[suggestion.songIndex];
              const switchedSlideIndex = suggestion.matchedLineIndex;
              
              // Get full slide data (multi-line support)
              let slideLines: string[];
              let slideText: string;
              
              if (switchedSong.slides && switchedSlideIndex < switchedSong.slides.length) {
                // Use multi-line slide data
                const slide = switchedSong.slides[switchedSlideIndex];
                slideLines = slide.lines;
                slideText = slide.slideText;
              } else {
                // Fallback: single line (backward compatibility)
                slideLines = [switchedSong.lines[switchedSlideIndex] || suggestion.matchedLine];
                slideText = slideLines[0];
              }
              
              const displayMsg: DisplayUpdateMessage = {
                type: 'DISPLAY_UPDATE',
                payload: {
                  lineText: slideLines[0], // Backward compatibility
                  slideText, // Multi-line text (lines joined with \n)
                  slideLines, // Array of lines in the slide
                  slideIndex: switchedSlideIndex,
                  songId: suggestion.songId,
                  songTitle: suggestion.songTitle,
                  matchConfidence: suggestion.confidence,
                  isAutoAdvance: true,
                },
                timing: createTiming(receivedAt, processingStart),
              };
              
              console.log(`[WS] 📤 Sending DISPLAY_UPDATE for auto-switch: ${slideLines.length} lines - "${slideText.substring(0, 50)}..."`);
              broadcastToEvent(session.eventId, displayMsg);
              return; // Exit early after song switch
            } else if (suggestion.confidence < 0.50) {
              // SUGGEST: Low confidence - notify operator but don't auto-switch
              const suggestionMsg: import('../types/websocket').SongSuggestionMessage = {
                type: 'SONG_SUGGESTION',
                payload: {
                  suggestedSongId: suggestion.songId,
                  suggestedSongTitle: suggestion.songTitle,
                  suggestedSongIndex: suggestion.songIndex,
                  confidence: suggestion.confidence,
                  matchedLine: suggestion.matchedLine,
                },
                timing: createTiming(receivedAt, processingStart),
              };
              send(ws, suggestionMsg);
            }
          } else {
            // New song suggestion - start debouncing
            session.suggestedSongSwitch = {
              songId: suggestion.songId,
              songIndex: suggestion.songIndex,
              confidence: suggestion.confidence,
              firstDetectedAt: now,
              matchCount: 1,
            };
            console.log(`[WS] 🎵 New song switch suggestion: "${suggestion.songTitle}" @ ${(suggestion.confidence * 100).toFixed(1)}% (1/${SONG_SWITCH_DEBOUNCE_MATCHES})`);

            // Send suggestion toast for low confidence (below auto-switch threshold)
            if (suggestion.confidence < 0.50) {
              const suggestionMsg: import('../types/websocket').SongSuggestionMessage = {
                type: 'SONG_SUGGESTION',
                payload: {
                  suggestedSongId: suggestion.songId,
                  suggestedSongTitle: suggestion.songTitle,
                  suggestedSongIndex: suggestion.songIndex,
                  confidence: suggestion.confidence,
                  matchedLine: suggestion.matchedLine,
                },
                timing: createTiming(receivedAt, processingStart),
              };
              send(ws, suggestionMsg);
            }
          }
        } else {
          // No song switch suggestion - clear any pending suggestion
          if (session.suggestedSongSwitch) {
            if (session.matcherConfig.debug) {
              console.log(`[WS] Clearing song switch suggestion (no longer detected)`);
            }
            session.suggestedSongSwitch = undefined;
          }
        }

      // Handle current song line matching (normal slide advance)
      const isEndTriggerMatch =
        matchResult.advanceReason === 'end-words' && matchResult.endTriggerScore !== undefined;
      if (matchResult.matchFound && (matchResult.confidence >= session.matcherConfig.similarityThreshold || isEndTriggerMatch)) {
        session.lastStrongMatchAt = Date.now();
        // END-TRIGGER DEBOUNCE: Require consecutive end-word hits within a short window
        const END_TRIGGER_DEBOUNCE_WINDOW_MS = 1800;
        const END_TRIGGER_DEBOUNCE_MATCHES = 2;
        let isLineEndConfirmed = matchResult.isLineEnd ?? false;

        if (matchResult.isLineEnd && matchResult.advanceReason === 'end-words' && matchResult.nextLineIndex !== undefined) {
          const now = Date.now();
          const lineIndex = matchResult.currentLineIndex;
          const lastHit = session.endTriggerHit;

          if (lastHit && lastHit.lineIndex === lineIndex && now - lastHit.lastHitAt <= END_TRIGGER_DEBOUNCE_WINDOW_MS) {
            lastHit.hitCount += 1;
            lastHit.lastHitAt = now;
            session.endTriggerHit = lastHit;
          } else {
            session.endTriggerHit = {
              lineIndex,
              lastHitAt: now,
              hitCount: 1,
            };
          }

          if (session.endTriggerHit.hitCount < END_TRIGGER_DEBOUNCE_MATCHES) {
            isLineEndConfirmed = false;
            if (session.matcherConfig.debug) {
              console.log(
                `[WS] ⏱️ End-trigger debounce (${session.endTriggerHit.hitCount}/${END_TRIGGER_DEBOUNCE_MATCHES}) - waiting for confirmation`
              );
            }
          } else {
            isLineEndConfirmed = true;
            if (session.matcherConfig.debug) {
              console.log('[WS] ✅ End-trigger confirmed - advancing');
            }
            session.endTriggerHit = undefined;
          }
        } else {
          session.endTriggerHit = undefined;
        }

        const currentSong = session.songs[session.currentSongIndex];
        const matchedLineIndex = isLineEndConfirmed && matchResult.nextLineIndex !== undefined
          ? matchResult.nextLineIndex
          : matchResult.currentLineIndex;

        // Convert line index to slide index
        let newSlideIndex = session.currentSlideIndex;
        if (currentSong.lineToSlideIndex && matchedLineIndex < currentSong.lineToSlideIndex.length) {
          newSlideIndex = currentSong.lineToSlideIndex[matchedLineIndex];
        } else {
          // Fallback: assume 1:1 mapping if no slides configured
          newSlideIndex = matchedLineIndex;
        }

        if (session.matcherConfig.debug) {
          console.log(
            `[WS] 🎯 MATCH FOUND: Line ${matchedLineIndex} → Slide ${newSlideIndex} @ ${(matchResult.confidence * 100).toFixed(1)}% - "${matchResult.matchedText}"`
          );
        }

        // Only broadcast DISPLAY_UPDATE when slide actually changes
        const slideChanged = newSlideIndex !== session.currentSlideIndex;
        
        // FORWARD-ONLY PROTECTION: Prevent backward slide jumps (repeated lyrics issue)
        if (slideChanged && newSlideIndex < session.currentSlideIndex) {
          console.warn(
            `[WS] ⚠️  BLOCKED BACKWARD SLIDE: ${newSlideIndex} < ${session.currentSlideIndex} (repeated lyrics detected)`
          );
          console.warn(
            `[WS] Matched line: "${matchResult.matchedText.slice(0, 50)}..." - staying on current slide to prevent confusion`
          );
          if (session.matcherConfig.debug) {
            console.log(
              `[WS] This prevents jumping back to earlier stanzas when lyrics repeat (e.g., "He will make a way for me")`
            );
          }
          return; // Don't broadcast, stay on current slide
        }
        
        if (slideChanged) {
          // Get slide data
          let slideText = matchResult.matchedText;
          let slideLines = [matchResult.matchedText];
          
          if (currentSong.slides && newSlideIndex < currentSong.slides.length) {
            const slide = currentSong.slides[newSlideIndex];
            slideText = slide.slideText;
            slideLines = slide.lines;
          }

          const displayMessage: DisplayUpdateMessage = {
            type: 'DISPLAY_UPDATE',
            payload: {
              lineText: slideLines[0] || '', // Backward compatibility
              slideText,
              slideLines,
              slideIndex: newSlideIndex,
              lineIndex: matchedLineIndex,
              songId: session.songContext.id,
              songTitle: session.songContext.title,
              matchConfidence: matchResult.confidence,
              isAutoAdvance: isLineEndConfirmed || false,
            },
            timing: createTiming(receivedAt, processingStart),
          };

          broadcastToEvent(session.eventId, displayMessage);

          // Update session state
          session.currentSlideIndex = newSlideIndex;
          session.currentLineIndex = matchedLineIndex;
          session.songContext.currentLineIndex = matchedLineIndex;
          
          if (session.matcherConfig.debug) {
            console.log(`[WS] Auto-advanced to slide ${newSlideIndex} (line ${matchedLineIndex})`);
          }
        } else {
          // Slide didn't change, just update line index for matching
          session.currentLineIndex = matchedLineIndex;
          session.songContext.currentLineIndex = matchedLineIndex;
          
          if (session.matcherConfig.debug) {
            console.log(`[WS] Matched line ${matchedLineIndex} within current slide ${session.currentSlideIndex} (confidence: ${(matchResult.confidence * 100).toFixed(1)}%)`);
          }
        }

        // Trim buffer after strong match to reduce noise for next lines
        session.rollingBuffer = matchResult.matchedText;
      } else if (session.endTriggerHit) {
        session.endTriggerHit = undefined;
      }
    }
  }
}

/**
 * Handle AUDIO_DATA message
 * Processes audio chunks for transcription
 */
async function handleAudioData(
  ws: WebSocket,
  data: string,
  format: { sampleRate?: number; channels?: number; encoding?: string } | undefined,
  receivedAt: number
): Promise<void> {
  const processingStart = Date.now();
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }

  session.lastAudioChunkAt = Date.now();

  // Log audio format for debugging (first few chunks only to avoid spam)
  const chunkCount = session.audioChunkCount || 0;
  session.audioChunkCount = chunkCount + 1;
  if (chunkCount < 3) {
    console.log(`[WS] 📦 Audio chunk #${chunkCount + 1}: ${data.length} bytes (base64), format: ${format?.encoding || 'unknown'}, sampleRate: ${format?.sampleRate || 'unknown'}, channels: ${format?.channels || 'unknown'}`);
  }

  if (sttProvider === 'elevenlabs') {
    // Watchdog: Restart ElevenLabs stream if audio is flowing but transcripts have stopped
    const STT_STALE_MS = 30000;
    const STT_RESTART_COOLDOWN_MS = 30000;
    if (session.lastTranscriptAt && Date.now() - session.lastTranscriptAt > STT_STALE_MS) {
      const lastRestart = session.lastSttRestartAt ?? 0;
      if (Date.now() - lastRestart > STT_RESTART_COOLDOWN_MS) {
        try {
          restartElevenLabsStream(session, ws, 'stale transcripts');
        } catch (error) {
          console.error('[STT] ❌ Failed to restart ElevenLabs stream:', error);
          sendError(ws, 'STT_ERROR', 'Failed to restart ElevenLabs stream', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (format?.encoding !== 'pcm_s16le') {
      const receivedFormat = format?.encoding || 'unknown';
      const receivedSampleRate = format?.sampleRate || 'unknown';
      const receivedChannels = format?.channels || 'unknown';
      
      console.error(`[WS] ❌ Audio format mismatch for ElevenLabs STT:`);
      console.error(`[WS]    Received: encoding=${receivedFormat}, sampleRate=${receivedSampleRate}, channels=${receivedChannels}`);
      console.error(`[WS]    Expected: encoding=pcm_s16le, sampleRate=16000, channels=1`);
      console.error(`[WS] ❌ Fix: Set NEXT_PUBLIC_STT_PROVIDER=elevenlabs in frontend environment variables`);
      console.error(`[WS] ❌ This ensures the frontend sends PCM format instead of WebM/Opus`);
      
      sendError(ws, 'AUDIO_FORMAT_UNSUPPORTED', 
        `ElevenLabs requires PCM 16-bit audio (pcm_s16le, 16kHz, mono). ` +
        `Received: ${receivedFormat} format. ` +
        `Fix: Set NEXT_PUBLIC_STT_PROVIDER=elevenlabs in frontend environment.`, 
        {
          encoding: receivedFormat,
          sampleRate: receivedSampleRate,
          channels: receivedChannels,
          expected: {
            encoding: 'pcm_s16le',
            sampleRate: 16000,
            channels: 1,
          },
          fix: 'Set NEXT_PUBLIC_STT_PROVIDER=elevenlabs in frontend environment variables',
        }
      );
      return;
    }

    // Log successful format validation for first chunk
    if (chunkCount === 0) {
      console.log(`[WS] ✅ Audio format validated: PCM 16-bit (${format.sampleRate}Hz, ${format.channels} channel)`);
    }

    // Smart Bible Listen gate: for BIBLE items when enabled, do not start STT until STT_WINDOW_REQUEST
    if (shouldUseSmartListenGate(session)) {
      if (session.sttWindowActiveUntil && Date.now() > session.sttWindowActiveUntil) {
        if (session.sttStream) {
          try {
            session.sttStream.end();
          } catch (e) {
            console.warn('[STT] Smart Listen: error ending stream after window:', e);
          }
          session.sttStream = undefined;
        }
        session.sttWindowActiveUntil = undefined;
        console.log('[STT] Smart Listen: STT window expired, stream closed');
      }
      if (!session.sttStream || !session.sttWindowActiveUntil || Date.now() > session.sttWindowActiveUntil) {
        return; // Drop audio until client sends STT_WINDOW_REQUEST or window is active
      }
    }

    // Lazy initialization: Create ElevenLabs stream on first audio chunk
    if (!session.sttStream) {
      if (!isElevenLabsConfigured) {
        console.error('[STT] ❌ ElevenLabs selected but ELEVENLABS_API_KEY not configured');
        sendError(ws, 'STT_ERROR', 'ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in backend/.env');
        return;
      }
      console.log('[STT] 🚀 Creating ElevenLabs streaming recognition (lazy init on first audio)...');
      initElevenLabsStream(session, ws);
      const activeStream = session.sttStream;
      
      // Share stream with other sessions for this event (if any)
      for (const [otherWs, otherSession] of sessions.entries()) {
        if (otherSession.eventId === session.eventId && 
            otherSession !== session && 
            !otherSession.sttStream &&
            otherWs.readyState === ws.OPEN) {
          console.log('[STT] 📡 Sharing STT stream with existing session');
          if (activeStream) {
            otherSession.sttStream = activeStream;
          }
        }
      }
    }

    try {
      const audioBuffer = Buffer.from(data, 'base64');
      
      // Validate audio buffer size (should be reasonable for PCM 16-bit)
      // 128 samples * 2 bytes = 256 bytes minimum per chunk
      if (audioBuffer.length < 256 && chunkCount < 3) {
        console.warn(`[WS] ⚠️  Small audio chunk detected: ${audioBuffer.length} bytes (expected >=256 for 128-sample buffer)`);
      }
      
      if (!session.sttStream) {
        console.error('[STT] ❌ ElevenLabs stream not initialized');
        sendError(ws, 'STT_ERROR', 'ElevenLabs stream not initialized');
        return;
      }
      session.sttStream.write(audioBuffer);
      
      // Log first few chunks, then periodically
      if (chunkCount < 3) {
        console.log(`[WS] ✅ Audio chunk #${chunkCount + 1} sent to ElevenLabs: ${audioBuffer.length} bytes (${(audioBuffer.length / 2).toFixed(0)} samples)`);
      } else if (Math.random() < 0.02) {
        // Log periodically (every ~50 chunks) to avoid spam
        console.log(`[WS] ✅ Audio chunk sent to ElevenLabs: ${audioBuffer.length} bytes`);
      }
    } catch (error) {
      console.error('[WS] ❌ Error sending audio to ElevenLabs:', error);
      sendError(ws, 'STT_ERROR', 'Error sending audio to ElevenLabs', { 
        error: String(error),
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return;
  }

  // Send audio to STT service (Google Cloud or mock)
  try {
    const transcriptionResult = await transcribeAudioChunk(data);
    if (transcriptionResult) {
      await handleTranscriptionResult(ws, session, transcriptionResult, receivedAt, processingStart);
    } else {
      console.log('[WS] No transcription result (silence or error)');
    }
  } catch (error) {
    console.error('[WS] Error processing audio:', error);
    sendError(ws, 'STT_ERROR', 'Failed to transcribe audio', { error: String(error) });
  }
}

/**
 * Handle STT_WINDOW_REQUEST (Smart Bible Listen).
 * Opens ElevenLabs STT window; optional catch-up audio from ring buffer.
 */
function handleSttWindowRequest(ws: WebSocket, payload: { catchUpAudio?: string }, _receivedAt: number): void {
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }
  if (!BIBLE_SMART_LISTEN_ENABLED) {
    sendError(ws, 'STT_WINDOW_UNSUPPORTED', 'Smart Listen is disabled. Set BIBLE_SMART_LISTEN_ENABLED=true to use STT_WINDOW_REQUEST.');
    return;
  }
  if (!currentItemIsBible(session)) {
    sendError(ws, 'STT_WINDOW_UNSUPPORTED', 'STT_WINDOW_REQUEST is only valid when current setlist item is BIBLE.');
    return;
  }
  if (!isElevenLabsConfigured) {
    sendError(ws, 'STT_ERROR', 'ElevenLabs API key not configured.');
    return;
  }

  if (!session.sttStream) {
    initElevenLabsStream(session, ws);
  }
  session.sttWindowActiveUntil = Date.now() + BIBLE_SMART_LISTEN_WINDOW_MS;
  console.log(`[STT] Smart Listen: STT window opened for ${BIBLE_SMART_LISTEN_WINDOW_MS}ms`);

  if (payload.catchUpAudio) {
    try {
      const buffer = Buffer.from(payload.catchUpAudio, 'base64');
      if (session.sttStream && buffer.length > 0) {
        session.sttStream.write(buffer);
        console.log(`[STT] Smart Listen: sent ${buffer.length} bytes catch-up audio`);
      }
    } catch (err) {
      console.warn('[STT] Smart Listen: failed to write catch-up audio:', err);
    }
  }
}

/**
 * Handle MANUAL_OVERRIDE message
 * Allows operator to manually control slides
 */
function handleManualOverride(
  ws: WebSocket,
  action: 'NEXT_SLIDE' | 'PREV_SLIDE' | 'GO_TO_SLIDE',
  receivedAt: number,
  slideIndex?: number,
  songId?: string
): void {
  const processingStart = Date.now();
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }

  const currentSong = session.songs[session.currentSongIndex];
  if (!currentSong) {
    sendError(ws, 'NO_SONG', 'No current song in session.');
    return;
  }

  let newSlideIndex = session.currentSlideIndex;
  let newSongIndex = session.currentSongIndex;

  // Helper to get slide count for a song
  const getSlideCount = (song: SongData): number => {
    return song.slides?.length ?? song.lines.length;
  };

  switch (action) {
    case 'NEXT_SLIDE': {
      const slideCount = getSlideCount(currentSong);
      if (session.currentSlideIndex < slideCount - 1) {
        newSlideIndex = session.currentSlideIndex + 1;
      } else if (session.currentSongIndex < session.songs.length - 1) {
        // Move to next song
        newSongIndex = session.currentSongIndex + 1;
        newSlideIndex = 0;
      }
      break;
    }

    case 'PREV_SLIDE': {
      if (session.currentSlideIndex > 0) {
        newSlideIndex = session.currentSlideIndex - 1;
      } else if (session.currentSongIndex > 0) {
        // Move to previous song
        newSongIndex = session.currentSongIndex - 1;
        const prevSong = session.songs[newSongIndex];
        newSlideIndex = getSlideCount(prevSong) - 1;
      }
      break;
    }

    case 'GO_TO_SLIDE':
      if (slideIndex !== undefined) {
        if (songId) {
          const targetSongIndex = session.songs.findIndex((s) => s.id === songId);
          if (targetSongIndex !== -1) {
            newSongIndex = targetSongIndex;
          }
        }
        const targetSong = session.songs[newSongIndex];
        const slideCount = getSlideCount(targetSong);
        if (slideIndex >= 0 && slideIndex < slideCount) {
          newSlideIndex = slideIndex;
        }
      }
      break;
  }

  // Check if anything actually changed
  const songChanged = newSongIndex !== session.currentSongIndex;
  const slideChanged = newSlideIndex !== session.currentSlideIndex || songChanged;

  if (!slideChanged) {
    // Nothing changed, don't send update
    console.log(`[WS] Manual override: ${action} -> No change (already at Song ${newSongIndex}, Slide ${newSlideIndex})`);
    return;
  }

  // PHASE 1: Manual override disables auto-following temporarily
  // Operator is taking control, so pause AI auto-switching
  if (songChanged) {
    console.log(`[WS] 🎛️  Manual song change detected - disabling auto-follow mode`);
    session.isAutoFollowing = false;
    // Clear any pending song switch suggestions
    session.suggestedSongSwitch = undefined;
  }

  const targetSong = session.songs[newSongIndex];

  // Determine line index from slide index
  let newLineIndex = 0;
  if (targetSong.slides && newSlideIndex < targetSong.slides.length) {
    newLineIndex = targetSong.slides[newSlideIndex].startLineIndex;
  } else if (targetSong.lineToSlideIndex && targetSong.lineToSlideIndex.length > 0) {
    // Fallback: find first line that maps to this slide
    newLineIndex = targetSong.lineToSlideIndex.findIndex(slideIdx => slideIdx === newSlideIndex);
    if (newLineIndex === -1) newLineIndex = 0;
  } else {
    // Ultimate fallback: assume 1:1 mapping
    newLineIndex = newSlideIndex;
  }

  // Update session state
  session.currentSongIndex = newSongIndex;
  session.currentSlideIndex = newSlideIndex;
  session.currentLineIndex = newLineIndex;

  // Update song context for matching
  if (songChanged) {
    session.songContext = createSongContext(
      { id: targetSong.id, sequence_order: newSongIndex + 1 },
      targetSong,
      newLineIndex // Use line index for matching
    );
    session.rollingBuffer = ''; // Clear buffer on song change
  } else if (session.songContext) {
    // Update line index within same song
    session.songContext.currentLineIndex = newLineIndex;
  }

  const timing = createTiming(receivedAt, processingStart);

  // Send SONG_CHANGED if song changed
  if (songChanged) {
    const songChangedMessage: SongChangedMessage = {
      type: 'SONG_CHANGED',
      payload: {
        songId: targetSong.id,
        songTitle: targetSong.title,
        songIndex: newSongIndex,
        totalSlides: targetSong.slides?.length ?? targetSong.lines.length,
      },
      timing,
    };
    send(ws, songChangedMessage);
  }

  // Send display update with slide data
  let slideText = '';
  let slideLines: string[] = [];
  
  if (targetSong.slides && newSlideIndex < targetSong.slides.length) {
    const slide = targetSong.slides[newSlideIndex];
    slideText = slide.slideText;
    slideLines = slide.lines;
  } else {
    // Fallback for songs without slides
    slideText = targetSong.lines[newLineIndex] || '';
    slideLines = [slideText];
  }

  const displayUpdate: DisplayUpdateMessage = {
    type: 'DISPLAY_UPDATE',
    payload: {
      lineText: slideLines[0] || '', // Backward compatibility
      slideText,
      slideLines,
      slideIndex: newSlideIndex,
      lineIndex: newLineIndex,
      songId: targetSong.id,
      songTitle: targetSong.title,
      isAutoAdvance: false,
    },
    timing,
  };
  broadcastToEvent(session.eventId, displayUpdate);

  console.log(`[WS] Manual override: ${action} -> Song ${newSongIndex}, Slide ${newSlideIndex}${songChanged ? ' (song changed)' : ''}`);
}

/**
 * Handle STOP_SESSION message
 * Ends the current session
 */
function handleStopSession(ws: WebSocket, receivedAt: number): void {
  const processingStart = Date.now();
  const session = sessions.get(ws);
  if (!session) {
    sendError(ws, 'NO_SESSION', 'No active session to stop.');
    return;
  }

  if (session.sttStream) {
    session.sttStream.end();
  }

  const sessionId = session.sessionId;
  sessions.delete(ws);

  send(ws, {
    type: 'SESSION_ENDED',
    payload: {
      sessionId,
      reason: 'user_stopped',
    },
    timing: createTiming(receivedAt, processingStart),
  });

  console.log(`[WS] Session ended: ${sessionId}`);
}

/**
 * Handle PING message
 * Responds with PONG for keep-alive and latency measurement
 */
function handlePing(ws: WebSocket, receivedAt: number): void {
  const processingStart = Date.now();
  const pong: PongMessage = {
    type: 'PONG',
    payload: {
      timestamp: new Date().toISOString(),
    },
    timing: createTiming(receivedAt, processingStart),
  };
  send(ws, pong);
}

// ============================================
// Main Message Router
// ============================================

/**
 * Process an incoming WebSocket message
 */
export async function handleMessage(ws: WebSocket, rawMessage: string): Promise<void> {
  // Track when the message was received for latency measurement
  const receivedAt = Date.now();
  
  let parsed: unknown;

  // Parse JSON
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    sendError(ws, 'INVALID_JSON', 'Message is not valid JSON');
    return;
  }

  const messageType = typeof parsed === 'object' && parsed !== null && 'type' in parsed
    ? String((parsed as { type?: unknown }).type)
    : 'UNKNOWN';

  if (isRateLimited(ws, messageType)) {
    sendError(ws, 'RATE_LIMITED', 'Too many messages in a short period');
    return;
  }

  // Validate message structure
  const validation = validateClientMessage(parsed);
  if (!validation.success) {
    sendError(ws, 'VALIDATION_ERROR', validation.error ?? 'Invalid message format');
    return;
  }

  const message = validation.data as ClientMessage;

  // Route message to appropriate handler
  try {
    if (isStartSessionMessage(message)) {
      await handleStartSession(ws, message.payload, receivedAt);
    } else if (isUpdateEventSettingsMessage(message)) {
      handleUpdateEventSettings(ws, message.payload, receivedAt);
    } else if (isAudioDataMessage(message)) {
      await handleAudioData(ws, message.payload.data, message.payload.format, receivedAt);
    } else if (isManualOverrideMessage(message)) {
      handleManualOverride(
        ws,
        message.payload.action,
        receivedAt,
        message.payload.slideIndex,
        message.payload.songId
      );
    } else if (isStopSessionMessage(message)) {
      handleStopSession(ws, receivedAt);
    } else if (isPingMessage(message)) {
      handlePing(ws, receivedAt);
    } else if (isSttWindowRequestMessage(message)) {
      handleSttWindowRequest(ws, message.payload, receivedAt);
    } else {
      sendError(ws, 'UNKNOWN_TYPE', `Unknown message type`);
    }
  } catch (error) {
    console.error('[WS] Error handling message:', error);
    sendError(ws, 'INTERNAL_ERROR', 'An internal error occurred');
  }
}

/**
 * Handle WebSocket connection close
 * Cleans up session state
 */
export function handleClose(ws: WebSocket): void {
  const session = sessions.get(ws);
  if (session) {
    console.log(`[WS] Connection closed, cleaning up session: ${session.sessionId}`);
    if (session.sttStream) {
      session.sttStream.end();
    }
    sessions.delete(ws);
  }
  wsRateLimits.delete(ws);
}

/**
 * Get current session count
 */
export function getSessionCount(): number {
  return sessions.size;
}
