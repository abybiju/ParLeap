'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { isTranscriptUpdateMessage, isErrorMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

/**
 * STT Status Component
 * 
 * Shows the current STT provider and transcription status
 * Helps diagnose why voice matching might not be working
 */
interface STTStatusProps {
  audioActive?: boolean;
  smartListenEnabled?: boolean;
  smartListenWindowOpen?: boolean;
}

export function STTStatus({
  audioActive = false,
  smartListenEnabled = false,
  smartListenWindowOpen = false,
}: STTStatusProps) {
  const { lastMessage } = useWebSocket(false);
  const [hasReceivedTranscript, setHasReceivedTranscript] = useState(false);
  const [lastTranscriptTime, setLastTranscriptTime] = useState<number | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const sttProvider = (process.env.NEXT_PUBLIC_STT_PROVIDER || 'mock').toLowerCase();

  useEffect(() => {
    if (lastMessage && isTranscriptUpdateMessage(lastMessage)) {
      setHasReceivedTranscript(true);
      setLastTranscriptTime(Date.now());
      setSttError(null); // Clear error on successful transcript
    }
    
    // Check for STT-related errors
    if (lastMessage && isErrorMessage(lastMessage)) {
      const error = lastMessage.payload;
      if (error.code === 'STT_ERROR' || error.code === 'AUDIO_FORMAT_UNSUPPORTED') {
        setSttError(error.message);
      }
    }
  }, [lastMessage]);

  // Check if STT is working (received transcript in last 20 seconds)
  const isSttActive = lastTranscriptTime && (Date.now() - lastTranscriptTime) < 20000;

  const getStatusColor = () => {
    if (sttError) return 'text-red-400';
    if (sttProvider === 'mock') return 'text-orange-400';
    if (smartListenEnabled && !smartListenWindowOpen) return 'text-sky-300';
    if (smartListenEnabled && smartListenWindowOpen) return 'text-emerald-400';
    if (isSttActive) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getStatusText = () => {
    if (sttError) {
      return 'Error';
    }
    if (sttProvider === 'mock') {
      return 'Mock Mode (Not Transcribing)';
    }
    if (sttProvider === 'elevenlabs') {
      if (smartListenEnabled) {
        if (smartListenWindowOpen) {
          return isSttActive ? 'Active (Window open)' : 'Window open (Awaiting speech)';
        }
        return 'Standby (Smart Listen)';
      }
      if (isSttActive) {
        return 'Active (Receiving transcripts)';
      }
      if (audioActive) {
        return 'Listening (Awaiting speech)';
      }
      if (hasReceivedTranscript) {
        return 'Inactive (No recent transcripts)';
      }
      return 'Waiting for transcription...';
    }
    if (isSttActive) {
      return 'Active';
    }
    if (hasReceivedTranscript) {
      return 'Inactive (No recent transcripts)';
    }
    return audioActive ? 'Audio streaming (No transcripts)' : 'Waiting for transcription...';
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
            STT Status
          </h4>
          <p className={cn('text-xs font-mono', getStatusColor())}>
            {getStatusText()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Provider</p>
          <p className="text-xs font-mono text-slate-400 capitalize">{sttProvider}</p>
        </div>
      </div>
      {sttProvider === 'mock' && (
        <div className="mt-2 pt-2 border-t border-orange-500/20">
          <p className="text-xs text-orange-300">
            ⚠️ Configure NEXT_PUBLIC_STT_PROVIDER=elevenlabs for real transcription
          </p>
        </div>
      )}
      {sttError && (
        <div className="mt-2 pt-2 border-t border-red-500/20">
          <p className="text-xs text-red-300 font-medium mb-1">Error:</p>
          <p className="text-xs text-red-400">{sttError}</p>
          {sttError.includes('PCM') && (
            <p className="text-xs text-red-300 mt-1">
              💡 Fix: Set NEXT_PUBLIC_STT_PROVIDER=elevenlabs in frontend environment
            </p>
          )}
        </div>
      )}
      {sttProvider === 'elevenlabs' && !smartListenEnabled && !isSttActive && !hasReceivedTranscript && !sttError && (
        <div className="mt-2 pt-2 border-t border-yellow-500/20">
          <p className="text-xs text-yellow-300">
            ⚠️ Check: ELEVENLABS_API_KEY configured in backend? Audio format is PCM?
          </p>
        </div>
      )}
    </div>
  );
}
