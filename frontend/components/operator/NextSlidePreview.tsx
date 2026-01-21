'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useSlideCache } from '@/lib/stores/slideCache';
import { isDisplayUpdateMessage, isSessionStartedMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';

/**
 * Next Slide Preview Component
 * 
 * Shows a preview of the next slide that will be displayed
 */
export function NextSlidePreview() {
  const { lastMessage } = useWebSocket(false);
  const slideCache = useSlideCache();
  const [nextSlideText, setNextSlideText] = useState<string | null>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  useEffect(() => {
    if (!lastMessage) return;

    if (isSessionStartedMessage(lastMessage)) {
      setCurrentSongIndex(lastMessage.payload.currentSongIndex);
      setCurrentSlideIndex(lastMessage.payload.currentSlideIndex);
    }

    if (isDisplayUpdateMessage(lastMessage)) {
      const displayMsg = lastMessage as DisplayUpdateMessage;
      setCurrentSlideIndex(displayMsg.payload.slideIndex);
      
      // Find current song index from setlist
      if (slideCache.setlist) {
        const songIndex = slideCache.setlist.songs.findIndex(
          (s) => s.id === displayMsg.payload.songId
        );
        if (songIndex !== -1) {
          setCurrentSongIndex(songIndex);
        }
      }
    }
  }, [lastMessage, slideCache.setlist]);

  useEffect(() => {
    if (!slideCache.setlist) {
      setNextSlideText(null);
      return;
    }

    const currentSong = slideCache.setlist.songs[currentSongIndex];
    if (!currentSong) {
      setNextSlideText(null);
      return;
    }

    // Check if there's a next slide in current song
    if (currentSlideIndex < currentSong.lines.length - 1) {
      const nextLine = currentSong.lines[currentSlideIndex + 1];
      setNextSlideText(nextLine);
      return;
    }

    // Check if there's a next song
    if (currentSongIndex < slideCache.setlist.songs.length - 1) {
      const nextSong = slideCache.setlist.songs[currentSongIndex + 1];
      if (nextSong && nextSong.lines.length > 0) {
        setNextSlideText(nextSong.lines[0]);
        return;
      }
    }

    // No next slide
    setNextSlideText(null);
  }, [slideCache.setlist, currentSongIndex, currentSlideIndex]);

  if (!nextSlideText) {
    return (
      <div className="mt-6 p-4 rounded-lg border border-white/10 bg-white/5">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Next Slide</p>
        <p className="text-sm text-slate-600 italic">End of setlist</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 rounded-lg border border-white/10 bg-white/5">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Next Slide</p>
      <p className="text-lg text-slate-300 font-light leading-relaxed">{nextSlideText}</p>
    </div>
  );
}
