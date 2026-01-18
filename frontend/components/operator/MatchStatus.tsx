'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { isDisplayUpdateMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

/**
 * Match Status Component
 * 
 * Displays real-time matching confidence and auto-advance feedback.
 * Shows the AI's confidence level when advancing slides, helping operators
 * understand why the AI made its decision.
 */
export function MatchStatus() {
  const { lastMessage } = useWebSocket(false);
  const [displayUpdate, setDisplayUpdate] = useState<DisplayUpdateMessage | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!lastMessage) return undefined;

    if (isDisplayUpdateMessage(lastMessage)) {
      const update = lastMessage as DisplayUpdateMessage;
      
      setDisplayUpdate(update);
      setFadeOut(false);

      // Auto fade out after delay (3s for auto-advance, 2s for manual)
      const delay = update.payload.isAutoAdvance ? 3000 : 2000;
      const timer = setTimeout(() => {
        setFadeOut(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [lastMessage]);

  if (!displayUpdate) {
    return null;
  }

  const confidence = displayUpdate.payload.matchConfidence ?? 0;
  const isAutoAdvance = displayUpdate.payload.isAutoAdvance ?? false;
  const confidencePercent = Math.round(confidence * 100);

  const getConfidenceColor = () => {
    if (confidence >= 0.85) return 'text-green-400';
    if (confidence >= 0.70) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getConfidenceBg = () => {
    if (confidence >= 0.85) return 'bg-green-500/10 border-green-500/30';
    if (confidence >= 0.70) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-orange-500/10 border-orange-500/30';
  };

  const getProgressColor = () => {
    if (confidence >= 0.85) return 'bg-green-500';
    if (confidence >= 0.70) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-500',
        getConfidenceBg(),
        fadeOut && 'opacity-0 scale-95'
      )}
    >
      {/* Header with auto-advance badge */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              {isAutoAdvance ? '🤖 AI Matched' : 'Slide Updated'}
            </h3>
            {isAutoAdvance && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-green-300">Auto-advanced</span>
              </span>
            )}
          </div>

          {/* Confidence percentage */}
          <span className={cn('text-sm font-mono font-semibold', getConfidenceColor())}>
            {confidencePercent}%
          </span>
        </div>

        {/* Confidence progress bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', getProgressColor())}
            style={{ width: `${confidencePercent}%` }}
          />
        </div>

        {/* Matched line text */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-slate-400 mb-1">Matched to:</p>
          <p className="text-sm text-slate-200 italic line-clamp-2">
            &ldquo;{displayUpdate.payload.lineText}&rdquo;
          </p>
        </div>

        {/* Confidence interpretation */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-slate-400">
            {confidencePercent >= 90 && '✨ Perfect match - High confidence'}
            {confidencePercent >= 85 && confidencePercent < 90 && '✓ Strong match - Confident'}
            {confidencePercent >= 75 && confidencePercent < 85 && '◐ Good match - Reasonable confidence'}
            {confidencePercent >= 70 && confidencePercent < 75 && '◐ Okay match - Some confidence'}
            {confidencePercent < 70 && '⚠ Weak match - Low confidence'}
          </p>
        </div>
      </div>

      {/* Fade-out indicator */}
      {!fadeOut && (
        <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-500 to-transparent animate-pulse" />
      )}
    </div>
  );
}

