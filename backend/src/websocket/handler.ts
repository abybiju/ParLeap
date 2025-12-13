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
  type ErrorMessage,
  type PongMessage,
  isStartSessionMessage,
  isAudioDataMessage,
  isManualOverrideMessage,
  isStopSessionMessage,
  isPingMessage,
} from '../types/websocket';
import { validateClientMessage } from '../types/schemas';

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

interface SongData {
  id: string;
  title: string;
  lines: string[];
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
 * Initializes session state and loads event data
 */
async function handleStartSession(
  ws: WebSocket,
  eventId: string
): Promise<void> {
  console.log(`[WS] Starting session for event: ${eventId}`);

  // Check if session already exists
  if (sessions.has(ws)) {
    sendError(ws, 'SESSION_EXISTS', 'A session is already active for this connection');
    return;
  }

  // TODO: Fetch event data from Supabase
  // For now, create a mock session
  const sessionId = `session_${Date.now()}`;
  
  // Mock event data - will be replaced with Supabase fetch
  const mockSongs: SongData[] = [
    {
      id: 'song_1',
      title: 'Amazing Grace',
      lines: [
        'Amazing grace how sweet the sound',
        'That saved a wretch like me',
        'I once was lost but now am found',
        'Was blind but now I see',
      ],
    },
    {
      id: 'song_2',
      title: 'How Great Thou Art',
      lines: [
        'O Lord my God when I in awesome wonder',
        'Consider all the worlds thy hands have made',
        'I see the stars I hear the rolling thunder',
        'Thy power throughout the universe displayed',
      ],
    },
  ];

  const session: SessionState = {
    sessionId,
    eventId,
    eventName: 'Demo Event', // Will be fetched from Supabase
    songs: mockSongs,
    currentSongIndex: 0,
    currentSlideIndex: 0,
    rollingBuffer: '',
    isActive: true,
  };

  sessions.set(ws, session);

  // Send session started confirmation
  const response: SessionStartedMessage = {
    type: 'SESSION_STARTED',
    payload: {
      sessionId,
      eventId,
      eventName: session.eventName,
      totalSongs: session.songs.length,
      currentSongIndex: 0,
      currentSlideIndex: 0,
    },
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
    };
    send(ws, displayUpdate);
  }

  console.log(`[WS] Session started: ${sessionId}`);
}

/**
 * Handle AUDIO_DATA message
 * Processes audio chunks for transcription
 */
async function handleAudioData(
  ws: WebSocket,
  data: string
): Promise<void> {
  const session = sessions.get(ws);
  if (!session || !session.isActive) {
    sendError(ws, 'NO_SESSION', 'No active session. Call START_SESSION first.');
    return;
  }

  // TODO: Forward audio to STT provider (Google Cloud Speech-to-Text or ElevenLabs)
  // For now, log that we received audio data
  console.log(`[WS] Received audio chunk: ${data.length} bytes`);

  // Mock transcription response
  // In real implementation, this would come from the STT provider
  const mockTranscript: TranscriptUpdateMessage = {
    type: 'TRANSCRIPT_UPDATE',
    payload: {
      text: '[Audio received - transcription pending]',
      isFinal: false,
    },
  };
  send(ws, mockTranscript);
}

/**
 * Handle MANUAL_OVERRIDE message
 * Allows operator to manually control slides
 */
function handleManualOverride(
  ws: WebSocket,
  action: 'NEXT_SLIDE' | 'PREV_SLIDE' | 'GO_TO_SLIDE',
  slideIndex?: number,
  songId?: string
): void {
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

  // Update session state
  session.currentSongIndex = newSongIndex;
  session.currentSlideIndex = newSlideIndex;

  const targetSong = session.songs[newSongIndex];

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
  };
  send(ws, displayUpdate);

  console.log(`[WS] Manual override: ${action} -> Song ${newSongIndex}, Slide ${newSlideIndex}`);
}

/**
 * Handle STOP_SESSION message
 * Ends the current session
 */
function handleStopSession(ws: WebSocket): void {
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
  });

  console.log(`[WS] Session ended: ${sessionId}`);
}

/**
 * Handle PING message
 * Responds with PONG for keep-alive
 */
function handlePing(ws: WebSocket): void {
  const pong: PongMessage = {
    type: 'PONG',
    payload: {
      timestamp: new Date().toISOString(),
    },
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
      await handleStartSession(ws, message.payload.eventId);
    } else if (isAudioDataMessage(message)) {
      await handleAudioData(ws, message.payload.data);
    } else if (isManualOverrideMessage(message)) {
      handleManualOverride(
        ws,
        message.payload.action,
        message.payload.slideIndex,
        message.payload.songId
      );
    } else if (isStopSessionMessage(message)) {
      handleStopSession(ws);
    } else if (isPingMessage(message)) {
      handlePing(ws);
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

