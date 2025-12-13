/**
 * WebSocket Message Types
 * 
 * Defines the protocol for communication between frontend and backend
 * Based on the ParLeap Master Design Document
 */

// ============================================
// Client-to-Server Message Types
// ============================================

/**
 * START_SESSION - Initialize an event session
 * Sent when operator starts a live presentation
 */
export interface StartSessionMessage {
  type: 'START_SESSION';
  payload: {
    eventId: string;
  };
}

/**
 * AUDIO_DATA - Stream audio chunks for transcription
 * Sent continuously during live audio capture
 */
export interface AudioDataMessage {
  type: 'AUDIO_DATA';
  payload: {
    /** Base64 encoded audio chunk */
    data: string;
    /** Audio format metadata */
    format?: {
      sampleRate?: number;
      channels?: number;
      encoding?: string;
    };
  };
}

/**
 * MANUAL_OVERRIDE - Manual slide control
 * Sent when operator manually changes slides
 */
export interface ManualOverrideMessage {
  type: 'MANUAL_OVERRIDE';
  payload: {
    action: 'NEXT_SLIDE' | 'PREV_SLIDE' | 'GO_TO_SLIDE';
    slideIndex?: number;
    songId?: string;
  };
}

/**
 * STOP_SESSION - End the current session
 * Sent when operator ends the presentation
 */
export interface StopSessionMessage {
  type: 'STOP_SESSION';
}

/**
 * PING - Keep-alive message
 */
export interface PingMessage {
  type: 'PING';
}

/**
 * All client-to-server message types
 */
export type ClientMessage =
  | StartSessionMessage
  | AudioDataMessage
  | ManualOverrideMessage
  | StopSessionMessage
  | PingMessage;

// ============================================
// Server-to-Client Message Types
// ============================================

/**
 * SESSION_STARTED - Confirms session initialization
 */
export interface SessionStartedMessage {
  type: 'SESSION_STARTED';
  payload: {
    sessionId: string;
    eventId: string;
    eventName: string;
    totalSongs: number;
    currentSongIndex: number;
    currentSlideIndex: number;
  };
}

/**
 * TRANSCRIPT_UPDATE - Real-time transcription text
 * Sent as audio is transcribed
 */
export interface TranscriptUpdateMessage {
  type: 'TRANSCRIPT_UPDATE';
  payload: {
    text: string;
    isFinal: boolean;
    confidence?: number;
  };
}

/**
 * DISPLAY_UPDATE - Slide change notification
 * Sent when the displayed slide should change
 */
export interface DisplayUpdateMessage {
  type: 'DISPLAY_UPDATE';
  payload: {
    lineText: string;
    slideIndex: number;
    songId: string;
    songTitle: string;
    matchConfidence?: number;
    isAutoAdvance: boolean;
  };
}

/**
 * SONG_CHANGED - Current song changed
 */
export interface SongChangedMessage {
  type: 'SONG_CHANGED';
  payload: {
    songId: string;
    songTitle: string;
    songIndex: number;
    totalSlides: number;
  };
}

/**
 * SESSION_ENDED - Session has ended
 */
export interface SessionEndedMessage {
  type: 'SESSION_ENDED';
  payload: {
    sessionId: string;
    reason: 'user_stopped' | 'error' | 'timeout';
  };
}

/**
 * ERROR - Error notification
 */
export interface ErrorMessage {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * PONG - Response to PING
 */
export interface PongMessage {
  type: 'PONG';
  payload: {
    timestamp: string;
  };
}

/**
 * All server-to-client message types
 */
export type ServerMessage =
  | SessionStartedMessage
  | TranscriptUpdateMessage
  | DisplayUpdateMessage
  | SongChangedMessage
  | SessionEndedMessage
  | ErrorMessage
  | PongMessage;

// ============================================
// Message Type Guards
// ============================================

export function isClientMessage(msg: unknown): msg is ClientMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as { type: unknown }).type === 'string'
  );
}

export function isStartSessionMessage(msg: ClientMessage): msg is StartSessionMessage {
  return msg.type === 'START_SESSION';
}

export function isAudioDataMessage(msg: ClientMessage): msg is AudioDataMessage {
  return msg.type === 'AUDIO_DATA';
}

export function isManualOverrideMessage(msg: ClientMessage): msg is ManualOverrideMessage {
  return msg.type === 'MANUAL_OVERRIDE';
}

export function isStopSessionMessage(msg: ClientMessage): msg is StopSessionMessage {
  return msg.type === 'STOP_SESSION';
}

export function isPingMessage(msg: ClientMessage): msg is PingMessage {
  return msg.type === 'PING';
}

