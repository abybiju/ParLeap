'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { isTranscriptUpdateMessage, isDisplayUpdateMessage, type TranscriptUpdateMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

/**
 * Ghost Text Component - Phase 3.4 Enhanced
 * 
 * Displays real-time transcription ("ghost text") on the operator screen.
 * Shows what the AI thinks it hears before committing to a slide change.
 * Now includes matching confidence indicators to help operators understand
 * the AI's decision-making process.
 * 
 * Features:
 * - Real-time transcription display
 * - STT confidence score (0-100%)
 * - Matching status when auto-advancing
 * - Visual feedback with color coding
 * - Animation on match detection
 */
export function GhostText() {
  const { lastMessage } = useWebSocket(false);
  const [transcript, setTranscript] = useState<string>('');
  const [sttConfidence, setSttConfidence] = useState<number | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<number | null>(null);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [lastMatchedLine, setLastMatchedLine] = useState<string>('');
  const bufferRef = useRef<string>('');

  useEffect(() => {
    if (!lastMessage) return;

    // Handle display updates (auto-advance)
    if (isDisplayUpdateMessage(lastMessage)) {
      const displayMsg = lastMessage as DisplayUpdateMessage;
      
      if (displayMsg.payload.isAutoAdvance) {
        // Auto-advance detected - keep showing ghost text, just highlight
        setIsAutoAdvancing(true);
        setMatchConfidence(displayMsg.payload.matchConfidence ?? 0);
        setLastMatchedLine(displayMsg.payload.lineText);
        
        // Highlight animation
        setIsHighlighted(true);
        setTimeout(() => setIsHighlighted(false), 600);

        // Reset auto-advance indicator after animation
        setTimeout(() => {
          setIsAutoAdvancing(false);
        }, 2000);
      } else {
        // Manual slide change - clear ghost text
        bufferRef.current = '';
        setTranscript('');
      }
      return;
    }

    // Handle transcription updates
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

      // Update STT confidence
      if (update.payload.confidence !== undefined) {
        setSttConfidence(update.payload.confidence);
      }

      // Highlight when final transcript or high confidence
      if (update.payload.isFinal || (update.payload.confidence && update.payload.confidence > 0.8)) {
        setIsHighlighted(true);
        setTimeout(() => setIsHighlighted(false), 500);
      }
    }
  }, [lastMessage]);

  // Always render to show "Listening..." state even when no transcript received yet

  const getConfidenceColor = () => {
    if (sttConfidence === null) return 'text-slate-400';
    if (sttConfidence >= 0.8) return 'text-green-400';
    if (sttConfidence >= 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getBackgroundStyle = () => {
    if (isAutoAdvancing) {
      return 'bg-gradient-to-r from-green-500/5 via-green-500/10 to-green-500/5 border-green-500/30';
    }
    return 'bg-white/5';
  };

  return (
    <div className={cn('rounded-lg border border-white/10 p-4 backdrop-blur-sm transition-all duration-300', getBackgroundStyle())}>
      {/* Header section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Ghost Text
          </h3>
          {isAutoAdvancing && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-xs font-medium text-green-300">Matching...</span>
            </span>
          )}
        </div>

        {/* Confidence display */}
        <div className="flex items-center gap-2">
          {matchConfidence !== null && isAutoAdvancing && (
            <div className="text-right">
              <div className={cn('text-xs font-mono font-semibold text-green-400')}>
                {Math.round(matchConfidence * 100)}% match
              </div>
            </div>
          )}
          {sttConfidence !== null && !isAutoAdvancing && (
            <span className={cn('text-xs font-mono', getConfidenceColor())}>
              {Math.round(sttConfidence * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Main transcription text */}
      <div
        className={cn(
          'text-sm text-slate-300 font-light leading-relaxed transition-all duration-300 min-h-5',
          isHighlighted && 'text-green-300 font-normal',
          isAutoAdvancing && 'text-slate-100 font-medium'
        )}
      >
        {transcript || <span className="text-slate-500 italic">Listening...</span>}
      </div>

      {/* Auto-advance feedback */}
      {isAutoAdvancing && lastMatchedLine && (
        <div className="mt-3 pt-3 border-t border-green-500/20">
          <p className="text-xs text-slate-400 mb-1">Matched to:</p>
          <p className="text-sm text-green-300 italic line-clamp-2">
            &ldquo;{lastMatchedLine}&rdquo;
          </p>
        </div>
      )}

      {/* Footer info */}
      <div className="mt-2 text-xs text-slate-500">
        <span className="italic">
          {isAutoAdvancing ? '✨ AI is advancing slides...' : 'What the AI hears...'}
        </span>
      </div>
    </div>
  );
}

