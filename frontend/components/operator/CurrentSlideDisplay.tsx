'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { isDisplayUpdateMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

/**
 * Current Slide Display Component
 * 
 * Displays the current slide in large, readable text for the operator
 */
export function CurrentSlideDisplay() {
  const { lastMessage } = useWebSocket(false);
  const [currentSlide, setCurrentSlide] = useState<DisplayUpdateMessage | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    if (isDisplayUpdateMessage(lastMessage)) {
      setCurrentSlide(lastMessage as DisplayUpdateMessage);
    }
  }, [lastMessage]);

  if (!currentSlide) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="h-14 w-14 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 text-lg">
          ◇
        </div>
        <p className="text-slate-300 text-lg mt-4">Waiting for session to start</p>
        <p className="text-slate-500 text-sm mt-2">Start a session to arm the live display</p>
      </div>
    );
  }

  const { lineText, slideText, slideLines, songTitle, slideIndex } = currentSlide.payload;

  // Use slideLines if available, otherwise fall back to slideText or lineText
  const displayLines = slideLines ?? (slideText ? slideText.split('\n') : [lineText]);
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[CurrentSlideDisplay] Slide ${slideIndex}: ${displayLines.length} lines`, {
      slideLines: slideLines?.length,
      slideText: slideText?.substring(0, 50),
      displayLines: displayLines.length,
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Song Title */}
      <div className="mb-3 text-center">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
          {songTitle}
        </h2>
      </div>

      {/* Current Slide Text - Multi-line (Optimized for 4-line display) */}
      <div className="flex-1 flex items-center justify-center py-6 px-6">
        <div className="w-full">
          <div className="flex flex-col items-center justify-center space-y-2">
            {displayLines.map((line, index) => (
              <p
                key={index}
                className={cn(
                  'text-2xl md:text-4xl font-light leading-snug text-center text-white',
                  'tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
                  'transition-all duration-500'
                )}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Slide Indicator */}
      <div className="mt-2 text-center">
        <p className="text-xs text-slate-500">
          Slide {slideIndex + 1}
        </p>
      </div>
    </div>
  );
}
