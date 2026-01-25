'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { SongFormData } from '@/lib/schemas/song';

const DRAFT_KEY = 'parleap_song_draft';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_SAVE_DELAY_MS = 2000; // 2 seconds debounce

interface StoredDraft {
  data: Partial<SongFormData>;
  timestamp: number;
}

export function useSongDraft(songId?: string) {
  const key = songId ? `${DRAFT_KEY}_${songId}` : `${DRAFT_KEY}_new`;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const saveDraft = useCallback((data: Partial<SongFormData>) => {
    if (typeof window === 'undefined') return;
    
    try {
      const draft: StoredDraft = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(draft));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [key]);

  const saveDraftDebounced = useCallback((data: Partial<SongFormData>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      saveDraft(data);
    }, AUTO_SAVE_DELAY_MS);
  }, [saveDraft]);

  const loadDraft = useCallback((): Partial<SongFormData> | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const { data, timestamp }: StoredDraft = JSON.parse(stored);
      
      // Expire drafts after 24 hours
      if (Date.now() - timestamp > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [key]);

  const hasDraft = useCallback((): boolean => {
    return loadDraft() !== null;
  }, [loadDraft]);

  return { 
    saveDraft, 
    saveDraftDebounced, 
    loadDraft, 
    clearDraft, 
    hasDraft 
  };
}
