'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useSlideCache } from '@/lib/stores/slideCache';
import { isDisplayUpdateMessage, isSessionStartedMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

/**
 * Setlist Panel Component
 * 
 * Displays the full setlist with current song/slide highlighted
 */
export function SetlistPanel() {
  const { lastMessage } = useWebSocket(false);
  const slideCache = useSlideCache();
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  useEffect(() => {
    if (!lastMessage) return;

    if (isSessionStartedMessage(lastMessage)) {
      setCurrentSlideIndex(lastMessage.payload.currentSlideIndex);
      if (slideCache.setlist && slideCache.setlist.songs.length > 0) {
        setCurrentSongId(slideCache.setlist.songs[lastMessage.payload.currentSongIndex]?.id || null);
      }
    }

    if (isDisplayUpdateMessage(lastMessage)) {
      const displayMsg = lastMessage as DisplayUpdateMessage;
      setCurrentSongId(displayMsg.payload.songId);
      setCurrentSlideIndex(displayMsg.payload.slideIndex);
    }
  }, [lastMessage, slideCache.setlist]);

  if (!slideCache.setlist || slideCache.setlist.songs.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Setlist</h3>
        <p className="text-sm text-slate-500">No songs in setlist</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4 px-4 pt-4">
        Setlist ({slideCache.setlist.songs.length} songs)
      </h3>
      
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {slideCache.setlist.songs.map((song, songIndex) => {
          const isCurrentSong = song.id === currentSongId;
          
          return (
            <div
              key={song.id}
              className={cn(
                'rounded-lg border p-3 transition-all',
                isCurrentSong
                  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : 'border-white/10 bg-white/5'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCurrentSong ? 'text-indigo-300' : 'text-slate-300'
                    )}
                  >
                    {songIndex + 1}. {song.title}
                  </p>
                  {song.artist && (
                    <p className="text-xs text-slate-500 mt-0.5">{song.artist}</p>
                  )}
                </div>
                {isCurrentSong && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium">
                    Current
                  </span>
                )}
              </div>

              {/* Show slide indicators for current song */}
              {isCurrentSong && song.lines.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap gap-1">
                    {song.lines.map((_, lineIndex) => (
                      <div
                        key={lineIndex}
                        className={cn(
                          'w-2 h-2 rounded-full transition-all',
                          lineIndex === currentSlideIndex
                            ? 'bg-indigo-400'
                            : lineIndex < currentSlideIndex
                            ? 'bg-indigo-500/30'
                            : 'bg-slate-600/30'
                        )}
                        title={`Slide ${lineIndex + 1}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Slide {currentSlideIndex + 1} of {song.lines.length}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
