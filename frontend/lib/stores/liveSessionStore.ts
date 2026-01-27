import { create } from 'zustand';
import type { Database } from '@/lib/supabase/types';
import type { DisplayUpdateMessage } from '@/lib/websocket/types';

type Song = Database['public']['Tables']['songs']['Row'];

interface LiveSessionState {
  eventId: string | null;
  isActive: boolean;
  currentSlide: number;
  currentSong: Song | null;
  currentSongIndex: number;
  currentLineText: string | null;
  songTitle: string | null;
  
  // PHASE 3: Adaptive Live Mode state
  isAutoFollowing: boolean; // Whether AI auto-switching is enabled
  lastMatchConfidence: number; // Most recent match confidence (for debugging)
  
  // Actions
  startSession: (eventId: string) => void;
  stopSession: () => void;
  setCurrentSlide: (slideIndex: number) => void;
  setCurrentSong: (song: Song | null, songIndex: number) => void;
  updateFromDisplayMessage: (message: DisplayUpdateMessage) => void;
  setAutoFollowing: (enabled: boolean) => void;
  setMatchConfidence: (confidence: number) => void;
  reset: () => void;
}

export const useLiveSessionStore = create<LiveSessionState>((set) => ({
  eventId: null,
  isActive: false,
  currentSlide: 0,
  currentSong: null,
  currentSongIndex: -1,
  currentLineText: null,
  songTitle: null,
  isAutoFollowing: true, // PHASE 3: Default to auto-follow enabled
  lastMatchConfidence: 0, // PHASE 3: Track confidence for debugging

  startSession: (eventId) => {
    set({
      eventId,
      isActive: true,
      currentSlide: 0,
      currentSong: null,
      currentSongIndex: -1,
      currentLineText: null,
      songTitle: null,
      isAutoFollowing: true,
      lastMatchConfidence: 0,
    });
  },

  stopSession: () => {
    set({
      isActive: false,
      currentSlide: 0,
      currentSong: null,
      currentSongIndex: -1,
      currentLineText: null,
      songTitle: null,
    });
  },

  setCurrentSlide: (slideIndex) => {
    set({ currentSlide: slideIndex });
  },

  setCurrentSong: (song, songIndex) => {
    set({
      currentSong: song,
      currentSongIndex: songIndex,
      songTitle: song?.title || null,
    });
  },

  updateFromDisplayMessage: (message) => {
    const { lineText, slideIndex, songTitle, matchConfidence } = message.payload;
    set({
      currentSlide: slideIndex,
      currentLineText: lineText,
      songTitle: songTitle || null,
      lastMatchConfidence: matchConfidence || 0, // PHASE 3: Update confidence
    });
  },

  // PHASE 3: Toggle auto-follow mode
  setAutoFollowing: (enabled) => {
    set({ isAutoFollowing: enabled });
  },

  // PHASE 3: Update match confidence (for debugging UI)
  setMatchConfidence: (confidence) => {
    set({ lastMatchConfidence: confidence });
  },

  reset: () => {
    set({
      eventId: null,
      isActive: false,
      currentSlide: 0,
      currentSong: null,
      currentSongIndex: -1,
      currentLineText: null,
      songTitle: null,
      isAutoFollowing: true,
      lastMatchConfidence: 0,
    });
  },
}));
