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
import { transcribeAudioChunk } from '../services/sttService';

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
  
  const session: SessionState = {
    sessionId,
    eventId,
    eventName: eventData.name,
    songs: eventData.songs,
    currentSongIndex: 0,
    currentSlideIndex: 0,
    rollingBuffer: '',
    isActive: true,
  };

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

/**
 * Handle AUDIO_DATA message
 * Processes audio chunks for transcription
 */
async function handleAudioData(
  ws: WebSocket,
  data: string,
  receivedAt: number
): Promise<void> {
  const processingStart = Date.now();
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }

  console.log(`[WS] Received audio chunk: ${data.length} bytes (base64)`);

  // Send audio to STT service (Google Cloud or mock)
  try {
    const transcriptionResult = await transcribeAudioChunk(data);
    
    if (transcriptionResult) {
      // Send transcription update to client
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
      
      // Update rolling buffer with transcription
      // This will be used for matching against setlist
      if (transcriptionResult.isFinal) {
        session.rollingBuffer += ' ' + transcriptionResult.text;
        // Keep only last 100 words for matching
        const words = session.rollingBuffer.split(' ');
        if (words.length > 100) {
          session.rollingBuffer = words.slice(-100).join(' ');
        }
        
        console.log(`[WS] Rolling buffer updated: "${session.rollingBuffer.slice(-50)}..."`);
        
        // TODO: Phase 3 - Perform fuzzy matching against current song lines
        // For now, just log that we have text to match
      }
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
  send(ws, displayUpdate);

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
      await handleAudioData(ws, message.payload.data, receivedAt);
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
    sessions.delete(ws);
  }
}

/**
 * Get current session count
 */
export function getSessionCount(): number {
  return sessions.size;
}

