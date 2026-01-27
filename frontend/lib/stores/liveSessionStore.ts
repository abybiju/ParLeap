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
  
  // Actions
  startSession: (eventId: string) => void;
  stopSession: () => void;
  setCurrentSlide: (slideIndex: number) => void;
  setCurrentSong: (song: Song | null, songIndex: number) => void;
  updateFromDisplayMessage: (message: DisplayUpdateMessage) => void;
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

  startSession: (eventId) => {
    set({
      eventId,
      isActive: true,
      currentSlide: 0,
      currentSong: null,
      currentSongIndex: -1,
      currentLineText: null,
      songTitle: null,
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
    const { lineText, slideIndex, songTitle } = message.payload;
    set({
      currentSlide: slideIndex,
      currentLineText: lineText,
      songTitle: songTitle || null,
    });
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
    });
  },
}));
