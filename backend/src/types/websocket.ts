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
    /** When true, backend uses Smart Listen gate for non-SONG items (only start STT on STT_WINDOW_REQUEST). */
    smartListenEnabled?: boolean;
  };
}

/**
 * UPDATE_EVENT_SETTINGS - Update event-level settings (e.g., projector font)
 */
export interface UpdateEventSettingsMessage {
  type: 'UPDATE_EVENT_SETTINGS';
  payload: {
    projectorFont?: string;
    bibleMode?: boolean;
    bibleVersionId?: string | null;
    bibleFollow?: boolean;
    smartListenEnabled?: boolean;
    backgroundImageUrl?: string | null;
    backgroundMediaType?: string | null;
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
    action: 'NEXT_SLIDE' | 'PREV_SLIDE' | 'GO_TO_SLIDE' | 'GO_TO_ITEM';
    slideIndex?: number;
    songId?: string;
    itemIndex?: number;
    /** When itemIndex is out of range (e.g. frontend has merged setlist), backend can resolve by id */
    itemId?: string;
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
 * STT_WINDOW_REQUEST - Request to start STT for Smart Bible Listen (gatekeeper pattern).
 * When Smart Listen is on, backend does not start ElevenLabs until this message.
 * Optional catch-up audio (e.g. last 3–10s from ring buffer) can be sent to reduce latency.
 */
export interface SttWindowRequestMessage {
  type: 'STT_WINDOW_REQUEST';
  payload: {
    /** Optional: base64-encoded PCM audio (ring buffer) to send before live stream */
    catchUpAudio?: string;
  };
}

/**
 * All client-to-server message types
 */
export type ClientMessage =
  | StartSessionMessage
  | UpdateEventSettingsMessage
  | AudioDataMessage
  | ManualOverrideMessage
  | StopSessionMessage
  | PingMessage
  | SttWindowRequestMessage;

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
    projectorFont?: string | null;
    bibleMode?: boolean;
    bibleVersionId?: string | null;
    bibleFollow?: boolean;
    backgroundImageUrl?: string | null;
    backgroundMediaType?: string | null;
    totalSongs: number;
    currentSongIndex: number;
    currentItemIndex?: number; // Index in polymorphic setlist
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
      type: 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT';
      sequenceOrder: number;
      songId?: string;
      bibleRef?: string;
      mediaUrl?: string;
      mediaTitle?: string;
      announcementSlides?: Array<{
        url?: string;
        type?: 'image' | 'video';
        title?: string;
        structuredText?: { title?: string; subtitle?: string; date?: string; lines?: string[] };
      }>;
    }>; // Polymorphic setlist items
    /** Initial display state so projector can show first slide from SESSION_STARTED alone */
    initialDisplay?: {
      lineText: string;
      slideText?: string;
      slideLines?: string[];
      slideIndex: number;
      lineIndex?: number;
      songId: string;
      songTitle: string;
      isAutoAdvance: boolean;
      currentItemIndex?: number;
      slideImageUrl?: string;
      slideVideoUrl?: string;
      displayType?: 'lyrics' | 'image' | 'video';
    };
  };
  timing?: TimingMetadata;
}

/**
 * EVENT_SETTINGS_UPDATED - Broadcast updated event settings to clients
 */
export interface EventSettingsUpdatedMessage {
  type: 'EVENT_SETTINGS_UPDATED';
  payload: {
    projectorFont?: string | null;
    bibleMode?: boolean;
    bibleVersionId?: string | null;
    bibleFollow?: boolean;
    backgroundImageUrl?: string | null;
    backgroundMediaType?: string | null;
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
    currentItemIndex?: number; // Index in polymorphic setlist (songs, Bible, media, announcement)
    /** Next verse text for Bible (operator next-slide preview) */
    nextVerseText?: string;
    /** Next verse reference e.g. "Romans 1:4" for Bible */
    nextVerseRef?: string;
    /** For ANNOUNCEMENT: image URL to show full-screen */
    slideImageUrl?: string;
    /** For ANNOUNCEMENT: video URL to show full-screen */
    slideVideoUrl?: string;
    /** Display mode: lyrics (default), image, or video */
    displayType?: 'lyrics' | 'image' | 'video';
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
 * SONG_SUGGESTION - AI detected a possible song switch (low confidence <50%)
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
  | EventSettingsUpdatedMessage
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

export function isUpdateEventSettingsMessage(msg: ClientMessage): msg is UpdateEventSettingsMessage {
  return msg.type === 'UPDATE_EVENT_SETTINGS';
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

export function isSttWindowRequestMessage(msg: ClientMessage): msg is SttWindowRequestMessage {
  return msg.type === 'STT_WINDOW_REQUEST';
}
