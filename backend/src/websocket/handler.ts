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
} from '../types/websocket';
import { validateClientMessage } from '../types/schemas';
import { fetchEventData, type SongData } from '../services/eventService';
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
  projectorFont?: string | null;
  songs: SongData[];
  currentSongIndex: number;
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
// STT Stream Helpers
// ============================================

function initElevenLabsStream(session: SessionState, ws: WebSocket): void {
  const stream = createStreamingRecognition();
  stream.on('data', (result: { text: string; isFinal: boolean; confidence: number }) => {
    const processingStart = Date.now();
    const receivedAtNow = Date.now();
    handleTranscriptionResult(ws, session, result, receivedAtNow, processingStart);
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
  eventId: string,
  receivedAt: number
): Promise<void> {
  const processingStart = Date.now();
  console.log(`[WS] Starting session for event: ${eventId}`);

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
  const currentSongIndex = existingSession?.currentSongIndex ?? 0;
  const currentSlideIndex = existingSession?.currentSlideIndex ?? 0;
  const currentSong = eventData.songs[currentSongIndex] || eventData.songs[0];
  
  // Determine current line index from slide index (for matching)
  // If slides exist, find the first line of the current slide
  let currentLineIndex = currentSlideIndex;
  if (currentSong.slides && currentSong.slides.length > 0 && currentSlideIndex < currentSong.slides.length) {
    currentLineIndex = currentSong.slides[currentSlideIndex].startLineIndex;
  } else if (currentSong.lineToSlideIndex && currentSong.lineToSlideIndex.length > 0) {
    // Fallback: find first line that maps to this slide
    currentLineIndex = currentSong.lineToSlideIndex.findIndex(slideIdx => slideIdx === currentSlideIndex);
    if (currentLineIndex === -1) currentLineIndex = 0;
  }
  
  const songContext = createSongContext(
    { id: currentSong.id, sequence_order: currentSongIndex + 1 },
    currentSong,
    currentLineIndex // Use line index for matching
  );
  
  const session: SessionState = {
    sessionId,
    eventId,
    eventName: eventData.name,
    projectorFont: eventData.projectorFont ?? null,
    songs: eventData.songs,
    currentSongIndex,
    currentSlideIndex,
    currentLineIndex, // Track line index separately for matching
    rollingBuffer: existingSession?.rollingBuffer || '',
    isActive: true,
    isAutoFollowing: true, // Auto-follow enabled by default
    songContext,
    matcherConfig,
    lastMatchConfidence: existingSession?.lastMatchConfidence || 0,
    suggestedSongSwitch: undefined,
    lastSongSwitchAt: undefined,
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

  console.log(`[WS] Sending SESSION_STARTED with ${setlistPayload.length} songs in setlist`);

  const response: SessionStartedMessage = {
    type: 'SESSION_STARTED',
    payload: {
      sessionId,
      eventId,
      eventName: session.eventName,
      projectorFont: session.projectorFont ?? null,
      totalSongs: session.songs.length,
      currentSongIndex,
      currentSlideIndex,
      setlist: setlistPayload,
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
  projectorFont: string,
  receivedAt: number
): void {
  const processingStart = Date.now();
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }

  session.projectorFont = projectorFont;

  const settingsMessage: EventSettingsUpdatedMessage = {
    type: 'EVENT_SETTINGS_UPDATED',
    payload: { projectorFont },
    timing: createTiming(receivedAt, processingStart),
  };

  broadcastToEvent(session.eventId, settingsMessage);
}

function handleTranscriptionResult(
  ws: WebSocket,
  session: SessionState,
  transcriptionResult: { text: string; isFinal: boolean; confidence: number },
  receivedAt: number,
  processingStart: number
): void {
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
  session.lastTranscriptAt = Date.now();

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
      console.log(`[WS] 🔍 Current song: "${session.songContext?.title || 'N/A'}"`);
      console.log(`[WS] 🔍 Current line: "${session.songContext?.lines[session.songContext?.currentLineIndex || 0] || 'N/A'}"`);
      console.log(`[WS] 🔍 Auto-following: ${session.isAutoFollowing}`);

      if (session.songContext) {
        // PHASE 1: Multi-song matching with debouncing
        const multiSongResult: MultiSongMatchResult = findBestMatchAcrossAllSongs(
          cleanedBuffer,
          session.songContext,
          session.songs,
          session.currentSongIndex,
          session.matcherConfig
        );

        const matchResult = multiSongResult.currentSongMatch;
        session.lastMatchConfidence = matchResult.confidence;

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
    const STT_STALE_MS = 10000;
    const STT_RESTART_COOLDOWN_MS = 15000;
    if (session.lastTranscriptAt && Date.now() - session.lastTranscriptAt > STT_STALE_MS) {
      const lastRestart = session.lastSttRestartAt ?? 0;
      if (Date.now() - lastRestart > STT_RESTART_COOLDOWN_MS) {
        restartElevenLabsStream(session, ws, 'stale transcripts');
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
      await handleStartSession(ws, message.payload.eventId, receivedAt);
    } else if (isUpdateEventSettingsMessage(message)) {
      handleUpdateEventSettings(ws, message.payload.projectorFont, receivedAt);
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
