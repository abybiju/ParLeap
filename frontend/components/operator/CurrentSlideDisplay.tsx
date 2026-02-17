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
interface CurrentSlideDisplayProps {
  fontClassName?: string;
}

export function CurrentSlideDisplay({ fontClassName }: CurrentSlideDisplayProps) {
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

  const { lineText, slideText, slideLines, songTitle, slideIndex, slideImageUrl, slideVideoUrl } = currentSlide.payload;

  // Use slideLines if available, otherwise fall back to slideText or lineText
  const displayLines = slideLines ?? (slideText ? slideText.split('\n') : [lineText]);
  const hasStructuredText = displayLines.length > 0 && (displayLines.length > 1 || (displayLines[0] ?? '').trim() !== '');

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[CurrentSlideDisplay] Slide ${slideIndex}: ${displayLines.length} lines`, {
      slideLines: slideLines?.length,
      slideText: slideText?.substring(0, 50),
      displayLines: displayLines.length,
      slideImageUrl: slideImageUrl ? 'set' : undefined,
      slideVideoUrl: slideVideoUrl ? 'set' : undefined,
    });
  }

  // Announcement: image or video with optional structured text overlay
  if (slideImageUrl && hasStructuredText) {
    return (
      <div className="flex flex-col h-full relative rounded-lg overflow-hidden bg-black/40">
        <img
          src={slideImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="relative z-10 flex flex-col flex-1 min-h-0 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-2">{songTitle}</h2>
          <div className={cn('flex-1 flex flex-col justify-center space-y-1', fontClassName)}>
            {displayLines.map((line, index) => (
              <p key={index} className="text-lg md:text-xl font-light text-center text-white drop-shadow-md">
                {line}
              </p>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Slide {slideIndex + 1}</p>
        </div>
      </div>
    );
  }
  if (slideVideoUrl && hasStructuredText) {
    return (
      <div className="flex flex-col h-full relative rounded-lg overflow-hidden bg-black/40">
        <video
          src={slideVideoUrl}
          className="absolute inset-0 w-full h-full object-cover opacity-50"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="relative z-10 flex flex-col flex-1 min-h-0 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-2">{songTitle}</h2>
          <div className={cn('flex-1 flex flex-col justify-center space-y-1', fontClassName)}>
            {displayLines.map((line, index) => (
              <p key={index} className="text-lg md:text-xl font-light text-center text-white drop-shadow-md">
                {line}
              </p>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Slide {slideIndex + 1}</p>
        </div>
      </div>
    );
  }

  // Announcement: image or video only (no overlay text)
  if (slideImageUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-2 text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">{songTitle}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0 rounded-lg overflow-hidden bg-black/30">
          <img
            src={slideImageUrl}
            alt={songTitle ?? 'Announcement'}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <p className="text-xs text-slate-500 text-center mt-2">Slide {slideIndex + 1}</p>
      </div>
    );
  }
  if (slideVideoUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-2 text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">{songTitle}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0 rounded-lg overflow-hidden bg-black/30">
          <video
            src={slideVideoUrl}
            className="max-h-full max-w-full object-contain"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
        <p className="text-xs text-slate-500 text-center mt-2">Slide {slideIndex + 1}</p>
      </div>
    );
  }

  // Default: lyrics/text slide
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
          <div className={cn('flex flex-col items-center justify-center space-y-2', fontClassName)}>
            {displayLines.map((line, index) => (
              <p
                key={index}
                className={cn(
                  'text-2xl md:text-4xl font-light leading-snug text-center text-white',
                  'tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
                  'transition-all duration-200'
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
