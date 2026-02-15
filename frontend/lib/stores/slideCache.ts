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
  lines: string[]; // For backward compatibility and matching
  slides?: Array<{
    lines: string[];
    slideText: string;
  }>; // Compiled multi-line slides
  lineToSlideIndex?: number[]; // Mapping: lineIndex -> slideIndex
}

export interface CachedSetlistItem {
  id: string;
  type: 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT';
  sequenceOrder: number;
  songId?: string;
  bibleRef?: string;
  mediaUrl?: string;
  mediaTitle?: string;
  announcementSlides?: Array<{ url: string; type: 'image' | 'video'; title?: string }>;
}

export interface CachedSetlist {
  eventId: string;
  eventName: string;
  songs: CachedSong[];
  setlistItems?: CachedSetlistItem[]; // Polymorphic setlist items
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
  cacheSetlist: (eventId: string, eventName: string, songs: CachedSong[], setlistItems?: CachedSetlistItem[]) => void;
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

  cacheSetlist: (eventId, eventName, songs, setlistItems) => {
    set({
      setlist: {
        eventId,
        eventName,
        songs,
        setlistItems,
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
      
      // Get slide count (use slides if available, otherwise lines)
      const slideCount = song.slides?.length ?? song.lines.length;
      
      // If we've reached the end of this song, move to next song
      if (slideIdx >= slideCount) {
        songIdx++;
        slideIdx = 0;
        
        // If we've reached the end of all songs, stop
        if (songIdx >= setlist.songs.length) {
          break;
        }
      } else {
        // Get slide text
        let lineText = '';
        if (song.slides && slideIdx < song.slides.length) {
          lineText = song.slides[slideIdx].slideText;
        } else if (slideIdx < song.lines.length) {
          lineText = song.lines[slideIdx];
        }
        
        // Add this slide to preloaded list
        preloaded.push({
          songId: song.id,
          songTitle: song.title,
          slideIndex: slideIdx,
          lineText,
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
    const slideCount = song.slides?.length ?? song.lines.length;
    
    if (slideIndex < 0 || slideIndex >= slideCount) {
      return null;
    }

    // Get slide text
    let lineText = '';
    if (song.slides && slideIndex < song.slides.length) {
      lineText = song.slides[slideIndex].slideText;
    } else if (slideIndex < song.lines.length) {
      lineText = song.lines[slideIndex];
    }

    return {
      songId: song.id,
      songTitle: song.title,
      lineText,
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

