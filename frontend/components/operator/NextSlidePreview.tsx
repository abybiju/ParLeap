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
  const [nextSlideLines, setNextSlideLines] = useState<string[] | null>(null);
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
      setNextSlideLines(null);
      return;
    }

    const currentSong = slideCache.setlist.songs[currentSongIndex];
    if (!currentSong) {
      setNextSlideLines(null);
      return;
    }

    // Check if there's a next slide in current song
    const slideCount = currentSong.slides?.length ?? currentSong.lines.length;
    if (currentSlideIndex < slideCount - 1) {
      const nextSlideIndex = currentSlideIndex + 1;
      if (currentSong.slides && nextSlideIndex < currentSong.slides.length) {
        setNextSlideLines(currentSong.slides[nextSlideIndex].lines);
        return;
      } else if (nextSlideIndex < currentSong.lines.length) {
        // Fallback: single line
        setNextSlideLines([currentSong.lines[nextSlideIndex]]);
        return;
      }
    }

    // Check if there's a next song
    if (currentSongIndex < slideCache.setlist.songs.length - 1) {
      const nextSong = slideCache.setlist.songs[currentSongIndex + 1];
      if (nextSong) {
        if (nextSong.slides && nextSong.slides.length > 0) {
          setNextSlideLines(nextSong.slides[0].lines);
          return;
        } else if (nextSong.lines.length > 0) {
          setNextSlideLines([nextSong.lines[0]]);
          return;
        }
      }
    }

    // No next slide
    setNextSlideLines(null);
  }, [slideCache.setlist, currentSongIndex, currentSlideIndex]);

  if (!nextSlideLines || nextSlideLines.length === 0) {
    return (
      <div className="mt-4 p-3 rounded-lg border border-white/10 bg-white/5">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Next Slide</p>
        <p className="text-sm text-slate-600 italic">End of setlist</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 rounded-lg border border-white/10 bg-white/5">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Next Slide</p>
      <div className="space-y-0.5">
        {nextSlideLines.map((line, index) => (
          <p key={index} className="text-sm text-slate-300 font-light leading-snug">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
