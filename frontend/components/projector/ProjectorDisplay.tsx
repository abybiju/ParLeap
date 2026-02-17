'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { isDisplayUpdateMessage, isSessionStartedMessage, isEventSettingsUpdatedMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';
import { getProjectorFontClass, getProjectorFontIdOrDefault } from '@/lib/projectorFonts';
import { cn } from '@/lib/utils';

interface ProjectorDisplayProps {
  eventId: string;
}

/**
 * Projector Display Component
 * 
 * Clean, full-screen display for projector/second screen
 * Shows only lyrics with smooth transitions
 * Supports keyboard shortcuts and full-screen mode
 */
export function ProjectorDisplay({ eventId }: ProjectorDisplayProps) {
  const { state, isConnected, startSession, nextSlide, prevSlide, lastMessage, connect } = useWebSocket(false);
  const [currentSlide, setCurrentSlide] = useState<DisplayUpdateMessage | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [projectorFontId, setProjectorFontId] = useState<string>('inter');

  // Auto-connect on mount (but don't auto-start session)
  useEffect(() => {
    if (state === 'disconnected') {
      console.log('[ProjectorDisplay] Auto-connecting WebSocket...');
      connect();
    }
  }, [state, connect]);

  // Auto-start session when connected (same pattern as OperatorHUD)
  // Note: The projector view needs to start its own session to receive broadcasts
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
      setCurrentSlide(null); // Clear slide when disconnected
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isConnected, eventId, startSession, sessionStarted, state]);

  // Handle display updates with smooth transitions
  useEffect(() => {
    if (!lastMessage) return;

    if (isSessionStartedMessage(lastMessage)) {
      // Session started - wait for initial display update
      // The backend will send an initial DISPLAY_UPDATE after SESSION_STARTED
      console.log('[ProjectorDisplay] Session started, waiting for initial display update');
      setProjectorFontId(getProjectorFontIdOrDefault(lastMessage.payload.projectorFont));
      return;
    }

    if (isEventSettingsUpdatedMessage(lastMessage)) {
      setProjectorFontId(getProjectorFontIdOrDefault(lastMessage.payload.projectorFont));
      return;
    }

    if (isDisplayUpdateMessage(lastMessage)) {
      const displayMsg = lastMessage as DisplayUpdateMessage;
      console.log('[ProjectorDisplay] Received DISPLAY_UPDATE:', displayMsg.payload);
      
      // If this is the first slide (no currentSlide), show it immediately without transition
      if (!currentSlide) {
        setCurrentSlide(displayMsg);
        setIsTransitioning(false);
        return;
      }
      
      // Update slide immediately for low latency; CSS handles fade
      setIsTransitioning(true);
      setCurrentSlide(displayMsg);
      const t = setTimeout(() => setIsTransitioning(false), 50);
      return () => clearTimeout(t);
    }
    return;
  }, [lastMessage, currentSlide]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when connected and not typing
      if (!isConnected || state !== 'connected') return;
      
      // Space or ArrowRight: Next slide
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      }
      // Backspace or ArrowLeft: Previous slide
      else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
      // F11 or Escape: Toggle fullscreen (handled by browser, but we track it)
      else if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isConnected, state, nextSlide, prevSlide]);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Request fullscreen on mount (optional - can be removed if not desired)
  useEffect(() => {
    // Only request fullscreen if user hasn't interacted yet (optional)
    // Commented out by default - uncomment if you want auto-fullscreen
    // const requestFullscreen = async () => {
    //   try {
    //     await document.documentElement.requestFullscreen();
    //   } catch (err) {
    //     // User denied or browser doesn't support
    //   }
    // };
    // requestFullscreen();
  }, []);

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
          {sessionStarted && (
            <p className="text-sm text-slate-500 mt-2">Session started, waiting for display update...</p>
          )}
          {!sessionStarted && (
            <p className="text-sm text-slate-500 mt-2">Starting session...</p>
          )}
        </div>
      </div>
    );
  }

  const { lineText, slideText, slideLines, songTitle, slideIndex, slideImageUrl, slideVideoUrl } = currentSlide.payload;

  const displayLines = slideLines ?? (slideText ? slideText.split('\n') : [lineText]);
  const hasStructuredText = displayLines.length > 0;

  // Announcement: image or video with optional structured text overlay (exact wording on top)
  if (slideImageUrl && hasStructuredText) {
    return (
      <div className="h-screen w-screen relative flex items-center justify-center bg-black overflow-hidden">
        <img
          src={slideImageUrl}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover opacity-40 transition-opacity duration-150',
            isTransitioning ? 'opacity-0' : 'opacity-40'
          )}
        />
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-6xl px-8 text-center text-white">
          {songTitle && (
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-slate-300 mb-6">
              {songTitle}
            </h2>
          )}
          <div className={cn('flex flex-col items-center justify-center space-y-4 md:space-y-6', getProjectorFontClass(projectorFontId))}>
            {displayLines.map((line, index) => (
              <p
                key={index}
                className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-light leading-relaxed text-white"
                style={{ textShadow: '0 2px 20px rgba(0, 0, 0, 0.5)' }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (slideVideoUrl && hasStructuredText) {
    return (
      <div className="h-screen w-screen relative flex items-center justify-center bg-black overflow-hidden">
        <video
          src={slideVideoUrl}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-6xl px-8 text-center text-white">
          {songTitle && (
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-slate-300 mb-6">
              {songTitle}
            </h2>
          )}
          <div className={cn('flex flex-col items-center justify-center space-y-4 md:space-y-6', getProjectorFontClass(projectorFontId))}>
            {displayLines.map((line, index) => (
              <p
                key={index}
                className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-light leading-relaxed text-white"
                style={{ textShadow: '0 2px 20px rgba(0, 0, 0, 0.5)' }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Announcement: image or video only (no structured text)
  if (slideImageUrl) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black overflow-hidden">
        <img
          src={slideImageUrl}
          alt={songTitle ?? 'Announcement'}
          className={cn(
            'max-h-full max-w-full object-contain transition-opacity duration-150',
            isTransitioning ? 'opacity-0' : 'opacity-100'
          )}
        />
      </div>
    );
  }
  if (slideVideoUrl) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black overflow-hidden">
        <video
          src={slideVideoUrl}
          className={cn(
            'max-h-full max-w-full object-contain transition-opacity duration-150',
            isTransitioning ? 'opacity-0' : 'opacity-100'
          )}
          autoPlay
          muted
          loop
          playsInline
        />
      </div>
    );
  }
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ProjectorDisplay] Slide ${slideIndex}: ${displayLines.length} lines`, {
      slideLines: slideLines?.length,
      slideText: slideText?.substring(0, 50),
      displayLines: displayLines.length,
    });
  }

  const projectorFontClass = getProjectorFontClass(projectorFontId);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden p-8">
      {/* Song Title (Top) - with fade animation */}
      {songTitle && (
        <div 
          className={cn(
            'mb-8 text-center transition-all duration-200',
            isTransitioning ? 'opacity-0 translate-y-[-10px]' : 'opacity-100 translate-y-0'
          )}
        >
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-slate-400">{songTitle}</h2>
        </div>
      )}

      {/* Main Lyrics Display - Multi-line with enhanced animations */}
      <div className="flex-1 flex items-center justify-center w-full max-w-6xl">
        <div
          className={cn(
            'w-full transition-all duration-200 ease-in-out',
            isTransitioning 
              ? 'opacity-0 scale-95 translate-y-4 blur-sm' 
              : 'opacity-100 scale-100 translate-y-0 blur-0'
          )}
        >
          <div className={cn('flex flex-col items-center justify-center space-y-4 md:space-y-6', projectorFontClass)}>
            {displayLines.map((line, index) => (
              <p
                key={index}
                className={cn(
                  'text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-light leading-relaxed text-center text-white',
                  'transition-all duration-150'
                )}
                style={{
                  textShadow: '0 2px 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)',
                }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Slide Number (Bottom, Subtle) - hidden in fullscreen */}
      {!isFullscreen && (
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-700">{slideIndex + 1}</p>
        </div>
      )}

      {/* Keyboard hint (only visible briefly on first load or when not fullscreen) */}
      {!isFullscreen && (
        <div className="absolute bottom-4 right-4 text-xs text-slate-600 opacity-50">
          Space/→ Next • Backspace/← Prev • F11 Fullscreen
        </div>
      )}
    </div>
  );
}
