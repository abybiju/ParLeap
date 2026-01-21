'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { isDisplayUpdateMessage, isSessionStartedMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

interface ProjectorDisplayProps {
  eventId: string;
}

/**
 * Projector Display Component
 * 
 * Clean, full-screen display for projector/second screen
 * Shows only lyrics with smooth transitions
 */
export function ProjectorDisplay({ eventId }: ProjectorDisplayProps) {
  const { state, isConnected, startSession, lastMessage, connect } = useWebSocket(false); // Don't auto-connect - match OperatorHUD pattern
  const [currentSlide, setCurrentSlide] = useState<DisplayUpdateMessage | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auto-connect on mount (but don't auto-start session)
  useEffect(() => {
    if (state === 'disconnected') {
      console.log('[ProjectorDisplay] Auto-connecting WebSocket...');
      connect();
    }
  }, [state, connect]);

  // Auto-start session when connected (same pattern as OperatorHUD)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isConnected && !sessionStarted) {
      // Wait a bit for connection to stabilize
      timer = setTimeout(() => {
        if (isConnected) {
          console.log('[ProjectorDisplay] Connection stable, starting session for event:', eventId);
          startSession(eventId);
          setSessionStarted(true);
        }
      }, 1000);
    }
    
    // Reset session started flag when disconnected
    if (state === 'disconnected') {
      setSessionStarted(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isConnected, eventId, startSession, sessionStarted, state]);

  // Handle display updates
  useEffect(() => {
    if (!lastMessage) return;

    if (isSessionStartedMessage(lastMessage)) {
      // Initial display update will come after session starts
      return;
    }

    if (isDisplayUpdateMessage(lastMessage)) {
      const displayMsg = lastMessage as DisplayUpdateMessage;
      
      // Smooth transition animation
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide(displayMsg);
        setIsTransitioning(false);
      }, 250); // Half of transition duration for smooth fade
    }
  }, [lastMessage]);

  // Show connection status if not connected
  if (!isConnected || state !== 'connected') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xl text-slate-400">Connecting...</p>
          <p className="text-sm text-slate-600 mt-2">{state}</p>
        </div>
      </div>
    );
  }

  // Show waiting state if no slide yet
  if (!currentSlide) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="text-center">
          <p className="text-2xl text-slate-400">Waiting for session to start...</p>
        </div>
      </div>
    );
  }

  const { lineText, songTitle, slideIndex } = currentSlide.payload;

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden p-8">
      {/* Song Title (Top) */}
      {songTitle && (
        <div className="mb-8 text-center">
          <h2 className="text-2xl md:text-3xl font-light text-slate-400">{songTitle}</h2>
        </div>
      )}

      {/* Main Lyrics Display */}
      <div className="flex-1 flex items-center justify-center w-full max-w-6xl">
        <p
          className={cn(
            'text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-light leading-relaxed text-center text-white',
            'transition-all duration-500',
            isTransitioning && 'opacity-0 scale-95',
            !isTransitioning && 'opacity-100 scale-100'
          )}
        >
          {lineText}
        </p>
      </div>

      {/* Slide Number (Bottom, Subtle) */}
      <div className="mt-8 text-center">
        <p className="text-xs text-slate-700">{slideIndex + 1}</p>
      </div>
    </div>
  );
}
