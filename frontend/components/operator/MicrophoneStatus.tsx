'use client';

import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { cn } from '@/lib/utils';
import { Mic, MicOff, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Microphone Status Component
 * 
 * Displays microphone permission status, recording state, and errors
 * Provides clear feedback to operator about microphone access
 */
export function MicrophoneStatus() {
  const { state, requestPermission } = useAudioCapture();

  const getStatusConfig = () => {
    if (state.error) {
      return {
        icon: AlertCircle,
        iconColor: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/50',
        text: 'Error',
        description: state.error,
      };
    }

    if (state.permissionState === 'denied') {
      return {
        icon: MicOff,
        iconColor: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/50',
        text: 'Permission Denied',
        description: 'Microphone access is blocked. Please allow access in browser settings.',
      };
    }

    if (state.permissionState === 'unsupported') {
      return {
        icon: MicOff,
        iconColor: 'text-slate-400',
        bgColor: 'bg-slate-500/20',
        borderColor: 'border-slate-500/50',
        text: 'Not Supported',
        description: 'MediaRecorder API is not supported in this browser.',
      };
    }

    if (state.isRecording) {
      return {
        icon: Mic,
        iconColor: state.isPaused ? 'text-amber-400' : 'text-green-400',
        bgColor: state.isPaused ? 'bg-amber-500/20' : 'bg-green-500/20',
        borderColor: state.isPaused ? 'border-amber-500/50' : 'border-green-500/50',
        text: state.isPaused ? 'Paused' : 'Recording',
        description: state.isPaused
          ? 'Recording is paused. Click resume to continue.'
          : 'Microphone is active and streaming audio.',
      };
    }

    if (state.permissionState === 'granted') {
      return {
        icon: CheckCircle2,
        iconColor: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/50',
        text: 'Ready',
        description: 'Microphone permission granted. Click start to begin recording.',
      };
    }

    // Default: prompt state
    return {
      icon: MicOff,
      iconColor: 'text-slate-400',
      bgColor: 'bg-slate-500/20',
      borderColor: 'border-slate-500/50',
      text: 'Permission Required',
      description: 'Click to request microphone access.',
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 backdrop-blur-sm transition-all',
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5', config.iconColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-200">
              {config.text}
            </h3>
            {state.isRecording && (
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  state.isPaused ? 'bg-amber-400' : 'bg-green-400 animate-pulse'
                )}
              />
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {config.description}
          </p>

          {/* Action Button for Permission */}
          {(state.permissionState === 'prompt' || state.permissionState === 'denied') && (
            <button
              onClick={requestPermission}
              className={cn(
                'mt-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400',
                'border border-blue-500/50 hover:border-blue-500/70'
              )}
            >
              {state.permissionState === 'denied' ? 'Retry Permission' : 'Request Access'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

