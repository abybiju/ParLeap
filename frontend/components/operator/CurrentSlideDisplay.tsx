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
        <p className="text-slate-500 text-lg">Waiting for session to start...</p>
        <p className="text-slate-600 text-sm mt-2">Start a session to see the current slide</p>
      </div>
    );
  }

  const { lineText, songTitle, slideIndex } = currentSlide.payload;

  return (
    <div className="flex flex-col h-full">
      {/* Song Title */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-slate-300">{songTitle}</h2>
      </div>

      {/* Current Slide Text */}
      <div className="flex-1 flex items-center justify-center p-8">
        <p
          className={cn(
            'text-4xl md:text-5xl lg:text-6xl font-light leading-relaxed text-center text-white',
            'transition-all duration-500'
          )}
        >
          {lineText}
        </p>
      </div>

      {/* Slide Indicator */}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-500">
          Slide {slideIndex + 1}
        </p>
      </div>
    </div>
  );
}
