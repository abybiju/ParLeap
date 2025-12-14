/**
 * Slide Cache Store
 * 
 * Caches song lyrics locally for offline/fallback use
 */

import { create } from 'zustand';

export interface CachedSong {
  id: string;
  title: string;
  artist?: string;
  lines: string[];
}

export interface CachedSetlist {
  eventId: string;
  eventName: string;
  songs: CachedSong[];
  cachedAt: number;
}

interface SlideCacheState {
  setlist: CachedSetlist | null;
  preloadedSlides: Array<{
    songId: string;
    songTitle: string;
    slideIndex: number;
    lineText: string;
  }>;
  
  // Actions
  cacheSetlist: (eventId: string, eventName: string, songs: CachedSong[]) => void;
  preloadNextSlides: (currentSongIndex: number, currentSlideIndex: number, count?: number) => void;
  getSlide: (songIndex: number, slideIndex: number) => { songId: string; songTitle: string; lineText: string } | null;
  getNextSlides: (currentSongIndex: number, currentSlideIndex: number, count?: number) => Array<{
    songId: string;
    songTitle: string;
    slideIndex: number;
    lineText: string;
  }>;
  clear: () => void;
}

export const useSlideCache = create<SlideCacheState>((set, get) => ({
  setlist: null,
  preloadedSlides: [],

  cacheSetlist: (eventId, eventName, songs) => {
    set({
      setlist: {
        eventId,
        eventName,
        songs,
        cachedAt: Date.now(),
      },
      preloadedSlides: [],
    });
    
    // Preload initial slides
    get().preloadNextSlides(0, 0);
  },

  preloadNextSlides: (currentSongIndex, currentSlideIndex, count = 3) => {
    const { setlist } = get();
    if (!setlist || setlist.songs.length === 0) {
      return;
    }

    const preloaded: Array<{
      songId: string;
      songTitle: string;
      slideIndex: number;
      lineText: string;
    }> = [];

    let songIdx = currentSongIndex;
    let slideIdx = currentSlideIndex;
    let remaining = count;

    while (remaining > 0 && songIdx < setlist.songs.length) {
      const song = setlist.songs[songIdx];
      
      // Start from next slide
      slideIdx++;
      
      // If we've reached the end of this song, move to next song
      if (slideIdx >= song.lines.length) {
        songIdx++;
        slideIdx = 0;
        
        // If we've reached the end of all songs, stop
        if (songIdx >= setlist.songs.length) {
          break;
        }
      } else {
        // Add this slide to preloaded list
        preloaded.push({
          songId: song.id,
          songTitle: song.title,
          slideIndex: slideIdx,
          lineText: song.lines[slideIdx],
        });
        remaining--;
      }
    }

    set({ preloadedSlides: preloaded });
  },

  getSlide: (songIndex, slideIndex) => {
    const { setlist } = get();
    if (!setlist || songIndex < 0 || songIndex >= setlist.songs.length) {
      return null;
    }

    const song = setlist.songs[songIndex];
    if (slideIndex < 0 || slideIndex >= song.lines.length) {
      return null;
    }

    return {
      songId: song.id,
      songTitle: song.title,
      lineText: song.lines[slideIndex],
    };
  },

  getNextSlides: (_currentSongIndex, _currentSlideIndex, count = 3) => {
    // Parameters are kept for API consistency but not used since we return from preloadedSlides
    return get().preloadedSlides.slice(0, count);
  },

  clear: () => {
    set({
      setlist: null,
      preloadedSlides: [],
    });
  },
}));

