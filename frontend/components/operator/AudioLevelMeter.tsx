'use client';

import { useAudioCapture, type AudioCaptureState } from '@/lib/hooks/useAudioCapture';
import { cn } from '@/lib/utils';

/**
 * Audio Level Meter Component
 * 
 * Displays real-time audio level visualization with animated bars
 * Shows operator that microphone is working and capturing audio
 */
interface AudioLevelMeterProps {
  state?: AudioCaptureState;
}

export function AudioLevelMeter({ state: providedState }: AudioLevelMeterProps) {
  const fallback = useAudioCapture();
  const state = providedState ?? fallback.state;

  // Don't render if not recording
  if (!state.isRecording) {
    return null;
  }

  // Calculate number of bars to show based on audio level (0-100)
  const numBars = 20;
  const activeBars = Math.ceil((state.audioLevel / 100) * numBars);

  // Color based on level
  const getBarColor = (index: number) => {
    if (index < numBars * 0.6) {
      return 'bg-green-400'; // Low levels: green
    } else if (index < numBars * 0.85) {
      return 'bg-yellow-400'; // Medium levels: yellow
    } else {
      return 'bg-red-400'; // High levels: red
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Audio Level
        </h3>
        <span className="text-xs text-slate-400 font-mono">
          {state.audioLevel}%
        </span>
      </div>

      {/* Audio Level Bars */}
      <div className="flex items-end gap-1 h-12">
        {Array.from({ length: numBars }).map((_, index) => {
          const isActive = index < activeBars;
          const height = ((index + 1) / numBars) * 100;

          return (
            <div
              key={index}
              className={cn(
                'w-full rounded-t transition-all duration-75',
                isActive ? getBarColor(index) : 'bg-slate-700/50',
                state.isPaused && 'opacity-50'
              )}
              style={{
                height: `${height}%`,
                minHeight: '4px',
              }}
            />
          );
        })}
      </div>

      {/* Status Indicator */}
      <div className="mt-2 flex items-center gap-2">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            state.isPaused
              ? 'bg-amber-400 animate-pulse'
              : state.audioLevel > 0
              ? 'bg-green-400'
              : 'bg-slate-500'
          )}
        />
        <span className="text-xs text-slate-400">
          {state.isPaused ? 'Paused' : state.audioLevel > 0 ? 'Recording' : 'No audio'}
        </span>
      </div>
    </div>
  );
}

