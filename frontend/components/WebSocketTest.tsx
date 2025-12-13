'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import type { ServerMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

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

  const [eventId] = useState('00000000-0000-0000-0000-000000000001'); // Demo event ID
  const [messageHistory, setMessageHistory] = useState<Array<{ message: ServerMessage; timestamp: Date }>>([]);

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
        <h2 className="text-xl font-semibold text-white">WebSocket Protocol Test</h2>
        <span
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border',
            getStateBadge()
          )}
        >
          {state.toUpperCase()}
        </span>
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
                onClick={prevSlide}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition"
              >
                ← PREV_SLIDE
              </button>
              <button
                onClick={nextSlide}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition"
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
