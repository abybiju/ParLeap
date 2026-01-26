/**
 * WebSocket Message Handler
 * 
 * Processes incoming WebSocket messages and manages session state
 */

import type { WebSocket } from 'ws';
import {
  type ClientMessage,
  type ServerMessage,
  type SessionStartedMessage,
  type TranscriptUpdateMessage,
  type DisplayUpdateMessage,
  type SongChangedMessage,
  type ErrorMessage,
  type PongMessage,
  type TimingMetadata,
  isStartSessionMessage,
  isAudioDataMessage,
  isManualOverrideMessage,
  isStopSessionMessage,
  isPingMessage,
} from '../types/websocket';
import { validateClientMessage } from '../types/schemas';
import { fetchEventData, type SongData } from '../services/eventService';
import { transcribeAudioChunk, createStreamingRecognition, sttProvider } from '../services/sttService';
import {
  findBestMatch,
  createSongContext,
  validateConfig,
  type MatcherConfig,
  type SongContext,
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
  songs: SongData[];
  currentSongIndex: number;
  currentSlideIndex: number;
  rollingBuffer: string;
  isActive: boolean;
  // Matcher state
  songContext?: SongContext;
  matcherConfig: MatcherConfig;
  lastMatchConfidence?: number;
  sttStream?: ReturnType<typeof createStreamingRecognition>;
  lastTranscriptText?: string;
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

// ============================================
// Message Handlers
// ============================================

/**
 * Handle START_SESSION message
 * Initializes session state and loads event data from Supabase
 */
async function handleStartSession(
  ws: WebSocket,
  eventId: string,
  receivedAt: number
): Promise<void> {
  const processingStart = Date.now();
  console.log(`[WS] Starting session for event: ${eventId}`);

  // Check if session already exists
  if (sessions.has(ws)) {
    sendError(ws, 'SESSION_EXISTS', 'A session is already active for this connection');
    return;
  }

  // Fetch real event data from Supabase
  const eventData = await fetchEventData(eventId);
  
  if (!eventData) {
    sendError(ws, 'EVENT_NOT_FOUND', `Event ${eventId} not found or no setlist configured`, { eventId });
    return;
  }

  if (eventData.songs.length === 0) {
    sendError(ws, 'EMPTY_SETLIST', 'Event has no songs in setlist', { eventId });
    return;
  }

  const sessionId = `session_${Date.now()}`;
  
  // Initialize matcher configuration
  const matcherConfig: MatcherConfig = validateConfig({
    similarityThreshold: parseNumberEnv(process.env.MATCHER_SIMILARITY_THRESHOLD, 0.7),
    minBufferLength: parseNumberEnv(process.env.MATCHER_MIN_BUFFER_LENGTH, 3),
    bufferWindow: parseNumberEnv(process.env.MATCHER_BUFFER_WINDOW, 100),
    debug: process.env.DEBUG_MATCHER === 'true',
  });

  // Create song context for first song
  const firstSong = eventData.songs[0];
  const songContext = createSongContext(
    { id: firstSong.id, sequence_order: 1 }, // Mock EventItemData
    firstSong,
    0
  );
  
  const session: SessionState = {
    sessionId,
    eventId,
    eventName: eventData.name,
    songs: eventData.songs,
    currentSongIndex: 0,
    currentSlideIndex: 0,
    rollingBuffer: '',
    isActive: true,
    songContext,
    matcherConfig,
    lastMatchConfidence: 0,
  };

  if (sttProvider === 'elevenlabs') {
    const stream = createStreamingRecognition();
    stream.on('data', (result: { text: string; isFinal: boolean; confidence: number }) => {
      const processingStart = Date.now();
      const receivedAtNow = Date.now();
      handleTranscriptionResult(ws, session, result, receivedAtNow, processingStart);
    });
    stream.on('error', (error: Error) => {
      console.error('[STT] ElevenLabs stream error:', error);
      sendError(ws, 'STT_ERROR', 'ElevenLabs stream error', { message: error.message });
    });
    session.sttStream = stream;
  }

  sessions.set(ws, session);

  // Send session started confirmation with full setlist for caching
  const response: SessionStartedMessage = {
    type: 'SESSION_STARTED',
    payload: {
      sessionId,
      eventId,
      eventName: session.eventName,
      totalSongs: session.songs.length,
      currentSongIndex: 0,
      currentSlideIndex: 0,
      setlist: session.songs.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        lines: song.lines,
      })),
    },
    timing: createTiming(receivedAt, processingStart),
  };

  send(ws, response);

  // Send initial display update
  if (session.songs.length > 0 && session.songs[0].lines.length > 0) {
    const displayUpdate: DisplayUpdateMessage = {
      type: 'DISPLAY_UPDATE',
      payload: {
        lineText: session.songs[0].lines[0],
        slideIndex: 0,
        songId: session.songs[0].id,
        songTitle: session.songs[0].title,
        isAutoAdvance: false,
      },
      timing: createTiming(receivedAt, processingStart),
    };
    send(ws, displayUpdate);
  }

  console.log(`[WS] Session started: ${sessionId} with ${session.songs.length} songs`);
}

function handleTranscriptionResult(
  ws: WebSocket,
  session: SessionState,
  transcriptionResult: { text: string; isFinal: boolean; confidence: number },
  receivedAt: number,
  processingStart: number
): void {
  // Default to allowing partial matching to provide faster feedback
  const allowPartialMatching =
    process.env.MATCHER_ALLOW_PARTIAL === undefined
      ? true
      : process.env.MATCHER_ALLOW_PARTIAL === 'true';
  const shouldAttemptMatch = transcriptionResult.isFinal || allowPartialMatching;
  const trimmedText = transcriptionResult.text.trim();

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

  send(ws, transcriptMessage);

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

    if (!session.songContext) {
      console.log(`[WS] ⚠️  Skipping match: no songContext for session`);
      return;
    }

    // Always log matcher attempt for debugging production issues
    console.log(`[WS] 🔍 Attempting match with buffer: "${cleanedBuffer.slice(0, 50)}..."`);

    if (session.songContext) {
      const matchResult = findBestMatch(
        cleanedBuffer,
        session.songContext,
        session.matcherConfig
      );

      session.lastMatchConfidence = matchResult.confidence;

      // Always log match result for debugging
      console.log(`[WS] 📊 Match result: found=${matchResult.matchFound}, confidence=${(matchResult.confidence * 100).toFixed(1)}%, threshold=${(session.matcherConfig.similarityThreshold * 100).toFixed(1)}%`);

      if (matchResult.matchFound && matchResult.confidence >= session.matcherConfig.similarityThreshold) {
        if (session.matcherConfig.debug) {
          console.log(
            `[WS] 🎯 MATCH FOUND: Line ${matchResult.currentLineIndex} @ ${(matchResult.confidence * 100).toFixed(1)}% - "${matchResult.matchedText}"`
          );
          console.log(`[WS] isLineEnd: ${matchResult.isLineEnd}, nextLineIndex: ${matchResult.nextLineIndex}`);
          console.log(`[WS] Match reason: ${matchResult.isLineEnd ? `Advancing from line ${session.songContext.currentLineIndex} to line ${matchResult.nextLineIndex}` : `Matched current line ${matchResult.currentLineIndex} (no advance)`}`);
        }

        // Always send DISPLAY_UPDATE with confidence when match found (even if not advancing)
        const displayMessage: DisplayUpdateMessage = {
          type: 'DISPLAY_UPDATE',
          payload: {
            lineText: matchResult.matchedText,
            slideIndex: matchResult.isLineEnd && matchResult.nextLineIndex !== undefined 
              ? matchResult.nextLineIndex 
              : matchResult.currentLineIndex,
            songId: session.songContext.id,
            songTitle: session.songContext.title,
            matchConfidence: matchResult.confidence,
            isAutoAdvance: matchResult.isLineEnd || false,
          },
          timing: createTiming(receivedAt, processingStart),
        };

        broadcastToEvent(session.eventId, displayMessage);

        // Trim buffer after strong match to reduce noise for next lines
        session.rollingBuffer = matchResult.matchedText;

        // Only update slide index if actually advancing
        if (matchResult.isLineEnd && matchResult.nextLineIndex !== undefined) {
          session.currentSlideIndex = matchResult.nextLineIndex;
          session.songContext.currentLineIndex = matchResult.nextLineIndex;
          if (session.matcherConfig.debug) {
            console.log(`[WS] Auto-advanced to slide ${matchResult.nextLineIndex}`);
          }
        } else {
          if (session.matcherConfig.debug) {
            console.log(`[WS] Matched current line ${matchResult.currentLineIndex} (confidence: ${(matchResult.confidence * 100).toFixed(1)}%)`);
          }
        }
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

  console.log(`[WS] Received audio chunk: ${data.length} bytes (base64)`);

  if (sttProvider === 'elevenlabs') {
    if (!session.sttStream) {
      sendError(ws, 'STT_ERROR', 'ElevenLabs stream not initialized');
      return;
    }
    if (format?.encoding !== 'pcm_s16le') {
      sendError(ws, 'AUDIO_FORMAT_UNSUPPORTED', 'ElevenLabs requires PCM 16-bit audio', {
        encoding: format?.encoding,
      });
      return;
    }
    try {
      const audioBuffer = Buffer.from(data, 'base64');
      session.sttStream.write(audioBuffer);
    } catch (error) {
      console.error('[WS] Error sending audio to ElevenLabs:', error);
      sendError(ws, 'STT_ERROR', 'Error sending audio to ElevenLabs');
    }
    return;
  }

  // Send audio to STT service (Google Cloud or mock)
  try {
    const transcriptionResult = await transcribeAudioChunk(data);
    if (transcriptionResult) {
      handleTranscriptionResult(ws, session, transcriptionResult, receivedAt, processingStart);
    } else {
      console.log('[WS] No transcription result (silence or error)');
    }
  } catch (error) {
    console.error('[WS] Error processing audio:', error);
    sendError(ws, 'STT_ERROR', 'Failed to transcribe audio', { error: String(error) });
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

  switch (action) {
    case 'NEXT_SLIDE':
      if (session.currentSlideIndex < currentSong.lines.length - 1) {
        newSlideIndex = session.currentSlideIndex + 1;
      } else if (session.currentSongIndex < session.songs.length - 1) {
        // Move to next song
        newSongIndex = session.currentSongIndex + 1;
        newSlideIndex = 0;
      }
      break;

    case 'PREV_SLIDE':
      if (session.currentSlideIndex > 0) {
        newSlideIndex = session.currentSlideIndex - 1;
      } else if (session.currentSongIndex > 0) {
        // Move to previous song
        newSongIndex = session.currentSongIndex - 1;
        newSlideIndex = session.songs[newSongIndex].lines.length - 1;
      }
      break;

    case 'GO_TO_SLIDE':
      if (slideIndex !== undefined) {
        if (songId) {
          const targetSongIndex = session.songs.findIndex((s) => s.id === songId);
          if (targetSongIndex !== -1) {
            newSongIndex = targetSongIndex;
          }
        }
        const targetSong = session.songs[newSongIndex];
        if (slideIndex >= 0 && slideIndex < targetSong.lines.length) {
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

  // Update session state
  session.currentSongIndex = newSongIndex;
  session.currentSlideIndex = newSlideIndex;

  const targetSong = session.songs[newSongIndex];

  // Update song context for matching (Phase 3)
  if (songChanged) {
    session.songContext = createSongContext(
      { id: targetSong.id, sequence_order: newSongIndex + 1 },
      targetSong,
      newSlideIndex
    );
    session.rollingBuffer = ''; // Clear buffer on song change
  } else if (session.songContext) {
    // Update line index within same song
    session.songContext.currentLineIndex = newSlideIndex;
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
        totalSlides: targetSong.lines.length,
      },
      timing,
    };
    send(ws, songChangedMessage);
  }

  // Send display update
  const displayUpdate: DisplayUpdateMessage = {
    type: 'DISPLAY_UPDATE',
    payload: {
      lineText: targetSong.lines[newSlideIndex],
      slideIndex: newSlideIndex,
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
      await handleStartSession(ws, message.payload.eventId, receivedAt);
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

