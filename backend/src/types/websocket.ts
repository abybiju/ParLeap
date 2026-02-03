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
 * Timing metadata included in server responses for latency measurement
 */
export interface TimingMetadata {
  serverReceivedAt: number;  // When server received the client message
  serverSentAt: number;      // When server sent this response
  processingTimeMs: number;  // Time spent processing (AI, matching, etc.)
}

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
    currentSlideIndex: number; // Now refers to slide index (not line index)
    setlist?: Array<{
      id: string;
      title: string;
      artist?: string;
      lines: string[]; // For backward compatibility and matching
      slides?: Array<{
        lines: string[];
        slideText: string;
      }>; // Compiled multi-line slides
      lineToSlideIndex?: number[]; // Mapping: lineIndex -> slideIndex
    }>;
  };
  timing?: TimingMetadata;
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
  timing?: TimingMetadata;
}

/**
 * DISPLAY_UPDATE - Slide change notification
 * Sent when the displayed slide should change
 */
export interface DisplayUpdateMessage {
  type: 'DISPLAY_UPDATE';
  payload: {
    lineText: string; // Backward compatibility (first line of slide)
    slideText?: string; // Multi-line slide text (lines joined with \n)
    slideLines?: string[]; // Array of lines in the slide
    slideIndex: number; // Slide index (not line index)
    lineIndex?: number; // Current line index (for debugging/telemetry)
    songId: string;
    songTitle: string;
    matchConfidence?: number;
    isAutoAdvance: boolean;
  };
  timing?: TimingMetadata;
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
  timing?: TimingMetadata;
}

/**
 * SONG_SUGGESTION - AI detected a possible song switch (medium confidence 60-85%)
 * Sent when matcher finds better match in different song but not confident enough to auto-switch
 */
export interface SongSuggestionMessage {
  type: 'SONG_SUGGESTION';
  payload: {
    suggestedSongId: string;
    suggestedSongTitle: string;
    suggestedSongIndex: number;
    confidence: number;
    matchedLine: string;
  };
  timing?: TimingMetadata;
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
  timing?: TimingMetadata;
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
  timing?: TimingMetadata;
}

/**
 * PONG - Response to PING
 */
export interface PongMessage {
  type: 'PONG';
  payload: {
    timestamp: string;
  };
  timing?: TimingMetadata;
}

/**
 * All server-to-client message types
 */
export type ServerMessage =
  | SessionStartedMessage
  | TranscriptUpdateMessage
  | DisplayUpdateMessage
  | SongChangedMessage
  | SongSuggestionMessage
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

