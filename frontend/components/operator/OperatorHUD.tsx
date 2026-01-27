'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { isSessionStartedMessage, isSessionEndedMessage } from '@/lib/websocket/types';
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
}

/**
 * Operator HUD Component
 * 
 * Professional operator interface with three-panel layout:
 * - Left: Ghost Text + Confidence Monitor
 * - Center: Current Slide + Next Preview
 * - Right: Setlist
 */
export function OperatorHUD({ eventId, eventName }: OperatorHUDProps) {
  const router = useRouter();
  const {
    state,
    isConnected,
    startSession,
    stopSession,
    nextSlide,
    prevSlide,
    lastMessage,
    connect,
  } = useWebSocket(false); // Don't auto-connect - match test page pattern

  const sttProvider = (process.env.NEXT_PUBLIC_STT_PROVIDER || 'mock').toLowerCase();
  const audioCapture = useAudioCapture({ usePcm: sttProvider === 'elevenlabs' });
  const [sessionStarted, setSessionStarted] = useState(false);

  // Auto-connect on mount (but don't auto-start session)
  useEffect(() => {
    if (state === 'disconnected') {
      console.log('[OperatorHUD] Auto-connecting WebSocket...');
      connect();
    }
  }, [state, connect]);

  // Auto-start session when connected (same pattern as test page)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isConnected && !sessionStarted) {
      // Wait a bit for connection to stabilize (like test page does)
      timer = setTimeout(() => {
        if (isConnected) {
          console.log('[OperatorHUD] Connection stable, starting session for event:', eventId);
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

  // Auto-start audio capture when session starts
  useEffect(() => {
    if (lastMessage) {
      console.log('[OperatorHUD] Received message:', lastMessage.type, lastMessage);
    }
    if (lastMessage && isSessionStartedMessage(lastMessage)) {
      console.log('[OperatorHUD] Session started! Setlist:', lastMessage.payload.setlist);
      if (!audioCapture.state.isRecording && audioCapture.state.permissionState === 'granted') {
        audioCapture.start().catch((error) => {
          console.error('Failed to start audio capture:', error);
        });
      }
    }
  }, [lastMessage, audioCapture]);

  // Auto-stop audio capture when session ends
  useEffect(() => {
    if (lastMessage && isSessionEndedMessage(lastMessage)) {
      if (audioCapture.state.isRecording) {
        audioCapture.stop();
      }
    }
  }, [lastMessage, audioCapture]);

  const handleStopSession = () => {
    if (audioCapture.state.isRecording) {
      audioCapture.stop();
    }
    stopSession();
    router.push('/dashboard');
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{eventName}</h1>
          <ConnectionStatus />
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border',
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
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
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
          <SetlistPanel />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="border-t border-white/10 bg-white/5 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevSlide}
            disabled={state !== 'connected'}
            className="px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-medium transition min-w-[120px]"
          >
            ◀ PREV
          </button>
          {audioCapture.state.isRecording && !audioCapture.state.isPaused ? (
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
              START
            </button>
          )}
          <button
            onClick={nextSlide}
            disabled={state !== 'connected'}
            className="px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-medium transition min-w-[120px]"
          >
            NEXT ▶
          </button>
        </div>
      </div>
    </div>
  );
}
