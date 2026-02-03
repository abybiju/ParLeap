'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ZapOff } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { isSessionStartedMessage, isSessionEndedMessage, isSongSuggestionMessage, isErrorMessage } from '@/lib/websocket/types';
import { GhostText } from './GhostText';
import { MatchStatus } from './MatchStatus';
import { ConnectionStatus } from './ConnectionStatus';
import { CurrentSlideDisplay } from './CurrentSlideDisplay';
import { NextSlidePreview } from './NextSlidePreview';
import { SetlistPanel } from './SetlistPanel';
import { AudioLevelMeter } from './AudioLevelMeter';
import { MicrophoneStatus } from './MicrophoneStatus';
import { STTStatus } from './STTStatus';
import { cn } from '@/lib/utils';

interface OperatorHUDProps {
  eventId: string;
  eventName: string;
  initialSetlist?: Array<{
    id: string;
    title: string;
    artist: string | null;
    sequenceOrder: number;
  }>;
}

/**
 * Operator HUD Component
 * 
 * Professional operator interface with three-panel layout:
 * - Left: Ghost Text + Confidence Monitor
 * - Center: Current Slide + Next Preview
 * - Right: Setlist
 */
export function OperatorHUD({ eventId, eventName, initialSetlist = [] }: OperatorHUDProps) {
  const router = useRouter();
  const {
    state,
    isConnected,
    startSession,
    stopSession,
    nextSlide,
    prevSlide,
    goToSlide,
    lastMessage,
    connect,
  } = useWebSocket(false); // Don't auto-connect - manual start only

  const sttProvider = (process.env.NEXT_PUBLIC_STT_PROVIDER || 'mock').toLowerCase();
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [isAutoFollowing, setIsAutoFollowing] = useState(true); // PHASE 2: Auto-follow toggle

  // Gate audio capture based on session status
  const audioCapture = useAudioCapture({
    usePcm: sttProvider === 'elevenlabs',
    sessionActive: sessionStatus === 'active',
  });

  // Environment variable validation and debug logging
  useEffect(() => {
    if (sttProvider === 'elevenlabs') {
      console.log('[OperatorHUD] ✅ ElevenLabs STT enabled - PCM mode active');
      console.log('[OperatorHUD] ✅ Audio will be sent as PCM 16-bit (pcm_s16le) format');
    } else {
      console.warn('[OperatorHUD] ⚠️  NEXT_PUBLIC_STT_PROVIDER is not "elevenlabs" - using WebM format');
      console.warn('[OperatorHUD] ⚠️  Set NEXT_PUBLIC_STT_PROVIDER=elevenlabs in frontend environment for PCM audio');
    }
  }, [sttProvider]);

  // Pre-initialize audio: Request microphone permission before session starts
  useEffect(() => {
    // Request permission early so audio can start immediately when session starts
    if (audioCapture.state.permissionState === 'prompt') {
      audioCapture.requestPermission().catch((error) => {
        console.warn('[OperatorHUD] Failed to pre-initialize microphone permission:', error);
      });
    }
  }, [audioCapture]);

  // Handle SESSION_STARTED message
  useEffect(() => {
    if (lastMessage && isSessionStartedMessage(lastMessage)) {
      console.log('[OperatorHUD] Session started! Setlist:', lastMessage.payload.setlist);
      setSessionStatus('active');
      // Auto-start audio capture immediately when session starts (permission should already be granted)
      if (!audioCapture.state.isRecording) {
        if (audioCapture.state.permissionState === 'granted') {
          // Start immediately - no delays
          audioCapture.start().catch((error) => {
            console.error('[OperatorHUD] Failed to start audio capture:', error);
            toast.error('Audio Capture Failed', {
              description: 'Failed to start microphone. Please check permissions.',
            });
          });
        } else {
          // Request permission and start
          audioCapture.requestPermission().then((granted) => {
            if (granted) {
              audioCapture.start().catch((error) => {
                console.error('[OperatorHUD] Failed to start audio capture after permission:', error);
              });
            } else {
              toast.error('Microphone Permission Required', {
                description: 'Please allow microphone access to enable transcription.',
              });
            }
          });
        }
      }
    }
  }, [lastMessage, audioCapture]);

  // Handle error messages - suppress NO_SESSION, show others
  useEffect(() => {
    if (lastMessage && isErrorMessage(lastMessage)) {
      const error = lastMessage.payload;
      
      // Treat NO_SESSION as idle state (no toast spam)
      if (error.code === 'NO_SESSION') {
        if (sessionStatus === 'active') {
          setSessionStatus('idle');
        }
        // Don't toast or log - this is expected when idle
        return;
      }
      
      // Only log error once per unique error code to prevent spam
      const errorKey = `${error.code}-${error.message}`;
      const lastErrorKey = sessionStorage.getItem('lastErrorKey');
      
      if (lastErrorKey !== errorKey) {
        console.error('[OperatorHUD] WebSocket error:', error.code, error.message, error.details);
        sessionStorage.setItem('lastErrorKey', errorKey);
        
        // Clear after 5 seconds to allow same error to show again if it persists
        setTimeout(() => {
          sessionStorage.removeItem('lastErrorKey');
        }, 5000);
        
        // Show user-friendly error toast
        if (error.code === 'EMPTY_SETLIST') {
          toast.error('Empty Setlist', {
            description: error.message || 'Please add songs to the event before starting a session.',
            duration: 10000,
          });
          setSessionStatus('error');
        } else if (error.code === 'EVENT_NOT_FOUND') {
          // This usually indicates a Supabase environment mismatch
          toast.error('Event Not Found', {
            description: error.message || 'The event could not be found. This may indicate a Supabase configuration mismatch between frontend and backend. Check that both are using the same Supabase project.',
            duration: 15000,
          });
          setSessionStatus('error');
          console.error('[OperatorHUD] EVENT_NOT_FOUND - This usually means backend Supabase project differs from frontend. Check backend environment variables.');
        } else if (error.code === 'STT_ERROR' || error.code === 'AUDIO_FORMAT_UNSUPPORTED') {
          // STT errors are handled by STTStatus component, just log here
          console.warn('[OperatorHUD] STT error:', error.message);
        } else {
          toast.error(`Error: ${error.code}`, {
            description: error.message || 'An error occurred. Check console for details.',
            duration: 8000,
          });
          setSessionStatus('error');
        }
      }
    }
  }, [lastMessage, sessionStatus]);

  // Auto-stop audio capture when session ends
  useEffect(() => {
    if (lastMessage && isSessionEndedMessage(lastMessage)) {
      if (audioCapture.state.isRecording) {
        audioCapture.stop();
      }
      setSessionStatus('idle');
    }
  }, [lastMessage, audioCapture]);

  // Manual session start handler
  const handleStartSession = () => {
    if (sessionStatus === 'active') {
      return; // Already active
    }

    if (state === 'disconnected') {
      console.log('[OperatorHUD] Connecting WebSocket...');
      connect();
      // Wait for connection before starting session
      const checkConnection = setInterval(() => {
        if (isConnected) {
          clearInterval(checkConnection);
          console.log('[OperatorHUD] WebSocket connected, starting session for event:', eventId);
          setSessionStatus('starting');
          startSession(eventId);
        }
      }, 100);
      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkConnection), 5000);
    } else if (isConnected) {
      console.log('[OperatorHUD] Starting session for event:', eventId);
      setSessionStatus('starting');
      startSession(eventId);
    }
  };

  // PHASE 2: Handle song suggestions (medium confidence 60-85%)
  useEffect(() => {
    if (lastMessage && isSongSuggestionMessage(lastMessage)) {
      const { suggestedSongTitle, confidence, matchedLine } = lastMessage.payload;
      toast.info(
        `Detected "${suggestedSongTitle}"?`,
        {
          description: `${(confidence * 100).toFixed(0)}% match: "${matchedLine.slice(0, 50)}..."`,
          action: {
            label: 'Switch Now',
            onClick: () => {
              // User manually confirmed, jump to suggested song
              goToSlide(0, lastMessage.payload.suggestedSongId);
            },
          },
          duration: 5000,
        }
      );
    }
  }, [lastMessage, goToSlide]);

  // PHASE 2: Toggle auto-follow mode
  const toggleAutoFollow = () => {
    setIsAutoFollowing(!isAutoFollowing);
    if (!isAutoFollowing) {
      toast.success('AI Auto-Follow enabled');
    } else {
      toast.warning('AI Auto-Follow disabled');
    }
    // Note: Backend tracks this automatically when manual overrides are sent
  };

  const handleStopSession = () => {
    if (audioCapture.state.isRecording) {
      audioCapture.stop();
    }
    stopSession();
    router.push('/dashboard');
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Header Bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur min-h-[4rem]">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{eventName}</h1>
          <ConnectionStatus />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* PHASE 2: Auto-Follow Toggle */}
          <button
            onClick={toggleAutoFollow}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
              'hover:scale-105 active:scale-95',
              isAutoFollowing
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                : 'bg-slate-500/20 text-slate-400 border-slate-500/50'
            )}
            title={isAutoFollowing ? 'AI Auto-Follow: ON' : 'AI Auto-Follow: OFF'}
          >
            {isAutoFollowing ? (
              <>
                <Zap className="inline h-3 w-3 mr-1" />
                AI Auto-Follow
              </>
            ) : (
              <>
                <ZapOff className="inline h-3 w-3 mr-1" />
                Manual Mode
              </>
            )}
          </button>
          
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap',
              state === 'connected'
                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                : state === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                : 'bg-slate-500/20 text-slate-400 border-slate-500/50'
            )}
          >
            {state.toUpperCase()}
          </span>
          <button
            onClick={handleStopSession}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition whitespace-nowrap flex-shrink-0"
          >
            Stop Session
          </button>
        </div>
      </header>

      {/* Three-Panel Layout */}
      <div className="flex-1 grid grid-cols-[300px_1fr_300px] gap-4 p-4 overflow-hidden">
        {/* Left Panel: Ghost Text + Confidence Monitor */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">
              Live Transcription
            </h2>
            <GhostText />
            <MatchStatus />
          </div>

          <div className="mt-4 space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">
              Audio Status
            </h2>
            <MicrophoneStatus
              state={audioCapture.state}
              requestPermission={audioCapture.requestPermission}
            />
            <AudioLevelMeter state={audioCapture.state} />
            <STTStatus />
          </div>
        </div>

        {/* Center Panel: Current Slide + Next Preview */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur p-6">
          <CurrentSlideDisplay />
          <NextSlidePreview />
        </div>

        {/* Right Panel: Setlist */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur">
          <SetlistPanel initialSetlist={initialSetlist} />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex-shrink-0 border-t border-white/10 bg-white/5 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevSlide}
            disabled={sessionStatus !== 'active'}
            className="px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-medium transition min-w-[120px]"
            title={sessionStatus !== 'active' ? 'Start session first' : 'Previous slide'}
          >
            ◀ PREV
          </button>
          {sessionStatus === 'active' ? (
            audioCapture.state.isRecording && !audioCapture.state.isPaused ? (
              <button
                onClick={() => audioCapture.pause()}
                className="px-8 py-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-lg font-medium transition min-w-[120px]"
              >
                PAUSE
              </button>
            ) : audioCapture.state.isRecording && audioCapture.state.isPaused ? (
              <button
                onClick={() => audioCapture.resume()}
                className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium transition min-w-[120px]"
              >
                RESUME
              </button>
            ) : (
              <button
                onClick={() => audioCapture.start()}
                disabled={audioCapture.state.permissionState !== 'granted'}
                className="px-8 py-4 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-medium transition min-w-[120px]"
              >
                START AUDIO
              </button>
            )
          ) : (
            <button
              onClick={handleStartSession}
              disabled={sessionStatus === 'starting'}
              className="px-8 py-4 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-medium transition min-w-[120px]"
            >
              {sessionStatus === 'starting' ? 'STARTING...' : 'START SESSION'}
            </button>
          )}
          <button
            onClick={nextSlide}
            disabled={sessionStatus !== 'active'}
            className="px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-medium transition min-w-[120px]"
            title={sessionStatus !== 'active' ? 'Start session first' : 'Next slide'}
          >
            NEXT ▶
          </button>
        </div>
      </div>
    </div>
  );
}
