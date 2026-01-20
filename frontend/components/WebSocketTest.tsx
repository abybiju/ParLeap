'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import type { ServerMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';
import { GhostText } from './operator/GhostText';
import { MatchStatus } from './operator/MatchStatus';
import { ConnectionStatus } from './operator/ConnectionStatus';
import { MicrophoneStatus } from './operator/MicrophoneStatus';
import { AudioLevelMeter } from './operator/AudioLevelMeter';
import { isSessionStartedMessage, isSessionEndedMessage } from '@/lib/websocket/types';

/**
 * WebSocket Protocol Test Component
 * 
 * Tests the full WebSocket protocol with typed messages
 */
export function WebSocketTest() {
  const {
    state,
    isConnected,
    startSession,
    stopSession,
    nextSlide,
    prevSlide,
    ping,
    connect,
    disconnect,
    lastMessage,
  } = useWebSocket(false);

  const [eventId, setEventId] = useState('4177e6e1-59d1-4378-8e42-25e4b1ee57c8'); // Real Event ID from seed script
  const [messageHistory, setMessageHistory] = useState<Array<{ message: ServerMessage; timestamp: Date }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const sttProvider = (process.env.NEXT_PUBLIC_STT_PROVIDER || 'mock').toLowerCase();
  // Audio capture
  const audioCapture = useAudioCapture({ usePcm: sttProvider === 'elevenlabs' });

  // Track message history
  useEffect(() => {
    if (lastMessage) {
      setMessageHistory((prev) => [
        { message: lastMessage, timestamp: new Date() },
        ...prev.slice(0, 9), // Keep last 10 messages
      ]);
    }
  }, [lastMessage]);

  // Clear history on disconnect
  useEffect(() => {
    if (state === 'disconnected') {
      setMessageHistory([]);
    }
  }, [state]);

  // Auto-start audio capture when session starts
  useEffect(() => {
    if (lastMessage && isSessionStartedMessage(lastMessage)) {
      // Session started - start audio capture if not already recording
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
      // Session ended - stop audio capture
      if (audioCapture.state.isRecording) {
        audioCapture.stop();
      }
    }
  }, [lastMessage, audioCapture]);

  const getStateColor = () => {
    switch (state) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStateBadge = () => {
    switch (state) {
      case 'connected':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'connecting':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getMessageBadge = (type: string) => {
    switch (type) {
      case 'SESSION_STARTED':
        return 'bg-green-500/20 text-green-400';
      case 'DISPLAY_UPDATE':
        return 'bg-blue-500/20 text-blue-400';
      case 'TRANSCRIPT_UPDATE':
        return 'bg-purple-500/20 text-purple-400';
      case 'SESSION_ENDED':
        return 'bg-orange-500/20 text-orange-400';
      case 'ERROR':
        return 'bg-red-500/20 text-red-400';
      case 'PONG':
        return 'bg-slate-500/20 text-slate-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-500/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">WebSocket Protocol Test</h2>
              <p className="text-xs text-slate-400 mt-1">
                STT Provider: <span className="text-slate-200">{sttProvider}</span>
                {sttProvider === 'elevenlabs' && (
                  <span className="ml-2 text-slate-500">(PCM mode)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ConnectionStatus />
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border',
                  getStateBadge()
                )}
              >
                {state.toUpperCase()}
              </span>
            </div>
          </div>

      <div className="space-y-4">
        {/* Connection Status */}
        <div>
          <p className="text-sm text-slate-300 mb-2">Status:</p>
          <p className={cn('text-sm font-mono', getStateColor())}>
            {isConnected ? '✅ Connected' : `⏳ ${state}`}
          </p>
        </div>

        {/* Connection Controls */}
        <div className="flex gap-2 flex-wrap">
          {!isConnected ? (
            <button
              onClick={connect}
              disabled={state === 'connecting'}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition"
            >
              {state === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Protocol Actions */}
        {isConnected && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Protocol Actions:</p>
            
            {/* Event ID Input */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Event ID:</label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="Enter Event ID"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-xs text-slate-500">
                Real Event ID: <code className="text-slate-400">4177e6e1-59d1-4378-8e42-25e4b1ee57c8</code>
              </p>
            </div>
            
            {/* Session Controls */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => startSession(eventId)}
                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition"
              >
                START_SESSION
              </button>
              <button
                onClick={stopSession}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition"
              >
                STOP_SESSION
              </button>
              <button
                onClick={ping}
                className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-medium transition"
              >
                PING
              </button>
            </div>

            {/* Slide Controls */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setIsProcessing(true);
                    prevSlide();
                    setTimeout(() => setIsProcessing(false), 300);
                  }
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition"
              >
                ← PREV_SLIDE
              </button>
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setIsProcessing(true);
                    nextSlide();
                    setTimeout(() => setIsProcessing(false), 300);
                  }
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition"
              >
                NEXT_SLIDE →
              </button>
            </div>
          </div>
        )}

        {/* Message History */}
        {messageHistory.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-300">Message History ({messageHistory.length}):</p>
              <button
                onClick={() => setMessageHistory([])}
                className="text-xs text-slate-400 hover:text-slate-300 transition"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {messageHistory.map((item, index) => (
                <div key={index} className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-mono', getMessageBadge(item.message.type))}>
                      {item.message.type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(item.message, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audio Capture Section */}
        {isConnected && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Audio Capture</h3>
            </div>
            
            {/* Microphone Status */}
            <MicrophoneStatus
              state={audioCapture.state}
              requestPermission={audioCapture.requestPermission}
            />
            
            {/* Audio Level Meter */}
            <AudioLevelMeter state={audioCapture.state} />
            
            {/* Audio Controls */}
            {audioCapture.state.permissionState === 'granted' && (
              <div className="flex gap-2 flex-wrap">
                {!audioCapture.state.isRecording ? (
                  <button
                    onClick={() => audioCapture.start()}
                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition"
                  >
                    Start Recording
                  </button>
                ) : (
                  <>
                    {audioCapture.state.isPaused ? (
                      <button
                        onClick={() => audioCapture.resume()}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
                      >
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={() => audioCapture.pause()}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition"
                      >
                        Pause
                      </button>
                    )}
                    <button
                      onClick={() => audioCapture.stop()}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Ghost Text */}
        {isConnected && (
          <div className="mt-4 space-y-3">
            <GhostText />
            <MatchStatus />
          </div>
        )}

        {/* Info */}
        <div className="pt-2 border-t border-white/10">
          <p className="text-xs text-slate-400">
            WebSocket URL: {process.env.NEXT_PUBLIC_WS_URL || 'Not configured'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Protocol: START_SESSION → DISPLAY_UPDATE → MANUAL_OVERRIDE → STOP_SESSION
          </p>
        </div>
      </div>
    </div>
  );
}
