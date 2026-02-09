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

export interface UpdateEventSettingsMessage {
  type: 'UPDATE_EVENT_SETTINGS';
  payload: {
    projectorFont?: string;
    bibleMode?: boolean;
    bibleVersionId?: string | null;
    bibleFollow?: boolean;
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
  | UpdateEventSettingsMessage
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

export interface SessionStartedMessage {
  type: 'SESSION_STARTED';
  payload: {
    sessionId: string;
    eventId: string;
    eventName: string;
    projectorFont?: string | null;
    bibleMode?: boolean;
    bibleVersionId?: string | null;
    bibleFollow?: boolean;
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
    setlistItems?: Array<{
      id: string;
      type: 'SONG' | 'BIBLE' | 'MEDIA';
      sequenceOrder: number;
      songId?: string;
      bibleRef?: string;
      mediaUrl?: string;
      mediaTitle?: string;
    }>; // Polymorphic setlist items
  };
  timing?: TimingMetadata;
}

export interface EventSettingsUpdatedMessage {
  type: 'EVENT_SETTINGS_UPDATED';
  payload: {
    projectorFont?: string | null;
    bibleMode?: boolean;
    bibleVersionId?: string | null;
    bibleFollow?: boolean;
  };
  timing?: TimingMetadata;
}

export interface TranscriptUpdateMessage {
  type: 'TRANSCRIPT_UPDATE';
  payload: {
    text: string;
    isFinal: boolean;
    confidence?: number;
  };
  timing?: TimingMetadata;
}

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

export interface SessionEndedMessage {
  type: 'SESSION_ENDED';
  payload: {
    sessionId: string;
    reason: 'user_stopped' | 'error' | 'timeout';
  };
  timing?: TimingMetadata;
}

export interface ErrorMessage {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    details?: unknown;
  };
  timing?: TimingMetadata;
}

export interface PongMessage {
  type: 'PONG';
  payload: {
    timestamp: string;
  };
  timing?: TimingMetadata;
}

export type ServerMessage =
  | SessionStartedMessage
  | EventSettingsUpdatedMessage
  | TranscriptUpdateMessage
  | DisplayUpdateMessage
  | SongChangedMessage
  | SongSuggestionMessage
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

export function isEventSettingsUpdatedMessage(msg: ServerMessage): msg is EventSettingsUpdatedMessage {
  return msg.type === 'EVENT_SETTINGS_UPDATED';
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

export function isSongSuggestionMessage(msg: ServerMessage): msg is SongSuggestionMessage {
  return msg.type === 'SONG_SUGGESTION';
}

export function isErrorMessage(msg: ServerMessage): msg is ErrorMessage {
  return msg.type === 'ERROR';
}

export function isPongMessage(msg: ServerMessage): msg is PongMessage {
  return msg.type === 'PONG';
}
