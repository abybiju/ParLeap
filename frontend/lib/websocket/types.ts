/**
 * WebSocket Message Types (Frontend)
 * 
 * Mirrors the backend types for type-safe communication
 */

// ============================================
// Client-to-Server Message Types
// ============================================

export interface StartSessionMessage {
  type: 'START_SESSION';
  payload: {
    eventId: string;
  };
}

export interface AudioDataMessage {
  type: 'AUDIO_DATA';
  payload: {
    data: string; // Base64 encoded audio chunk
    format?: {
      sampleRate?: number;
      channels?: number;
      encoding?: string;
    };
  };
}

export interface ManualOverrideMessage {
  type: 'MANUAL_OVERRIDE';
  payload: {
    action: 'NEXT_SLIDE' | 'PREV_SLIDE' | 'GO_TO_SLIDE';
    slideIndex?: number;
    songId?: string;
  };
}

export interface StopSessionMessage {
  type: 'STOP_SESSION';
}

export interface PingMessage {
  type: 'PING';
}

export type ClientMessage =
  | StartSessionMessage
  | AudioDataMessage
  | ManualOverrideMessage
  | StopSessionMessage
  | PingMessage;

// ============================================
// Server-to-Client Message Types
// ============================================

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

export interface TranscriptUpdateMessage {
  type: 'TRANSCRIPT_UPDATE';
  payload: {
    text: string;
    isFinal: boolean;
    confidence?: number;
  };
}

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

export interface SongChangedMessage {
  type: 'SONG_CHANGED';
  payload: {
    songId: string;
    songTitle: string;
    songIndex: number;
    totalSlides: number;
  };
}

export interface SessionEndedMessage {
  type: 'SESSION_ENDED';
  payload: {
    sessionId: string;
    reason: 'user_stopped' | 'error' | 'timeout';
  };
}

export interface ErrorMessage {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PongMessage {
  type: 'PONG';
  payload: {
    timestamp: string;
  };
}

export type ServerMessage =
  | SessionStartedMessage
  | TranscriptUpdateMessage
  | DisplayUpdateMessage
  | SongChangedMessage
  | SessionEndedMessage
  | ErrorMessage
  | PongMessage;

// ============================================
// Type Guards
// ============================================

export function isServerMessage(msg: unknown): msg is ServerMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as { type: unknown }).type === 'string'
  );
}

export function isSessionStartedMessage(msg: ServerMessage): msg is SessionStartedMessage {
  return msg.type === 'SESSION_STARTED';
}

export function isTranscriptUpdateMessage(msg: ServerMessage): msg is TranscriptUpdateMessage {
  return msg.type === 'TRANSCRIPT_UPDATE';
}

export function isDisplayUpdateMessage(msg: ServerMessage): msg is DisplayUpdateMessage {
  return msg.type === 'DISPLAY_UPDATE';
}

export function isSongChangedMessage(msg: ServerMessage): msg is SongChangedMessage {
  return msg.type === 'SONG_CHANGED';
}

export function isSessionEndedMessage(msg: ServerMessage): msg is SessionEndedMessage {
  return msg.type === 'SESSION_ENDED';
}

export function isErrorMessage(msg: ServerMessage): msg is ErrorMessage {
  return msg.type === 'ERROR';
}

export function isPongMessage(msg: ServerMessage): msg is PongMessage {
  return msg.type === 'PONG';
}

