'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { isTranscriptUpdateMessage, isDisplayUpdateMessage, type TranscriptUpdateMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

/**
 * Ghost Text Component
 * 
 * Displays real-time transcription ("ghost text") on the operator screen.
 * Shows what the AI thinks it hears before committing to a slide change.
 * This builds trust by letting operators see the AI is working correctly.
 */
export function GhostText() {
  const { lastMessage } = useWebSocket(false);
  const [transcript, setTranscript] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const bufferRef = useRef<string>('');

  useEffect(() => {
    if (!lastMessage) return;

    // Clear buffer when slide changes
    if (isDisplayUpdateMessage(lastMessage)) {
      bufferRef.current = '';
      setTranscript('');
      return;
    }

    if (isTranscriptUpdateMessage(lastMessage)) {
      const update = lastMessage as TranscriptUpdateMessage;
      
      // Build rolling buffer of transcriptions
      if (update.payload.text) {
        if (update.payload.isFinal) {
          // Final transcript replaces buffer
          bufferRef.current = update.payload.text;
        } else {
          // Partial transcript appends to buffer
          bufferRef.current = update.payload.text;
        }
        setTranscript(bufferRef.current);
      }

      // Update confidence if available
      if (update.payload.confidence !== undefined) {
        setConfidence(update.payload.confidence);
      }

      // Highlight when final transcript or high confidence
      if (update.payload.isFinal || (update.payload.confidence && update.payload.confidence > 0.8)) {
        setIsHighlighted(true);
        // Remove highlight after animation
        setTimeout(() => setIsHighlighted(false), 500);
      }
    }
  }, [lastMessage]);

  // Don't render if no transcript
  if (!transcript) {
    return null;
  }

  const getConfidenceColor = () => {
    if (confidence === null) return 'text-slate-400';
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Ghost Text
        </h3>
        {confidence !== null && (
          <span className={cn('text-xs font-mono', getConfidenceColor())}>
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      
      <div
        className={cn(
          'text-sm text-slate-300 font-light leading-relaxed transition-all duration-300',
          isHighlighted && 'text-green-300 font-normal'
        )}
      >
        {transcript}
      </div>
      
      <div className="mt-2 text-xs text-slate-500">
        <span className="italic">What the AI hears...</span>
      </div>
    </div>
  );
}

