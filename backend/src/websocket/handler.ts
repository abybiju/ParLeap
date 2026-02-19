/**
 * WebSocket Message Handler
 * 
 * Processes incoming WebSocket messages and manages session state
 */

import * as fs from 'fs';
import * as path from 'path';
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
import { fetchEventData, fetchEventItemById, type SongData, type SetlistItemData } from '../services/eventService';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import {
  type BibleReference,
  detectBibleVersionCommand,
  fetchBibleVerse,
  findBibleReference,
  getBibleVersionIdByAbbrev,
  getDefaultBibleVersionId,
  searchVerseCandidatesByWords,
  wrapBibleText,
} from '../services/bibleService';
import {
  isBibleSemanticFollowEnabled,
  getBibleFollowSemanticScores,
  findVerseByContent,
} from '../services/bibleEmbeddingService';
import { transcribeAudioChunk, createStreamingRecognition, sttProvider, isElevenLabsConfigured, isGoogleCloudConfigured } from '../services/sttService';
import {
  findBestMatch,
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

const DEBUG_LOG_PATH = path.join(__dirname, '..', '..', '..', '..', '.cursor', 'debug.log');
function debugLog(payload: Record<string, unknown>): void {
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(payload) + '\n');
  } catch {
    // ignore
  }
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type AnnouncementSlide = {
  url?: string;
  type?: 'image' | 'video';
  title?: string;
  structuredText?: { title?: string; subtitle?: string; date?: string; lines?: string[] };
};

function hasStructuredText(slide: AnnouncementSlide): boolean {
  const st = slide.structuredText;
  if (!st) return false;
  if (st.title?.trim()) return true;
  if (st.subtitle?.trim()) return true;
  if (st.date?.trim()) return true;
  if (st.lines?.some((l) => (l ?? '').trim())) return true;
  return false;
}

function buildAnnouncementPayload(
  slide: AnnouncementSlide,
  placeholderId: string,
  slideIndex: number,
  currentItemIndex: number,
  isAutoAdvance: boolean
): DisplayUpdateMessage['payload'] {
  const base = {
    slideIndex,
    lineIndex: 0,
    songId: placeholderId,
    isAutoAdvance,
    currentItemIndex,
  };
  if (hasStructuredText(slide) && slide.structuredText) {
    const st = slide.structuredText;
    const lines: string[] = [];
    if (st.title?.trim()) lines.push(st.title.trim());
    if (st.subtitle?.trim()) lines.push(st.subtitle.trim());
    if (st.date?.trim()) lines.push(st.date.trim());
    if (st.lines) for (const l of st.lines) if ((l ?? '').trim()) lines.push((l ?? '').trim());
    const songTitle = st.title?.trim() ?? slide.title ?? 'Announcement';
    const firstLine = lines[0] ?? songTitle;
    return {
      ...base,
      lineText: firstLine,
      slideText: lines.join('\n'),
      slideLines: lines,
      songTitle,
      slideImageUrl: slide.type === 'image' && slide.url ? slide.url : undefined,
      slideVideoUrl: slide.type === 'video' && slide.url ? slide.url : undefined,
      displayType: 'lyrics',
    };
  }
  const title = slide.title ?? 'Announcement';
  return {
    ...base,
    lineText: title,
    slideText: title,
    slideLines: [title],
    songTitle: title,
    slideImageUrl: slide.type === 'image' ? slide.url : undefined,
    slideVideoUrl: slide.type === 'video' ? slide.url : undefined,
    displayType: slide.type === 'image' ? 'image' : 'video',
  };
}

const MATCH_STALE_MS = parseNumberEnv(process.env.MATCHER_STALE_MS, 12000);
const MATCH_RECOVERY_WINDOW_MS = parseNumberEnv(process.env.MATCHER_RECOVERY_WINDOW_MS, 10000);
const MATCH_RECOVERY_COOLDOWN_MS = parseNumberEnv(process.env.MATCHER_RECOVERY_COOLDOWN_MS, 15000);
const ROLLING_BUFFER_MAX_CHARS = parseNumberEnv(process.env.ROLLING_BUFFER_MAX_CHARS, 250);
const BIBLE_FOLLOW_MIN_WORDS = parseNumberEnv(process.env.BIBLE_FOLLOW_MIN_WORDS, 4);
const BIBLE_FOLLOW_MATCH_THRESHOLD = parseNumberEnv(process.env.BIBLE_FOLLOW_MATCH_THRESHOLD, 0.55);
const BIBLE_FOLLOW_MATCH_MARGIN = parseNumberEnv(process.env.BIBLE_FOLLOW_MATCH_MARGIN, 0.05);
const BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS = parseNumberEnv(process.env.BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS, 1800);
const BIBLE_FOLLOW_DEBOUNCE_MATCHES = parseNumberEnv(process.env.BIBLE_FOLLOW_DEBOUNCE_MATCHES, 2);
/** End-of-verse: when buffer tail matches last 3–4 words of current verse, allow advance with 1 match and lower bar (mirror song end-of-line). */
const BIBLE_END_OF_VERSE_TRIGGER_THRESHOLD = parseNumberEnv(process.env.BIBLE_END_OF_VERSE_TRIGGER_THRESHOLD, 0.45);
const BIBLE_END_OF_VERSE_NEXT_THRESHOLD = parseNumberEnv(process.env.BIBLE_END_OF_VERSE_NEXT_THRESHOLD, 0.45);
const BIBLE_END_OF_VERSE_BUFFER_WORDS = 6;
/** Min semantic score for verse-by-content open and in-chapter/cross-chapter jump (paraphrased speech). */
const BIBLE_JUMP_BY_CONTENT_MIN_SCORE = parseNumberEnv(process.env.BIBLE_JUMP_BY_CONTENT_MIN_SCORE, 0.65);

/** Song lock: only match current song for this long (ms) after a switch. Reduces latency and false song switches. */
const SONG_LOCK_MS = parseNumberEnv(process.env.SONG_LOCK_MS, 25000);
/** After this many consecutive low/no matches we clear the lock and check other songs. */
const SONG_LOCK_CONSECUTIVE_LOW = parseNumberEnv(process.env.SONG_LOCK_CONSECUTIVE_LOW, 2);
/** Confidence below this counts as "low" for song lock (clears lock after N consecutive). */
const SONG_LOCK_LOW_THRESHOLD = parseNumberEnv(process.env.SONG_LOCK_LOW_THRESHOLD, 0.4);

/** Smart Bible Listen server kill switch: set to 'false' to force-disable Smart Listen for all clients. Defaults to true (allow client to enable). */
const BIBLE_SMART_LISTEN_KILL_SWITCH = process.env.BIBLE_SMART_LISTEN_ENABLED === 'false';
/** STT window duration (ms) after wake word. Default 30s. */
const BIBLE_SMART_LISTEN_WINDOW_MS = parseNumberEnv(process.env.BIBLE_SMART_LISTEN_WINDOW_MS, 30000);

function preprocessBufferText(text: string, maxWords?: number): string {
  const limit = Math.max(1, maxWords ?? parseNumberEnv(process.env.MATCHER_PREPROCESS_MAX_WORDS, 22));
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

  const sliced = deduped.slice(-limit);
  return sliced.join(' ');
}

function normalizeMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract last N words from text (for end-of-verse trigger).
 * wordCountOrPercentage: 0–1 = percentage of line, else fixed word count.
 */
function extractEndWordsForVerse(text: string, wordCountOrPercentage: number): string {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const numWords =
    wordCountOrPercentage > 0 && wordCountOrPercentage < 1
      ? Math.max(3, Math.ceil(words.length * wordCountOrPercentage))
      : Math.floor(wordCountOrPercentage);
  const endWords = words.slice(-Math.min(numWords, words.length));
  return endWords.join(' ');
}

/**
 * Adaptive end-of-verse trigger (mirror song end-of-line).
 * Last 3 words (verse ≤6), 4 (≤9), 5 (≤12), or last 40% for longer verses.
 */
function getBibleEndOfVerseTrigger(verseText: string): string {
  const words = verseText.trim().split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;
  if (totalWords <= 6) return extractEndWordsForVerse(verseText, 3);
  if (totalWords <= 9) return extractEndWordsForVerse(verseText, 4);
  if (totalWords <= 12) return extractEndWordsForVerse(verseText, 5);
  return extractEndWordsForVerse(verseText, 0.4);
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
const WS_CONTROL_LIMIT = parseNumberEnv(process.env.WS_RATE_LIMIT_CONTROL, 60);
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
  backgroundImageUrl?: string | null;
  backgroundMediaType?: string | null;
  bibleFollow?: boolean;
  bibleFollowRef?: BibleReference | null;
  bibleFollowHit?: {
    targetKey: string;
    hitCount: number;
    lastHitAt: number;
  };
  bibleFollowCache?: Map<string, { text: string; book: string; chapter: number; verse: number; versionAbbrev: string }>;
  /** Last time we logged that Bible Follow is on but semantic is disabled (avoid log spam). */
  lastBibleSemanticDisabledLogAt?: number;
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
  /** Song lock: while set, only match current song (no other-songs check). Cleared on timer or consecutive low matches. */
  songLockUntil?: number;
  /** Consecutive transcripts with no/low match; when >= threshold we clear song lock and check other songs. */
  consecutiveLowMatchCount?: number;
  // End-trigger debouncing for slide advance
  endTriggerHit?: {
    lineIndex: number;
    lastHitAt: number;
    hitCount: number;
  };
  // Audio chunk tracking for logging
  audioChunkCount?: number; // Track number of audio chunks received (for diagnostic logging)
  // Smart Listen: STT window active until this timestamp (used for non-SONG items when smartListenEnabled)
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

function currentItemType(session: SessionState): 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT' | null {
  const items = session.setlistItems;
  const idx = session.currentItemIndex ?? 0;
  if (!items || idx < 0 || idx >= items.length) return null;
  return items[idx].type;
}

/**
 * Smart Listen gate.
 *
 * Gate is active when:
 *   (1) server kill switch is NOT set
 *   (2) client opted in via smartListenEnabled: true
 *   (3) bibleMode is enabled AND current setlist item is non-SONG (Bible/Media)
 */
function shouldUseSmartListenGate(session: SessionState): boolean {
  if (BIBLE_SMART_LISTEN_KILL_SWITCH) return false; // Server forcibly disabled
  if (session.smartListenEnabled !== true) return false;
  if (session.bibleMode !== true) return false;
  const type = currentItemType(session);
  if (!type || type === 'SONG') return false;
  return true;
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

/**
 * Build the initial DISPLAY_UPDATE for the session's current item/slide.
 * Used so operator and projector show the first slide immediately when session starts.
 */
function buildInitialDisplayUpdate(
  session: SessionState,
  receivedAt: number,
  processingStart: number
): DisplayUpdateMessage | null {
  const timing = createTiming(receivedAt, processingStart);
  const itemIndex = session.currentItemIndex ?? 0;
  const setlistItems = session.setlistItems ?? [];
  const currentItem = setlistItems.length > 0 && itemIndex >= 0 && itemIndex < setlistItems.length
    ? setlistItems[itemIndex]
    : null;

  if (currentItem?.type === 'BIBLE' && currentItem.bibleRef) {
    const placeholderId = `bible:${currentItem.bibleRef.replace(/\s+/g, ':')}`;
    return {
      type: 'DISPLAY_UPDATE',
      payload: {
        lineText: currentItem.bibleRef,
        slideText: currentItem.bibleRef,
        slideLines: [currentItem.bibleRef],
        slideIndex: 0,
        lineIndex: 0,
        songId: placeholderId,
        songTitle: currentItem.bibleRef,
        isAutoAdvance: false,
        currentItemIndex: itemIndex,
      },
      timing,
    };
  }

  if (currentItem?.type === 'SONG' && currentItem.songId) {
    const songIndex = session.songs.findIndex((s) => s.id === currentItem.songId);
    const targetSong = songIndex >= 0 ? session.songs[songIndex] : session.songs[0];
    if (!targetSong) return null;
    const slideIndex = Math.min(session.currentSlideIndex, (targetSong.slides?.length ?? 1) - 1);
    const slide = targetSong.slides?.[slideIndex];
    const slideText = slide?.slideText ?? targetSong.lines?.[slideIndex] ?? targetSong.lines?.[0] ?? '';
    const slideLines = slide?.lines ?? (slideText ? [slideText] : [targetSong.lines?.[0] ?? '']);
    return {
      type: 'DISPLAY_UPDATE',
      payload: {
        lineText: slideLines[0] ?? '',
        slideText,
        slideLines,
        slideIndex,
        lineIndex: slide?.startLineIndex ?? slideIndex,
        songId: targetSong.id,
        songTitle: targetSong.title,
        isAutoAdvance: false,
        currentItemIndex: itemIndex,
      },
      timing,
    };
  }

  if (currentItem?.type === 'MEDIA') {
    const placeholderId = `media:${(currentItem as { mediaUrl?: string }).mediaUrl ?? 'placeholder'}`;
    const mediaUrl = (currentItem as { mediaUrl?: string }).mediaUrl ?? '';
    const urlLower = mediaUrl.toLowerCase();
    const isVideo = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(urlLower);
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(urlLower);
    return {
      type: 'DISPLAY_UPDATE',
      payload: {
        lineText: (currentItem as { mediaTitle?: string }).mediaTitle ?? 'Media',
        slideText: (currentItem as { mediaTitle?: string }).mediaTitle ?? 'Media',
        slideLines: [(currentItem as { mediaTitle?: string }).mediaTitle ?? 'Media'],
        slideIndex: 0,
        lineIndex: 0,
        songId: placeholderId,
        songTitle: (currentItem as { mediaTitle?: string }).mediaTitle ?? 'Media',
        isAutoAdvance: false,
        currentItemIndex: itemIndex,
        slideImageUrl: isImage ? mediaUrl : undefined,
        slideVideoUrl: isVideo ? mediaUrl : undefined,
        displayType: isVideo ? 'video' : isImage ? 'image' : 'lyrics',
      },
      timing,
    };
  }

  if (currentItem?.type === 'ANNOUNCEMENT' && (currentItem as { announcementSlides?: unknown[] }).announcementSlides?.length) {
    const slides = (currentItem as { announcementSlides: AnnouncementSlide[] }).announcementSlides;
    const slide = slides[0];
    const placeholderId = `announcement:${(currentItem as { id?: string }).id}`;
    return {
      type: 'DISPLAY_UPDATE',
      payload: buildAnnouncementPayload(slide, placeholderId, 0, itemIndex, false),
      timing,
    };
  }

  // Fallback: no setlistItems or unknown type — use first song, first slide
  const firstSong = session.songs[0];
  if (!firstSong) return null;
  const slideText = firstSong.slides?.[0]?.slideText ?? firstSong.lines?.[0] ?? '';
  const slideLines = firstSong.slides?.[0]?.lines ?? [slideText];
  return {
    type: 'DISPLAY_UPDATE',
    payload: {
      lineText: slideLines[0] ?? '',
      slideText,
      slideLines,
      slideIndex: 0,
      lineIndex: 0,
      songId: firstSong.id,
      songTitle: firstSong.title,
      isAutoAdvance: false,
      currentItemIndex: 0,
    },
    timing,
  };
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

/** Clear sttStream for every session that shares this stream (same eventId). Prevents stuck state when stream ends/errors. */
function clearSttStreamForAllWithStream(
  eventId: string,
  stream: ReturnType<typeof createStreamingRecognition> | undefined
): void {
  if (!stream) return;
  for (const [, s] of sessions.entries()) {
    if (s.eventId === eventId && s.sttStream === stream) {
      s.sttStream = undefined;
    }
  }
}

function initElevenLabsStream(session: SessionState, ws: WebSocket): void {
  const stream = createStreamingRecognition();
  const eventId = session.eventId;
  stream.on('data', (result: { text: string; isFinal: boolean; confidence: number }) => {
    const processingStart = Date.now();
    const receivedAtNow = Date.now();
    void handleTranscriptionResult(ws, session, result, receivedAtNow, processingStart).catch((error) => {
      console.error('[WS] Error handling transcription result:', error);
    });
  });
  stream.on('error', (error: Error) => {
    console.error('[STT] ❌ ElevenLabs stream error:', error);
    clearSttStreamForAllWithStream(eventId, stream);
    sendError(ws, 'STT_ERROR', 'ElevenLabs stream error', { message: error.message });
  });
  stream.on('end', () => {
    console.log('[STT] ElevenLabs stream ended');
    clearSttStreamForAllWithStream(eventId, stream);
  });
  session.sttStream = stream;
  console.log('[STT] ✅ ElevenLabs stream initialized');
}

function restartElevenLabsStream(session: SessionState, ws: WebSocket, reason: string): void {
  const stream = session.sttStream;
  const eventId = session.eventId;
  clearSttStreamForAllWithStream(eventId, stream);
  if (stream) {
    try {
      stream.end();
    } catch (error) {
      console.warn('[STT] ⚠️ Failed to end ElevenLabs stream cleanly:', error);
    }
  }
  session.lastSttRestartAt = Date.now();
  console.warn(`[STT] 🔄 Restarting ElevenLabs stream (${reason})`);
  initElevenLabsStream(session, ws);
}

function initGoogleStream(session: SessionState, ws: WebSocket): void {
  const stream = createStreamingRecognition();
  const eventId = session.eventId;
  stream.on('data', (result: { text: string; isFinal: boolean; confidence: number }) => {
    const processingStart = Date.now();
    const receivedAtNow = Date.now();
    void handleTranscriptionResult(ws, session, result, receivedAtNow, processingStart).catch((error) => {
      console.error('[WS] Error handling transcription result:', error);
    });
  });
  stream.on('error', (error: Error) => {
    console.error('[STT] ❌ Google stream error:', error);
    clearSttStreamForAllWithStream(eventId, stream);
    sendError(ws, 'STT_ERROR', 'Google Cloud stream error', { message: error.message });
  });
  stream.on('end', () => {
    console.log('[STT] Google stream ended');
    clearSttStreamForAllWithStream(eventId, stream);
  });
  session.sttStream = stream;
  console.log('[STT] ✅ Google Cloud streaming initialized');
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
    console.error(`[WS] Failed to fetch event data for ${eventId} (check Supabase URL/service role key and RLS)`);
    sendError(ws, 'EVENT_NOT_FOUND', `Event not found or backend could not load it. Check that the backend has the correct Supabase URL and service role key.`, { eventId });
    return;
  }

  console.log(`[WS] Fetched event "${eventData.name}" with ${eventData.songs.length} songs`);

  if (eventData.songs.length === 0) {
    console.warn(`[WS] Event ${eventId} has no songs in setlist`);
    sendError(ws, 'EMPTY_SETLIST', 'Event has no songs in setlist. Please add songs to the event before starting a session.', { eventId });
    return;
  }

  const sessionId = `session_${Date.now()}`;
  
  // Initialize matcher configuration - tuned for production reliability
  const matcherConfig: MatcherConfig = validateConfig({
    similarityThreshold: parseNumberEnv(process.env.MATCHER_SIMILARITY_THRESHOLD, 0.55),
    minBufferLength: parseNumberEnv(process.env.MATCHER_MIN_BUFFER_LENGTH, 2),
    bufferWindow: parseNumberEnv(process.env.MATCHER_BUFFER_WINDOW, 100),
    debug: process.env.DEBUG_MATCHER === 'true' || process.env.NODE_ENV !== 'production',
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
  // Clamp to valid line range (prevents matcher crash when index >= lines.length)
  const currentLineCount = currentSong?.lines?.length ?? 0;
  if (currentLineCount > 0 && currentLineIndex >= currentLineCount) {
    currentLineIndex = currentLineCount - 1;
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
    backgroundImageUrl: existingSession?.backgroundImageUrl ?? eventData.backgroundImageUrl ?? null,
    backgroundMediaType: existingSession?.backgroundMediaType ?? eventData.backgroundMediaType ?? null,
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

  // Log STT configuration for debugging
  console.log(`[WS] STT Provider: ${sttProvider}, Configured: ${sttProvider === 'elevenlabs' ? isElevenLabsConfigured : 'N/A'}`);
  if (sttProvider === 'elevenlabs' && !isElevenLabsConfigured) {
    console.warn('[WS] ⚠️  ElevenLabs selected but ELEVENLABS_API_KEY not set in backend/.env');
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
      backgroundImageUrl: session.backgroundImageUrl ?? null,
      backgroundMediaType: session.backgroundMediaType ?? null,
      bibleFollow: session.bibleFollow ?? false,
      totalSongs: session.songs.length,
      currentSongIndex,
      currentItemIndex: session.currentItemIndex,
      currentSlideIndex,
      setlist: setlistPayload,
      setlistItems: session.setlistItems,
      initialDisplay: undefined,
    },
    timing: createTiming(receivedAt, processingStart),
  };

  send(ws, response);

  // Send initial DISPLAY_UPDATE so operator and projector show first slide immediately (no "Waiting for session to start").
  const initialDisplay = buildInitialDisplayUpdate(session, receivedAt, processingStart);
  if (initialDisplay) {
    broadcastToEvent(session.eventId, initialDisplay);
  }

  console.log(`[WS] Session started: ${sessionId} with ${session.songs.length} songs (synced to song ${currentSongIndex}, slide ${currentSlideIndex})`);
}

/**
 * Handle UPDATE_EVENT_SETTINGS message
 * Broadcasts updated settings to all clients
 */
function handleUpdateEventSettings(
  ws: WebSocket,
  settings: { projectorFont?: string; bibleMode?: boolean; bibleVersionId?: string | null; bibleFollow?: boolean; smartListenEnabled?: boolean; backgroundImageUrl?: string | null; backgroundMediaType?: string | null },
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
  if (settings.backgroundImageUrl !== undefined) {
    session.backgroundImageUrl = settings.backgroundImageUrl;
  }
  if (settings.backgroundMediaType !== undefined) {
    session.backgroundMediaType = settings.backgroundMediaType;
  }
  if (settings.smartListenEnabled !== undefined) {
    session.smartListenEnabled = settings.smartListenEnabled;
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
      backgroundImageUrl: session.backgroundImageUrl ?? null,
      backgroundMediaType: session.backgroundMediaType ?? null,
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
            currentItemIndex: session.currentItemIndex,
          },
          timing: createTiming(receivedAt, processingStart),
        };
        broadcastToEvent(session.eventId, displayMsg);
      }
    }
  }
}

/** Runs Bible path in background so song matching is never blocked. */
async function runBiblePathAsync(
  session: SessionState,
  transcriptionResult: { text: string; isFinal: boolean; confidence: number },
  receivedAt: number,
  processingStart: number,
  cleanedBuffer: string,
  logTiming: (label: string, extra?: string) => void
): Promise<void> {
  const biblePathStart = Date.now();
  const versionCommand = detectBibleVersionCommand(transcriptionResult.text);
  if (versionCommand) {
    const versionId = await getBibleVersionIdByAbbrev(versionCommand);
    if (versionId) {
      session.bibleVersionId = versionId;
      const supabase = getSupabaseClient();
      if (isSupabaseConfigured() && supabase) {
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
          backgroundImageUrl: session.backgroundImageUrl ?? null,
          backgroundMediaType: session.backgroundMediaType ?? null,
        },
        timing: createTiming(receivedAt, processingStart),
      };
      broadcastToEvent(session.eventId, settingsMessage);
    }
    logTiming('bible path (version)', `bibleMs=${Date.now() - biblePathStart}`);
    return;
  }
  let reference =
    findBibleReference(transcriptionResult.text) ?? findBibleReference(cleanedBuffer);
  if (!reference && isBibleSemanticFollowEnabled()) {
    const versionId = session.bibleVersionId ?? (await getDefaultBibleVersionId());
    const bufferWordCount = normalizeMatchText(cleanedBuffer).split(/\s+/).filter(Boolean).length;
    if (versionId && bufferWordCount >= 6) {
      const stopwords = new Set([
        'the', 'is', 'my', 'i', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'it', 'that', 'for',
        'we', 'you', 'he', 'she', 'they', 'when', 'what', 'anything', 'everything', 'wont',
        'will', 'shall', 'not', 'no', 'so', 'but', 'if', 'with', 'at', 'on', 'be', 'have',
        'has', 'had', 'do', 'does', 'did', 'this', 'these', 'those', 'am', 'are', 'was', 'were',
      ]);
      const words = normalizeMatchText(cleanedBuffer)
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !stopwords.has(w.toLowerCase()))
        .slice(0, 10);
      const candidateRows = await searchVerseCandidatesByWords(versionId, words, 80);
      if (candidateRows.length === 0) {
        const fallbackRefs: Array<{ book: string; chapter: number; verse: number }> = [
          { book: 'Psalms', chapter: 23, verse: 1 }, { book: 'John', chapter: 3, verse: 16 },
          { book: 'Romans', chapter: 8, verse: 28 }, { book: 'Philippians', chapter: 4, verse: 13 },
          { book: 'Proverbs', chapter: 3, verse: 5 }, { book: 'Psalms', chapter: 91, verse: 1 },
          { book: 'Matthew', chapter: 11, verse: 28 }, { book: 'Isaiah', chapter: 41, verse: 10 },
          { book: 'Jeremiah', chapter: 29, verse: 11 }, { book: 'Psalms', chapter: 46, verse: 1 },
          { book: 'Genesis', chapter: 1, verse: 1 }, { book: 'Psalms', chapter: 119, verse: 105 },
          { book: 'Matthew', chapter: 28, verse: 19 }, { book: 'John', chapter: 1, verse: 1 },
          { book: 'Psalms', chapter: 4, verse: 1 },
        ];
        for (const ref of fallbackRefs) {
          const verse = await getBibleVerseCached(session, ref, versionId);
          if (verse?.text) {
            candidateRows.push({ book: ref.book, chapter: ref.chapter, verse: ref.verse, text: verse.text });
          }
        }
      }
      const candidates = candidateRows.map((r) => ({ ref: { book: r.book, chapter: r.chapter, verse: r.verse }, text: r.text }));
      if (candidates.length > 0) {
        const found = await findVerseByContent(cleanedBuffer, candidates, BIBLE_JUMP_BY_CONTENT_MIN_SCORE);
        if (found) {
          reference = found.ref;
          console.log(`[WS] Bible: verse-by-content match "${found.ref.book} ${found.ref.chapter}:${found.ref.verse}" (score ${(found.score * 100).toFixed(1)}%)`);
        }
      }
    }
  }
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
    if (!verse) return;
    const refKey = `${verse.book}:${verse.chapter}:${verse.verse}:${verse.versionAbbrev}`;
    const now = Date.now();
    if (session.lastBibleRefKey === refKey && session.lastBibleRefAt && now - session.lastBibleRefAt < 2500) return;
    session.lastBibleRefKey = refKey;
    session.lastBibleRefAt = now;
    session.bibleFollow = true;
    session.bibleFollowRef = reference;
    session.bibleFollowHit = undefined;
    const verseLines = wrapBibleText(verse.text);
    const verseTitle = `${verse.book} ${verse.chapter}:${verse.verse} • ${verse.versionAbbrev}`;
    let nextVerseText: string | undefined;
    let nextVerseRef: string | undefined;
    const nextRefOpen: BibleReference = { book: reference.book, chapter: reference.chapter, verse: reference.verse + 1 };
    const nextVerseOpen = await getBibleVerseCached(session, nextRefOpen, session.bibleVersionId);
    if (nextVerseOpen?.text) {
      nextVerseText = nextVerseOpen.text;
      nextVerseRef = `${nextVerseOpen.book} ${nextVerseOpen.chapter}:${nextVerseOpen.verse}`;
    } else {
      const nextChRef: BibleReference = { book: reference.book, chapter: reference.chapter + 1, verse: 1 };
      const nextChVerse = await getBibleVerseCached(session, nextChRef, session.bibleVersionId);
      if (nextChVerse?.text) {
        nextVerseText = nextChVerse.text;
        nextVerseRef = `${nextChVerse.book} ${nextChVerse.chapter}:${nextChVerse.verse}`;
      }
    }
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
        currentItemIndex: session.currentItemIndex,
        nextVerseText,
        nextVerseRef,
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
        backgroundImageUrl: session.backgroundImageUrl ?? null,
        backgroundMediaType: session.backgroundMediaType ?? null,
      },
      timing: createTiming(receivedAt, processingStart),
    };
    broadcastToEvent(session.eventId, settingsMessage);
    logTiming('bible path (ref)', `bibleMs=${Date.now() - biblePathStart}`);
    return;
  }
  if (!session.bibleFollow || !session.bibleFollowRef) return;
  if (!session.bibleVersionId) {
    const fallbackVersionId = await getDefaultBibleVersionId();
    if (fallbackVersionId) session.bibleVersionId = fallbackVersionId;
    else {
      console.warn('[WS] Bible mode active but no bibleVersionId set.');
      return;
    }
  }
  const normalizedBuffer = normalizeMatchText(cleanedBuffer);
  const bufferWordCount = normalizedBuffer.split(/\s+/).filter(Boolean).length;
  if (bufferWordCount < BIBLE_FOLLOW_MIN_WORDS) {
    logTiming('bible path (min words)', `bibleMs=${Date.now() - biblePathStart}`);
    return;
  }
  const followRef = session.bibleFollowRef;
  const followEndVerse = followRef.endVerse ?? null;
  if (followEndVerse !== null && followRef.verse >= followEndVerse) {
    logTiming('bible path (end verse)', `bibleMs=${Date.now() - biblePathStart}`);
    return;
  }
  const currentVerse = await getBibleVerseCached(session, followRef, session.bibleVersionId);
  if (!currentVerse) {
    logTiming('bible path (no verse)', `bibleMs=${Date.now() - biblePathStart}`);
    return;
  }
  if (!isBibleSemanticFollowEnabled()) {
    const now = Date.now();
    if (session.lastBibleSemanticDisabledLogAt == null || now - session.lastBibleSemanticDisabledLogAt > 60000) {
      console.log('[WS] Bible Follow active but semantic disabled (in-chapter/cross-chapter jump requires BIBLE_SEMANTIC_FOLLOW_ENABLED=true and API key)');
      session.lastBibleSemanticDisabledLogAt = now;
    }
  }
  if (isBibleSemanticFollowEnabled() && bufferWordCount >= 6 && session.bibleVersionId) {
    const stopwords = new Set([
      'the', 'is', 'my', 'i', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'it', 'that', 'for',
      'we', 'you', 'he', 'she', 'they', 'when', 'what', 'anything', 'everything', 'wont',
      'will', 'shall', 'not', 'no', 'so', 'but', 'if', 'with', 'at', 'on', 'be', 'have',
      'has', 'had', 'do', 'does', 'did', 'this', 'these', 'those', 'am', 'are', 'was', 'were',
    ]);
    const words = normalizedBuffer.split(/\s+/).filter((w) => w.length >= 2 && !stopwords.has(w.toLowerCase())).slice(0, 10);
    const crossCandidateRows = await searchVerseCandidatesByWords(session.bibleVersionId, words, 80);
    const crossCandidates = crossCandidateRows.map((r) => ({ ref: { book: r.book, chapter: r.chapter, verse: r.verse }, text: r.text }));
    if (crossCandidates.length > 0) {
      const crossFound = await findVerseByContent(normalizedBuffer, crossCandidates, BIBLE_JUMP_BY_CONTENT_MIN_SCORE);
      const isDifferentVerse = crossFound && (crossFound.ref.book !== followRef.book || crossFound.ref.chapter !== followRef.chapter || crossFound.ref.verse !== followRef.verse);
      if (isDifferentVerse && crossFound) {
        const crossRef: BibleReference = { book: crossFound.ref.book, chapter: crossFound.ref.chapter, verse: crossFound.ref.verse };
        const now = Date.now();
        const targetKey = buildBibleRefKey(crossRef, session.bibleVersionId);
        if (session.bibleFollowHit?.targetKey === targetKey && now - session.bibleFollowHit.lastHitAt <= BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) {
          session.bibleFollowHit.hitCount += 1;
          session.bibleFollowHit.lastHitAt = now;
        } else {
          session.bibleFollowHit = { targetKey, hitCount: 1, lastHitAt: now };
        }
        if (session.bibleFollowHit.hitCount >= BIBLE_FOLLOW_DEBOUNCE_MATCHES) {
          session.bibleFollowHit = undefined;
          session.bibleFollowRef = crossRef;
          const crossVerse = await getBibleVerseCached(session, crossRef, session.bibleVersionId);
          if (crossVerse) {
            const verseLines = wrapBibleText(crossVerse.text);
            const verseTitle = `${crossVerse.book} ${crossVerse.chapter}:${crossVerse.verse} • ${crossVerse.versionAbbrev}`;
            broadcastToEvent(session.eventId, {
              type: 'DISPLAY_UPDATE',
              payload: {
                lineText: verseLines[0] ?? crossVerse.text,
                slideText: verseLines.join('\n'),
                slideLines: verseLines,
                slideIndex: 0,
                songId: `bible:${crossVerse.book}:${crossVerse.chapter}:${crossVerse.verse}`,
                songTitle: verseTitle,
                isAutoAdvance: true,
                currentItemIndex: session.currentItemIndex,
              },
              timing: createTiming(receivedAt, processingStart),
            });
            session.lastBibleRefKey = `${crossVerse.book}:${crossVerse.chapter}:${crossVerse.verse}:${crossVerse.versionAbbrev}`;
            session.lastBibleRefAt = now;
            console.log(`[WS] Bible: cross-chapter jump to ${crossVerse.book} ${crossVerse.chapter}:${crossVerse.verse} (score ${(crossFound.score * 100).toFixed(1)}%)`);
          }
          logTiming('bible path (cross-chapter)', `bibleMs=${Date.now() - biblePathStart}`);
          return;
        }
      } else if (session.bibleFollowHit && Date.now() - session.bibleFollowHit.lastHitAt > BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) {
        session.bibleFollowHit = undefined;
      }
    }
  }
  const endVerseNum = followEndVerse !== null ? followEndVerse : followRef.verse + 19;
  if (isBibleSemanticFollowEnabled() && endVerseNum > followRef.verse) {
    const passageCandidates: Array<{ ref: { book: string; chapter: number; verse: number }; text: string }> = [];
    for (let v = followRef.verse; v <= endVerseNum; v++) {
      const ref: BibleReference = { book: followRef.book, chapter: followRef.chapter, verse: v };
      const verse = await getBibleVerseCached(session, ref, session.bibleVersionId);
      if (verse?.text) passageCandidates.push({ ref: { book: verse.book, chapter: verse.chapter, verse: verse.verse }, text: verse.text });
    }
    if (passageCandidates.length > 1) {
      const jumpFound = await findVerseByContent(normalizedBuffer, passageCandidates, BIBLE_JUMP_BY_CONTENT_MIN_SCORE);
      const now = Date.now();
      if (jumpFound && jumpFound.ref.verse !== followRef.verse && jumpFound.ref.book === followRef.book && jumpFound.ref.chapter === followRef.chapter) {
        const jumpRef: BibleReference = { book: followRef.book, chapter: followRef.chapter, verse: jumpFound.ref.verse, endVerse: followEndVerse ?? undefined };
        const targetKey = buildBibleRefKey(jumpRef, session.bibleVersionId);
        if (session.bibleFollowHit?.targetKey === targetKey && now - session.bibleFollowHit.lastHitAt <= BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) {
          session.bibleFollowHit.hitCount += 1;
          session.bibleFollowHit.lastHitAt = now;
        } else {
          session.bibleFollowHit = { targetKey, hitCount: 1, lastHitAt: now };
        }
        if (session.bibleFollowHit.hitCount >= BIBLE_FOLLOW_DEBOUNCE_MATCHES) {
          session.bibleFollowHit = undefined;
          session.bibleFollowRef = { ...jumpRef, endVerse: followEndVerse ?? undefined };
          const jumpVerse = await getBibleVerseCached(session, jumpRef, session.bibleVersionId);
          if (jumpVerse) {
            const verseLines = wrapBibleText(jumpVerse.text);
            const verseTitle = `${jumpVerse.book} ${jumpVerse.chapter}:${jumpVerse.verse} • ${jumpVerse.versionAbbrev}`;
            broadcastToEvent(session.eventId, {
              type: 'DISPLAY_UPDATE',
              payload: {
                lineText: verseLines[0] ?? jumpVerse.text,
                slideText: verseLines.join('\n'),
                slideLines: verseLines,
                slideIndex: 0,
                songId: `bible:${jumpVerse.book}:${jumpVerse.chapter}:${jumpVerse.verse}`,
                songTitle: verseTitle,
                isAutoAdvance: true,
                currentItemIndex: session.currentItemIndex,
              },
              timing: createTiming(receivedAt, processingStart),
            });
            session.lastBibleRefKey = `${jumpVerse.book}:${jumpVerse.chapter}:${jumpVerse.verse}:${jumpVerse.versionAbbrev}`;
            session.lastBibleRefAt = now;
            console.log(`[WS] Bible: jump within passage to ${jumpVerse.book} ${jumpVerse.chapter}:${jumpVerse.verse} (score ${(jumpFound.score * 100).toFixed(1)}%)`);
          }
          logTiming('bible path (in-passage)', `bibleMs=${Date.now() - biblePathStart}`);
          return;
        }
      } else if (session.bibleFollowHit && now - session.bibleFollowHit.lastHitAt > BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) {
        session.bibleFollowHit = undefined;
      }
    }
  }
  let nextRef: BibleReference = { book: followRef.book, chapter: followRef.chapter, verse: followRef.verse + 1 };
  if (followEndVerse !== null && nextRef.verse > followEndVerse && nextRef.chapter === followRef.chapter) {
    logTiming('bible path (next ref)', `bibleMs=${Date.now() - biblePathStart}`);
    return;
  }
  let nextVerse = await getBibleVerseCached(session, nextRef, session.bibleVersionId);
  if (!nextVerse) {
    if (followEndVerse !== null) {
      logTiming('bible path (no next)', `bibleMs=${Date.now() - biblePathStart}`);
      return;
    }
    const nextChapterRef: BibleReference = { book: followRef.book, chapter: followRef.chapter + 1, verse: 1 };
    nextVerse = await getBibleVerseCached(session, nextChapterRef, session.bibleVersionId);
    if (!nextVerse) {
      logTiming('bible path (no next ch)', `bibleMs=${Date.now() - biblePathStart}`);
      return;
    }
    nextRef = nextChapterRef;
  }
  const bufferWords = normalizedBuffer.split(/\s+/).filter(Boolean);
  const bufferTail = bufferWords.length >= BIBLE_END_OF_VERSE_BUFFER_WORDS ? bufferWords.slice(-BIBLE_END_OF_VERSE_BUFFER_WORDS).join(' ') : normalizedBuffer;
  const verseEndTrigger = getBibleEndOfVerseTrigger(currentVerse.text);
  const endOfVerseScore = compareTwoStrings(normalizeMatchText(bufferTail), normalizeMatchText(verseEndTrigger));
  const inScopeEndOfVerse = endOfVerseScore >= BIBLE_END_OF_VERSE_TRIGGER_THRESHOLD;
  const requiredMatches = inScopeEndOfVerse ? 1 : BIBLE_FOLLOW_DEBOUNCE_MATCHES;
  let currentScore: number;
  let nextScore: number;
  if (isBibleSemanticFollowEnabled()) {
    const semantic = await getBibleFollowSemanticScores(normalizedBuffer, currentVerse.text, nextVerse.text);
    if (semantic) {
      currentScore = semantic.currentScore;
      nextScore = semantic.nextScore;
    } else {
      currentScore = getMatchScore(normalizedBuffer, currentVerse.text);
      nextScore = getMatchScore(normalizedBuffer, nextVerse.text);
    }
  } else {
    currentScore = getMatchScore(normalizedBuffer, currentVerse.text);
    nextScore = getMatchScore(normalizedBuffer, nextVerse.text);
  }
  const advanceThresholdMet = inScopeEndOfVerse
    ? nextScore >= BIBLE_END_OF_VERSE_NEXT_THRESHOLD
    : nextScore >= BIBLE_FOLLOW_MATCH_THRESHOLD && nextScore >= currentScore + BIBLE_FOLLOW_MATCH_MARGIN;
  if (advanceThresholdMet) {
    const now = Date.now();
    const targetKey = buildBibleRefKey(nextRef, session.bibleVersionId);
    if (session.bibleFollowHit?.targetKey === targetKey && now - session.bibleFollowHit.lastHitAt <= BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) {
      session.bibleFollowHit.hitCount += 1;
      session.bibleFollowHit.lastHitAt = now;
    } else {
      session.bibleFollowHit = { targetKey, hitCount: 1, lastHitAt: now };
    }
    if (session.bibleFollowHit.hitCount >= requiredMatches) {
      session.bibleFollowHit = undefined;
      const nextEndVerse = followEndVerse !== null && nextRef.chapter === followRef.chapter ? followEndVerse : null;
      session.bibleFollowRef = { ...nextRef, endVerse: nextEndVerse };
      session.bibleFollow = true;
      const refKey = `${nextVerse.book}:${nextVerse.chapter}:${nextVerse.verse}:${nextVerse.versionAbbrev}`;
      session.lastBibleRefKey = refKey;
      session.lastBibleRefAt = now;
      const verseLines = wrapBibleText(nextVerse.text);
      const verseTitle = `${nextVerse.book} ${nextVerse.chapter}:${nextVerse.verse} • ${nextVerse.versionAbbrev}`;
      let nextVersePreviewText: string | undefined;
      let nextVersePreviewRef: string | undefined;
      const nextNextRef: BibleReference = { book: nextVerse.book, chapter: nextVerse.chapter, verse: nextVerse.verse + 1 };
      const nextNextVerse = await getBibleVerseCached(session, nextNextRef, session.bibleVersionId);
      if (nextNextVerse?.text) {
        nextVersePreviewText = nextNextVerse.text;
        nextVersePreviewRef = `${nextNextVerse.book} ${nextNextVerse.chapter}:${nextNextVerse.verse}`;
      } else {
        const nextNextCh: BibleReference = { book: nextVerse.book, chapter: nextVerse.chapter + 1, verse: 1 };
        const nextNextChVerse = await getBibleVerseCached(session, nextNextCh, session.bibleVersionId);
        if (nextNextChVerse?.text) {
          nextVersePreviewText = nextNextChVerse.text;
          nextVersePreviewRef = `${nextNextChVerse.book} ${nextNextChVerse.chapter}:${nextNextChVerse.verse}`;
        }
      }
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
          currentItemIndex: session.currentItemIndex,
          nextVerseText: nextVersePreviewText,
          nextVerseRef: nextVersePreviewRef,
        },
        timing: createTiming(receivedAt, processingStart),
      };
      broadcastToEvent(session.eventId, displayMsg);
      if (inScopeEndOfVerse) {
        console.log(`[WS] Bible: end-of-verse advance to ${nextVerse.book} ${nextVerse.chapter}:${nextVerse.verse} (trigger ${(endOfVerseScore * 100).toFixed(0)}%)`);
      }
      session.rollingBuffer = '';
    }
  } else if (session.bibleFollowHit) {
    const now = Date.now();
    if (now - session.bibleFollowHit.lastHitAt > BIBLE_FOLLOW_DEBOUNCE_WINDOW_MS) session.bibleFollowHit = undefined;
  }
  logTiming('bible path (follow)', `bibleMs=${Date.now() - biblePathStart}`);
}

async function handleTranscriptionResult(
  ws: WebSocket,
  session: SessionState,
  transcriptionResult: { text: string; isFinal: boolean; confidence: number },
  receivedAt: number,
  processingStart: number
): Promise<void> {
  const handleStart = Date.now();
  const logTiming = (label: string, extra?: string) => {
    const total = Date.now() - handleStart;
    console.log(`[WS] ⏱️ handleTranscriptionResult ${label} total=${total}ms${extra ? ` ${extra}` : ''}`);
  };

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
      // ElevenLabs sends cumulative transcripts - keep last N chars for matching
      session.rollingBuffer = matchText.length > ROLLING_BUFFER_MAX_CHARS
        ? matchText.slice(-ROLLING_BUFFER_MAX_CHARS)
        : matchText;
    } else {
      // Other providers send deltas - append then cap
      session.rollingBuffer += ' ' + matchText;
      const words = session.rollingBuffer.split(' ');
      if (words.length > 100) {
        session.rollingBuffer = words.slice(-100).join(' ');
      }
      if (session.rollingBuffer.length > ROLLING_BUFFER_MAX_CHARS) {
        session.rollingBuffer = session.rollingBuffer.slice(-ROLLING_BUFFER_MAX_CHARS);
      }
    }

    const cleanedBuffer = preprocessBufferText(session.rollingBuffer);
    
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

    // Strict Bible vs Song: only one path per transcript
    const itemType = currentItemType(session);
    if (itemType === 'BIBLE') {
      if (session.bibleMode) {
        void runBiblePathAsync(session, transcriptionResult, receivedAt, processingStart, cleanedBuffer, logTiming).catch((err) => {
          console.error('[WS] Bible path error:', err);
        });
      }
      return; // On Bible item: only Bible path; skip song matching
    }
    // Bible mode on but current item is song: if transcript contains a verse reference, run Bible path so verse shows
    const bibleRefInTranscript = findBibleReference(trimmedText) ?? findBibleReference(cleanedBuffer);
    if (session.bibleMode && bibleRefInTranscript) {
      void runBiblePathAsync(session, transcriptionResult, receivedAt, processingStart, cleanedBuffer, logTiming).catch((err) => {
        console.error('[WS] Bible path error:', err);
      });
      return;
    }

    if (!session.songContext) {
      console.log(`[WS] ⚠️  Skipping match: no songContext for session`);
      return;
    }

    // Song/Media/Announcement: only song matching (no Bible path)
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

        const now = Date.now();
        const lockActive = session.songLockUntil != null && now < session.songLockUntil;

        let multiSongResult: MultiSongMatchResult;
        if (lockActive) {
          // Song lock: only match current song (no other-songs check) to cut latency
          const matchStart = Date.now();
          const currentMatch = findBestMatch(cleanedBuffer, session.songContext, matcherConfig);
          const matchMs = Date.now() - matchStart;
          console.log(`[WS] ⏱️ findBestMatch (song lock) took ${matchMs}ms`);
          multiSongResult = { currentSongMatch: currentMatch };
        } else {
          // PHASE 1: Multi-song matching with debouncing
          const matchStart = Date.now();
          multiSongResult = findBestMatchAcrossAllSongs(
            cleanedBuffer,
            session.songContext,
            session.songs,
            session.currentSongIndex,
            matcherConfig
          );
          const matchMs = Date.now() - matchStart;
          console.log(`[WS] ⏱️ findBestMatchAcrossAllSongs took ${matchMs}ms`);
        }

        const matchResult = multiSongResult.currentSongMatch;
        session.lastMatchConfidence = matchResult.confidence;
        if (session.allowBackwardUntil && matchResult.matchFound) {
          session.allowBackwardUntil = undefined;
        }

        // Update song lock state: clear lock after consecutive low matches so we check other songs
        if (session.songLockUntil != null && now >= session.songLockUntil) {
          session.songLockUntil = undefined;
        }
        const isLowMatch = !matchResult.matchFound || matchResult.confidence < SONG_LOCK_LOW_THRESHOLD;
        if (isLowMatch) {
          session.consecutiveLowMatchCount = (session.consecutiveLowMatchCount ?? 0) + 1;
          if ((session.consecutiveLowMatchCount ?? 0) >= SONG_LOCK_CONSECUTIVE_LOW) {
            session.songLockUntil = undefined;
            session.consecutiveLowMatchCount = 0;
            if (session.matcherConfig.debug) {
              console.log('[WS] Song lock cleared (consecutive low matches)');
            }
          }
        } else {
          session.consecutiveLowMatchCount = 0;
        }

        // Always log match result for debugging
        console.log(`[WS] 📊 Current song match: found=${matchResult.matchFound}, confidence=${(matchResult.confidence * 100).toFixed(1)}%`);
        if (matchResult.matchFound) {
          console.log(`[WS] 📊 Matched line ${matchResult.currentLineIndex}: "${matchResult.matchedText}"`);
        }

        // PHASE 1: Handle song switch suggestions with debouncing
        const SONG_SWITCH_COOLDOWN_MS = 3000; // 3 seconds cooldown after any song switch
        const SONG_SWITCH_DEBOUNCE_MATCHES = 2; // Require 2 consecutive matches before switching

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
              // Update currentItemIndex to match the setlist item for this song
              const setlistItems = session.setlistItems ?? [];
              const itemIdx = setlistItems.findIndex((i) => i.type === 'SONG' && i.songId === suggestion.songId);
              if (itemIdx >= 0) session.currentItemIndex = itemIdx;
              session.songContext = createSongContext(
                { id: suggestion.songId, sequence_order: suggestion.songIndex + 1 },
                session.songs[suggestion.songIndex],
                suggestion.matchedLineIndex
              );
              session.rollingBuffer = ''; // Clear buffer on song change
              session.lastSongSwitchAt = now;
              session.lastStrongMatchAt = now;
              session.suggestedSongSwitch = undefined; // Clear suggestion
              session.songLockUntil = now + SONG_LOCK_MS;
              session.consecutiveLowMatchCount = 0;

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
                  currentItemIndex: session.currentItemIndex,
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

        // RECOVERY SWITCH: When no match for a long time (recovery mode) and user is likely singing
        // a different song from the start (e.g. played "Praise" from Spotify without clicking setlist),
        // switch to the song that has the best match on an early line so slides can appear.
        const inRecovery = session.allowBackwardUntil !== undefined && Date.now() < session.allowBackwardUntil;
        const RECOVERY_SWITCH_MIN_CONFIDENCE = 0.22; // Lower threshold when we've had no match for 12s+
        const RECOVERY_SWITCH_MAX_LINE_INDEX = 3; // Only switch if best match is near start of song (line 0-3)
        const noCurrentMatch = !matchResult.matchFound || matchResult.confidence < 0.3;
        const bestOther = multiSongResult.bestOtherSong;
        const recoverySwitchOk =
          inRecovery &&
          noCurrentMatch &&
          bestOther &&
          bestOther.confidence >= RECOVERY_SWITCH_MIN_CONFIDENCE &&
          bestOther.lineIndex <= RECOVERY_SWITCH_MAX_LINE_INDEX &&
          session.isAutoFollowing &&
          (!session.lastSongSwitchAt || now - session.lastSongSwitchAt >= SONG_SWITCH_COOLDOWN_MS);

        if (recoverySwitchOk) {
          const suggestion = bestOther;
          const switchedSong = session.songs[suggestion.songIndex];
          const recoverySlideIndex =
            switchedSong.lineToSlideIndex && suggestion.lineIndex < switchedSong.lineToSlideIndex.length
              ? switchedSong.lineToSlideIndex[suggestion.lineIndex]
              : suggestion.lineIndex;
          console.log(
            `[WS] 🔄 RECOVERY SWITCH to "${suggestion.songTitle}" (line ${suggestion.lineIndex} → slide ${recoverySlideIndex}) @ ${(suggestion.confidence * 100).toFixed(1)}% - no match for long time`
          );
          session.currentSongIndex = suggestion.songIndex;
          session.currentSlideIndex = recoverySlideIndex;
          session.currentLineIndex = suggestion.lineIndex;
          const setlistItems = session.setlistItems ?? [];
          const itemIdx = setlistItems.findIndex((i) => i.type === 'SONG' && i.songId === suggestion.songId);
          if (itemIdx >= 0) session.currentItemIndex = itemIdx;
          session.songContext = createSongContext(
            { id: suggestion.songId, sequence_order: suggestion.songIndex + 1 },
            session.songs[suggestion.songIndex],
            suggestion.lineIndex
          );
          session.rollingBuffer = '';
          session.lastSongSwitchAt = now;
          session.lastStrongMatchAt = now;
          session.allowBackwardUntil = undefined;
          session.suggestedSongSwitch = undefined;
          session.songLockUntil = now + SONG_LOCK_MS;
          session.consecutiveLowMatchCount = 0;

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

          let slideLines: string[];
          let slideText: string;
          if (switchedSong.slides && recoverySlideIndex < switchedSong.slides.length) {
            const slide = switchedSong.slides[recoverySlideIndex];
            slideLines = slide.lines;
            slideText = slide.slideText;
          } else {
            slideLines = [switchedSong.lines[suggestion.lineIndex] ?? suggestion.lineText];
            slideText = slideLines[0];
          }
          const displayMsg: DisplayUpdateMessage = {
            type: 'DISPLAY_UPDATE',
            payload: {
              lineText: slideLines[0],
              slideText,
              slideLines,
              slideIndex: recoverySlideIndex,
              songId: suggestion.songId,
              songTitle: suggestion.songTitle,
              matchConfidence: suggestion.confidence,
              isAutoAdvance: true,
              currentItemIndex: session.currentItemIndex,
            },
            timing: createTiming(receivedAt, processingStart),
          };
          if (!session.bibleMode) broadcastToEvent(session.eventId, displayMsg);
          logTiming('song path (recovery switch)');
          return;
        }

      // Handle current song line matching (normal slide advance)
      const isEndTriggerMatch =
        matchResult.advanceReason === 'end-words' && matchResult.endTriggerScore !== undefined;
      if (matchResult.matchFound && (matchResult.confidence >= session.matcherConfig.similarityThreshold || isEndTriggerMatch)) {
        session.lastStrongMatchAt = Date.now();
        // END-TRIGGER: Advance when last words of line are heard (1 match = advance for responsiveness)
        const END_TRIGGER_DEBOUNCE_WINDOW_MS = 1800;
        const END_TRIGGER_DEBOUNCE_MATCHES = parseNumberEnv(process.env.MATCHER_END_TRIGGER_DEBOUNCE, 1);
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
        // Block only when we're going backward in song content (line index), not just slide index.
        // This allows advancing to the next line even when line-to-slide mapping puts it on a lower
        // slide. Block when: slide would go down AND we're not strictly advancing in line index.
        const advancingInContent =
          typeof session.currentLineIndex === 'number' && matchedLineIndex > session.currentLineIndex;
        const wouldGoToLowerSlide =
          slideChanged && newSlideIndex < session.currentSlideIndex;
        const shouldBlockBackward =
          wouldGoToLowerSlide && !advancingInContent;

        if (shouldBlockBackward) {
          console.warn(
            `[WS] ⚠️  BLOCKED BACKWARD SLIDE: line ${matchedLineIndex} < current line ${session.currentLineIndex} (repeated lyrics detected)`
          );
          console.warn(
            `[WS] Matched line: "${matchResult.matchedText.slice(0, 50)}..." - staying on current slide to prevent confusion`
          );
          if (session.matcherConfig.debug) {
            console.log(
              `[WS] This prevents jumping back to earlier stanzas when lyrics repeat (e.g., "He will make a way for me")`
            );
          }
          logTiming('song path (blocked backward)');
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
              currentItemIndex: session.currentItemIndex,
            },
            timing: createTiming(receivedAt, processingStart),
          };

          if (!session.bibleMode) broadcastToEvent(session.eventId, displayMessage);

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
      logTiming('song path');
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

    // Smart Listen gate: for non-SONG items when enabled, do not start STT until STT_WINDOW_REQUEST.
    // Also close idle stream outside active window to avoid unnecessary paid connection time.
    if (shouldUseSmartListenGate(session)) {
      const now = Date.now();
      const windowActive =
        session.sttWindowActiveUntil !== undefined && now <= session.sttWindowActiveUntil;

      if (!windowActive) {
        if (session.sttStream) {
          try {
            session.sttStream.end();
          } catch (e) {
            console.warn('[STT] Smart Listen: error ending stream outside active window:', e);
          }
          session.sttStream = undefined;
          console.log('[STT] Smart Listen: stream closed (standby)');
        }
        if (session.sttWindowActiveUntil && now > session.sttWindowActiveUntil) {
          session.sttWindowActiveUntil = undefined;
          console.log('[STT] Smart Listen: STT window expired');
        }
        return; // Drop audio until client sends STT_WINDOW_REQUEST and window is active
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
      // Pass base64 through to avoid decode+re-encode (latency)
      const byteLength = Math.floor((data.length * 3) / 4);
      if (byteLength < 256 && chunkCount < 3) {
        console.warn(`[WS] ⚠️  Small audio chunk detected: ~${byteLength} bytes (expected >=256 for 128-sample buffer)`);
      }
      if (!session.sttStream) {
        console.error('[STT] ❌ ElevenLabs stream not initialized');
        sendError(ws, 'STT_ERROR', 'ElevenLabs stream not initialized');
        return;
      }
      session.sttStream.write(data);
      
      // Log first few chunks, then periodically
      if (chunkCount < 3) {
        console.log(`[WS] ✅ Audio chunk #${chunkCount + 1} sent to ElevenLabs: ~${byteLength} bytes (${(byteLength / 2).toFixed(0)} samples)`);
      } else if (Math.random() < 0.02) {
        console.log(`[WS] ✅ Audio chunk sent to ElevenLabs: ~${byteLength} bytes`);
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

  if (sttProvider === 'google' && isGoogleCloudConfigured) {
    if (format?.encoding !== 'pcm_s16le') {
      const receivedFormat = format?.encoding || 'unknown';
      const receivedSampleRate = format?.sampleRate || 'unknown';
      const receivedChannels = format?.channels || 'unknown';
      console.error(`[WS] ❌ Audio format mismatch for Google streaming STT:`);
      console.error(`[WS]    Received: encoding=${receivedFormat}, sampleRate=${receivedSampleRate}, channels=${receivedChannels}`);
      console.error(`[WS]    Expected: encoding=pcm_s16le, sampleRate=16000, channels=1`);
      console.error(`[WS]    Set NEXT_PUBLIC_STT_PROVIDER=google in frontend for PCM audio`);
      sendError(ws, 'AUDIO_FORMAT_UNSUPPORTED',
        `Google streaming requires PCM 16-bit (pcm_s16le, 16kHz, mono). Received: ${receivedFormat}. Set NEXT_PUBLIC_STT_PROVIDER=google in frontend.`,
        { encoding: receivedFormat, sampleRate: receivedSampleRate, channels: receivedChannels }
      );
      return;
    }
    if (chunkCount === 0) {
      console.log(`[WS] ✅ Audio format validated for Google: PCM 16-bit (${format.sampleRate}Hz, ${format.channels} channel)`);
    }
    if (shouldUseSmartListenGate(session)) {
      const now = Date.now();
      const windowActive = session.sttWindowActiveUntil !== undefined && now <= session.sttWindowActiveUntil;
      if (!windowActive) {
        if (session.sttStream) {
          try {
            session.sttStream.end();
          } catch (e) {
            console.warn('[STT] Smart Listen: error ending stream outside active window:', e);
          }
          session.sttStream = undefined;
        }
        if (session.sttWindowActiveUntil && now > session.sttWindowActiveUntil) {
          session.sttWindowActiveUntil = undefined;
        }
        return;
      }
    }
    if (!session.sttStream) {
      console.log('[STT] 🚀 Creating Google Cloud streaming recognition (lazy init on first audio)...');
      initGoogleStream(session, ws);
      const activeStream = session.sttStream;
      for (const [otherWs, otherSession] of sessions.entries()) {
        if (otherSession.eventId === session.eventId && otherSession !== session && !otherSession.sttStream && otherWs.readyState === ws.OPEN) {
          if (activeStream) otherSession.sttStream = activeStream;
        }
      }
    }
    try {
      const byteLength = Math.floor((data.length * 3) / 4);
      if (!session.sttStream) {
        sendError(ws, 'STT_ERROR', 'Google stream not initialized');
        return;
      }
      session.sttStream.write(data);
      if (chunkCount < 3) {
        console.log(`[WS] ✅ Audio chunk #${chunkCount + 1} sent to Google: ~${byteLength} bytes`);
      }
    } catch (error) {
      console.error('[WS] ❌ Error sending audio to Google:', error);
      sendError(ws, 'STT_ERROR', 'Error sending audio to Google', { message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  // Send audio to STT service (Google Cloud non-streaming or mock)
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
 * Handle STT_WINDOW_REQUEST (Smart Listen).
 * Opens ElevenLabs STT window; optional catch-up audio from ring buffer.
 */
function handleSttWindowRequest(ws: WebSocket, payload: { catchUpAudio?: string }): void {
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }
  if (BIBLE_SMART_LISTEN_KILL_SWITCH) {
    sendError(ws, 'STT_WINDOW_UNSUPPORTED', 'Smart Listen is disabled by server (BIBLE_SMART_LISTEN_ENABLED=false).');
    return;
  }
  if (!session.smartListenEnabled) {
    sendError(ws, 'STT_WINDOW_UNSUPPORTED', 'Smart Listen is not enabled for this session.');
    return;
  }
  if (!shouldUseSmartListenGate(session)) {
    sendError(
      ws,
      'STT_WINDOW_UNSUPPORTED',
      'STT_WINDOW_REQUEST is only valid when Smart Listen gate is active (Bible mode or non-SONG item).'
    );
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
      if (session.sttStream && payload.catchUpAudio?.length > 0) {
        session.sttStream.write(payload.catchUpAudio);
        const bytes = Math.floor((payload.catchUpAudio.length * 3) / 4);
        console.log(`[STT] Smart Listen: sent ~${bytes} bytes catch-up audio`);
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
async function handleManualOverride(
  ws: WebSocket,
  action: 'NEXT_SLIDE' | 'PREV_SLIDE' | 'GO_TO_SLIDE' | 'GO_TO_ITEM',
  receivedAt: number,
  slideIndex?: number,
  songId?: string,
  itemIndex?: number,
  itemId?: string
): Promise<void> {
  const processingStart = Date.now();
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }

  const setlistItems = session.setlistItems ?? [];
  const currentItemIdx = session.currentItemIndex ?? 0;

  // GO_TO_ITEM: Jump to setlist item by index (enables clicking Bible/Media/Announcement in setlist)
  if (action === 'GO_TO_ITEM' && itemIndex !== undefined) {
    // Resolve target: by index if in range, else by itemId when frontend setlist is longer (e.g. merged from initialSetlist)
    let targetItem: SetlistItemData | null = null;
    if (setlistItems.length > 0 && itemIndex >= 0 && itemIndex < setlistItems.length) {
      targetItem = setlistItems[itemIndex];
    } else if (itemId) {
      const byId = setlistItems.find((i) => i.id === itemId);
      if (byId) {
        targetItem = byId;
      } else {
        // Fetch single event_item from DB (e.g. ANNOUNCEMENT when backend used fallback query)
        const fetched = await fetchEventItemById(session.eventId, itemId);
        if (fetched) targetItem = fetched;
      }
    }
    if (!targetItem) {
      sendError(ws, 'INVALID_ITEM', itemId
        ? `Item not found: ${itemId}`
        : `itemIndex ${itemIndex} out of range (0-${Math.max(0, setlistItems.length - 1)})`);
      return;
    }
    // #region agent log
    const h2Payload = {
      location: 'handler.ts:GO_TO_ITEM',
      message: 'GO_TO_ITEM target resolved',
      data: {
        itemIndex,
        itemId,
        targetType: targetItem.type,
        mediaUrlSnippet: targetItem.type === 'MEDIA' ? String((targetItem as { mediaUrl?: string }).mediaUrl ?? '').slice(0, 80) : undefined,
      },
      timestamp: Date.now(),
      hypothesisId: 'H2',
    };
    debugLog(h2Payload);
    fetch('http://127.0.0.1:7243/ingest/6095c691-a3e3-4d5f-8474-ddde2a07b74e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(h2Payload) }).catch(() => {});
    // #endregion
    session.currentItemIndex = itemIndex; // Use client index so operator highlight is correct when setlists differ
    session.isAutoFollowing = false;
    session.suggestedSongSwitch = undefined;

    if (targetItem.type === 'BIBLE' && targetItem.bibleRef) {
      const placeholderId = `bible:${targetItem.bibleRef.replace(/\s+/g, ':')}`;
      const displayUpdate: DisplayUpdateMessage = {
        type: 'DISPLAY_UPDATE',
        payload: {
          lineText: targetItem.bibleRef,
          slideText: targetItem.bibleRef,
          slideLines: [targetItem.bibleRef],
          slideIndex: 0,
          lineIndex: 0,
          songId: placeholderId,
          songTitle: targetItem.bibleRef,
          isAutoAdvance: false,
          currentItemIndex: itemIndex,
        },
        timing: createTiming(receivedAt, Date.now()),
      };
      broadcastToEvent(session.eventId, displayUpdate);
      console.log(`[WS] Manual override: GO_TO_ITEM -> Bible "${targetItem.bibleRef}" (item ${itemIndex})`);
      return;
    }
    if (targetItem.type === 'SONG' && targetItem.songId) {
      const targetSongIndex = session.songs.findIndex((s) => s.id === targetItem.songId);
      if (targetSongIndex >= 0) {
        const targetSong = session.songs[targetSongIndex];
        session.currentSongIndex = targetSongIndex;
        session.currentSlideIndex = 0;
        session.currentLineIndex = 0;
        session.songContext = createSongContext(
          { id: targetSong.id, sequence_order: targetSongIndex + 1 },
          targetSong,
          0
        );
        session.rollingBuffer = '';
        const now = Date.now();
        session.songLockUntil = now + SONG_LOCK_MS;
        session.consecutiveLowMatchCount = 0;
        const slideText = targetSong.slides?.[0]?.slideText ?? targetSong.lines[0] ?? '';
        const slideLines = targetSong.slides?.[0]?.lines ?? [slideText];
        const displayUpdate: DisplayUpdateMessage = {
          type: 'DISPLAY_UPDATE',
          payload: {
            lineText: slideLines[0] ?? '',
            slideText,
            slideLines,
            slideIndex: 0,
            lineIndex: 0,
            songId: targetSong.id,
            songTitle: targetSong.title,
            isAutoAdvance: false,
            currentItemIndex: itemIndex,
          },
          timing: createTiming(receivedAt, Date.now()),
        };
        if (!session.bibleMode) broadcastToEvent(session.eventId, displayUpdate);
        console.log(`[WS] Manual override: GO_TO_ITEM -> Song "${targetSong.title}" (item ${itemIndex})`);
        return;
      }
    }
    if (targetItem.type === 'MEDIA') {
      session.currentSlideIndex = 0;
      const placeholderId = `media:${targetItem.mediaUrl ?? 'placeholder'}`;
      const mediaUrl = targetItem.mediaUrl ?? '';
      const urlLower = mediaUrl.toLowerCase();
      const isVideo = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(urlLower);
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(urlLower);
      const slideImageUrl = isImage ? mediaUrl : undefined;
      const slideVideoUrl = isVideo ? mediaUrl : undefined;
      // #region agent log
      const h3Payload = {
        location: 'handler.ts:MEDIA payload',
        message: 'MEDIA DISPLAY_UPDATE built',
        data: {
          mediaUrlSnippet: mediaUrl.slice(0, 80),
          isImage,
          isVideo,
          hasSlideImageUrl: Boolean(slideImageUrl),
          hasSlideVideoUrl: Boolean(slideVideoUrl),
        },
        timestamp: Date.now(),
        hypothesisId: 'H3',
      };
      debugLog(h3Payload);
      fetch('http://127.0.0.1:7243/ingest/6095c691-a3e3-4d5f-8474-ddde2a07b74e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(h3Payload) }).catch(() => {});
      // #endregion
      const displayUpdate: DisplayUpdateMessage = {
        type: 'DISPLAY_UPDATE',
        payload: {
          lineText: targetItem.mediaTitle ?? 'Media',
          slideText: targetItem.mediaTitle ?? 'Media',
          slideLines: [targetItem.mediaTitle ?? 'Media'],
          slideIndex: 0,
          lineIndex: 0,
          songId: placeholderId,
          songTitle: targetItem.mediaTitle ?? 'Media',
          isAutoAdvance: false,
          currentItemIndex: itemIndex,
          slideImageUrl,
          slideVideoUrl,
          displayType: isVideo ? 'video' : isImage ? 'image' : 'lyrics',
        },
        timing: createTiming(receivedAt, Date.now()),
      };
      broadcastToEvent(session.eventId, displayUpdate);
      console.log(`[WS] Manual override: GO_TO_ITEM -> Media (item ${itemIndex}, ${isVideo ? 'video' : isImage ? 'image' : 'unknown'})`);
      return;
    }
    if (targetItem.type === 'ANNOUNCEMENT' && targetItem.announcementSlides && targetItem.announcementSlides.length > 0) {
      session.currentSlideIndex = 0;
      const slide = targetItem.announcementSlides[0] as AnnouncementSlide;
      const placeholderId = `announcement:${targetItem.id}`;
      const displayUpdate: DisplayUpdateMessage = {
        type: 'DISPLAY_UPDATE',
        payload: buildAnnouncementPayload(slide, placeholderId, 0, itemIndex, false),
        timing: createTiming(receivedAt, Date.now()),
      };
      broadcastToEvent(session.eventId, displayUpdate);
      console.log(`[WS] Manual override: GO_TO_ITEM -> Announcement (item ${itemIndex}, slide 0)`);
      return;
    }
    return;
  }

  const currentSong = session.songs[session.currentSongIndex];
  if (!currentSong) {
    sendError(ws, 'NO_SONG', 'No current song in session.');
    return;
  }

  let newSlideIndex = session.currentSlideIndex;
  let newSongIndex = session.currentSongIndex;
  let newItemIndex = currentItemIdx;

  // Helper to get slide count for a song
  const getSlideCount = (song: SongData): number => {
    return song.slides?.length ?? song.lines.length;
  };

  const currentSetlistItem = setlistItems[currentItemIdx];
  const isAnnouncement = currentSetlistItem?.type === 'ANNOUNCEMENT' && currentSetlistItem.announcementSlides && currentSetlistItem.announcementSlides.length > 0;
  const announcementSlideCount = isAnnouncement ? currentSetlistItem!.announcementSlides!.length : 0;

  switch (action) {
    case 'NEXT_SLIDE': {
      if (isAnnouncement) {
        if (session.currentSlideIndex < announcementSlideCount - 1) {
          newSlideIndex = session.currentSlideIndex + 1;
          session.currentSlideIndex = newSlideIndex;
          const slide = currentSetlistItem!.announcementSlides![newSlideIndex] as AnnouncementSlide;
          const placeholderId = `announcement:${currentSetlistItem!.id}`;
          const displayUpdate: DisplayUpdateMessage = {
            type: 'DISPLAY_UPDATE',
            payload: buildAnnouncementPayload(slide, placeholderId, newSlideIndex, currentItemIdx, false),
            timing: createTiming(receivedAt, processingStart),
          };
          broadcastToEvent(session.eventId, displayUpdate);
          console.log(`[WS] Manual override: NEXT_SLIDE -> Announcement slide ${newSlideIndex + 1}/${announcementSlideCount}`);
          return;
        }
        newItemIndex = currentItemIdx + 1;
        const nextItem = setlistItems[newItemIndex];
        if (nextItem?.type === 'SONG' && nextItem.songId) {
          const idx = session.songs.findIndex((s) => s.id === nextItem.songId);
          if (idx >= 0) {
            newSongIndex = idx;
            newSlideIndex = 0;
          }
        } else {
          newSlideIndex = 0;
        }
      }
      if (!isAnnouncement || newItemIndex === currentItemIdx) {
        const slideCount = getSlideCount(currentSong);
        if (session.currentSlideIndex < slideCount - 1 && !isAnnouncement) {
          newSlideIndex = session.currentSlideIndex + 1;
        } else if (setlistItems.length > 0 && currentItemIdx < setlistItems.length - 1 && newItemIndex === currentItemIdx) {
          newItemIndex = currentItemIdx + 1;
          const nextItem = setlistItems[newItemIndex];
          if (nextItem.type === 'SONG' && nextItem.songId) {
            const idx = session.songs.findIndex((s) => s.id === nextItem.songId);
            if (idx >= 0) {
              newSongIndex = idx;
              newSlideIndex = 0;
            }
          }
        } else if (session.currentSongIndex < session.songs.length - 1 && !isAnnouncement) {
          newSongIndex = session.currentSongIndex + 1;
          newSlideIndex = 0;
        }
      }
      break;
    }

    case 'PREV_SLIDE': {
      if (isAnnouncement) {
        if (session.currentSlideIndex > 0) {
          newSlideIndex = session.currentSlideIndex - 1;
          session.currentSlideIndex = newSlideIndex;
          const slide = currentSetlistItem!.announcementSlides![newSlideIndex] as AnnouncementSlide;
          const placeholderId = `announcement:${currentSetlistItem!.id}`;
          const displayUpdate: DisplayUpdateMessage = {
            type: 'DISPLAY_UPDATE',
            payload: buildAnnouncementPayload(slide, placeholderId, newSlideIndex, currentItemIdx, false),
            timing: createTiming(receivedAt, processingStart),
          };
          broadcastToEvent(session.eventId, displayUpdate);
          console.log(`[WS] Manual override: PREV_SLIDE -> Announcement slide ${newSlideIndex + 1}/${announcementSlideCount}`);
          return;
        }
        newItemIndex = currentItemIdx - 1;
      }
      if (!isAnnouncement) {
        if (session.currentSlideIndex > 0) {
          newSlideIndex = session.currentSlideIndex - 1;
        } else if (setlistItems.length > 0 && currentItemIdx > 0) {
          newItemIndex = currentItemIdx - 1;
          const prevItem = setlistItems[newItemIndex];
          if (prevItem.type === 'SONG' && prevItem.songId) {
            const idx = session.songs.findIndex((s) => s.id === prevItem.songId);
            if (idx >= 0) {
              newSongIndex = idx;
              const prevSong = session.songs[idx];
              newSlideIndex = getSlideCount(prevSong) - 1;
            }
          }
        } else if (session.currentSongIndex > 0) {
          newSongIndex = session.currentSongIndex - 1;
          const prevSong = session.songs[newSongIndex];
          newSlideIndex = getSlideCount(prevSong) - 1;
        }
      } else if (isAnnouncement && newItemIndex >= 0) {
        const prevItem = setlistItems[newItemIndex];
        if (prevItem.type === 'SONG' && prevItem.songId) {
          const idx = session.songs.findIndex((s) => s.id === prevItem.songId);
          if (idx >= 0) {
            newSongIndex = idx;
            const prevSong = session.songs[idx];
            newSlideIndex = getSlideCount(prevSong) - 1;
          }
        } else if (prevItem.type === 'ANNOUNCEMENT' && prevItem.announcementSlides && prevItem.announcementSlides.length > 0) {
          newSlideIndex = prevItem.announcementSlides.length - 1;
        }
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
  const itemChanged = newItemIndex !== currentItemIdx;
  const slideChanged = newSlideIndex !== session.currentSlideIndex || songChanged;

  // When advancing to BIBLE/MEDIA via NEXT_SLIDE, itemChanged but song may not change
  if (!slideChanged && !itemChanged) {
    console.log(`[WS] Manual override: ${action} -> No change (already at Song ${newSongIndex}, Slide ${newSlideIndex})`);
    return;
  }

  // Handle advancing to BIBLE or MEDIA item (NEXT_SLIDE/PREV_SLIDE when target is non-SONG)
  if (itemChanged && setlistItems.length > 0) {
    const targetItem = setlistItems[newItemIndex];
    if (targetItem.type === 'BIBLE' && targetItem.bibleRef) {
      session.currentItemIndex = newItemIndex;
      session.isAutoFollowing = false;
      session.suggestedSongSwitch = undefined;
      const placeholderId = `bible:${targetItem.bibleRef.replace(/\s+/g, ':')}`;
      const displayUpdate: DisplayUpdateMessage = {
        type: 'DISPLAY_UPDATE',
        payload: {
          lineText: targetItem.bibleRef,
          slideText: targetItem.bibleRef,
          slideLines: [targetItem.bibleRef],
          slideIndex: 0,
          lineIndex: 0,
          songId: placeholderId,
          songTitle: targetItem.bibleRef,
          isAutoAdvance: false,
          currentItemIndex: newItemIndex,
        },
        timing: createTiming(receivedAt, processingStart),
      };
      broadcastToEvent(session.eventId, displayUpdate);
      console.log(`[WS] Manual override: ${action} -> Bible "${targetItem.bibleRef}" (item ${newItemIndex})`);
      return;
    }
    if (targetItem.type === 'MEDIA') {
      session.currentItemIndex = newItemIndex;
      session.currentSlideIndex = 0;
      session.isAutoFollowing = false;
      session.suggestedSongSwitch = undefined;
      const placeholderId = `media:${targetItem.mediaUrl ?? 'placeholder'}`;
      const displayUpdate: DisplayUpdateMessage = {
        type: 'DISPLAY_UPDATE',
        payload: {
          lineText: 'Media',
          slideText: 'Media',
          slideLines: ['Media'],
          slideIndex: 0,
          lineIndex: 0,
          songId: placeholderId,
          songTitle: 'Media',
          isAutoAdvance: false,
          currentItemIndex: newItemIndex,
        },
        timing: createTiming(receivedAt, processingStart),
      };
      broadcastToEvent(session.eventId, displayUpdate);
      console.log(`[WS] Manual override: ${action} -> Media (item ${newItemIndex})`);
      return;
    }
    if (targetItem.type === 'ANNOUNCEMENT' && targetItem.announcementSlides && targetItem.announcementSlides.length > 0) {
      const slideIndex = Math.min(Math.max(0, newSlideIndex), targetItem.announcementSlides.length - 1);
      session.currentItemIndex = newItemIndex;
      session.currentSlideIndex = slideIndex;
      session.isAutoFollowing = false;
      session.suggestedSongSwitch = undefined;
      const slide = targetItem.announcementSlides[slideIndex] as AnnouncementSlide;
      const placeholderId = `announcement:${targetItem.id}`;
      const displayUpdate: DisplayUpdateMessage = {
        type: 'DISPLAY_UPDATE',
        payload: buildAnnouncementPayload(slide, placeholderId, slideIndex, newItemIndex, false),
        timing: createTiming(receivedAt, processingStart),
      };
      broadcastToEvent(session.eventId, displayUpdate);
      console.log(`[WS] Manual override: ${action} -> Announcement (item ${newItemIndex}, slide ${slideIndex})`);
      return;
    }
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

  // Clamp to valid line range (prevents matcher crash when index >= lines.length)
  const lineCount = targetSong.lines?.length ?? 0;
  if (lineCount > 0 && newLineIndex >= lineCount) {
    newLineIndex = lineCount - 1;
  }

  // Update session state
  session.currentItemIndex = newItemIndex;
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
    const now = Date.now();
    session.songLockUntil = now + SONG_LOCK_MS;
    session.consecutiveLowMatchCount = 0;
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
      currentItemIndex: newItemIndex,
    },
    timing,
  };
  if (!session.bibleMode) broadcastToEvent(session.eventId, displayUpdate);

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

  // Never rate-limit START_SESSION so starting a session is never blocked
  if (messageType !== 'START_SESSION' && isRateLimited(ws, messageType)) {
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
      await handleManualOverride(
        ws,
        message.payload.action,
        receivedAt,
        message.payload.slideIndex,
        message.payload.songId,
        message.payload.itemIndex,
        message.payload.itemId
      );
    } else if (isStopSessionMessage(message)) {
      handleStopSession(ws, receivedAt);
    } else if (isPingMessage(message)) {
      handlePing(ws, receivedAt);
    } else if (isSttWindowRequestMessage(message)) {
      handleSttWindowRequest(ws, message.payload);
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
