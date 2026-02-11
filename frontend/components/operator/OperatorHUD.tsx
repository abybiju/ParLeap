'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Zap, ZapOff, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useAudioCapture } from '@/lib/hooks/useAudioCapture';
import { useBibleWakeWord } from '@/lib/hooks/useBibleWakeWord';
import { useSlideCache } from '@/lib/stores/slideCache';
import { createClient } from '@/lib/supabase/client';
import { getProjectorFontClass, getProjectorFontIdOrDefault, projectorFonts } from '@/lib/projectorFonts';
import { isSessionStartedMessage, isSessionEndedMessage, isSongSuggestionMessage, isErrorMessage, isEventSettingsUpdatedMessage, isDisplayUpdateMessage } from '@/lib/websocket/types';
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

/** Polymorphic setlist item for pre-session display */
type InitialSetlistItem =
  | { kind: 'SONG'; id: string; songId: string; title: string; artist: string | null; sequenceOrder: number }
  | { kind: 'BIBLE'; id: string; bibleRef: string; sequenceOrder: number }
  | { kind: 'MEDIA'; id: string; mediaTitle: string; mediaUrl: string; sequenceOrder: number };

interface OperatorHUDProps {
  eventId: string;
  eventName: string;
  initialSetlist?: InitialSetlistItem[];
  initialProjectorFont?: string | null;
  initialBibleMode?: boolean;
  initialBibleVersionId?: string | null;
}

/**
 * Operator HUD Component
 * 
 * Professional operator interface with three-panel layout:
 * - Left: Ghost Text + Confidence Monitor
 * - Center: Current Slide + Next Preview
 * - Right: Setlist
 */
type BibleVersionOption = {
  id: string;
  name: string;
  abbrev: string;
  is_default: boolean;
};

export function OperatorHUD({
  eventId,
  eventName,
  initialSetlist = [],
  initialProjectorFont = null,
  initialBibleMode = false,
  initialBibleVersionId = null,
}: OperatorHUDProps) {
  const router = useRouter();
  const {
    state,
    isConnected,
    startSession,
    updateEventSettings,
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
  const [projectorFontId, setProjectorFontId] = useState<string>(
    getProjectorFontIdOrDefault(initialProjectorFont)
  );
  const [bibleMode, setBibleMode] = useState<boolean>(initialBibleMode);
  const [bibleVersionId, setBibleVersionId] = useState<string | null>(initialBibleVersionId);
  const [bibleFollow, setBibleFollow] = useState<boolean>(false);
  const [bibleVersions, setBibleVersions] = useState<BibleVersionOption[]>([]);
  const [smartListenEnabled, setSmartListenEnabled] = useState<boolean>(false);
  const [currentItemIsBible, setCurrentItemIsBible] = useState<boolean>(false);
  const slideCache = useSlideCache();

  const useSmartListenGate = smartListenEnabled && currentItemIsBible;

  const audioCapture = useAudioCapture({
    usePcm: sttProvider === 'elevenlabs',
    sessionActive: sessionStatus === 'active',
    smartListenEnabled: useSmartListenGate,
    smartListenBufferMs: 10000,
  });

  const wakeWord = useBibleWakeWord({
    enabled: sessionStatus === 'active' && useSmartListenGate && !!audioCapture.requestSttWindow,
    onWake: () => audioCapture.requestSttWindow?.(),
    cooldownMs: 3000,
  });

  // Sync currentItemIsBible from setlist item at currentItemIndex—never from displayed songId.
  // When bibleMode displays a verse while on a song, songId can be "bible:..." but the setlist item is still a song.
  // Smart Listen and Listen now require the actual setlist item to be BIBLE.
  useEffect(() => {
    if (!lastMessage) return;
    const items =
      isSessionStartedMessage(lastMessage)
        ? lastMessage.payload.setlistItems
        : slideCache.setlist?.setlistItems;
    let idx: number | undefined;
    if (isSessionStartedMessage(lastMessage)) {
      idx = lastMessage.payload.currentItemIndex ?? lastMessage.payload.currentSongIndex ?? 0;
    } else if (isDisplayUpdateMessage(lastMessage)) {
      idx = (lastMessage.payload as { currentItemIndex?: number }).currentItemIndex;
    }
    if (items && idx !== undefined && idx >= 0) {
      const item = items[idx];
      setCurrentItemIsBible(item?.type === 'BIBLE');
    }
    // When DISPLAY_UPDATE has no currentItemIndex (e.g. bibleMode verse display), do not infer from songId
    // — we may be on a song with bibleMode showing a verse.
  }, [lastMessage, slideCache.setlist]);

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

  useEffect(() => {
    let cancelled = false;

    const loadBibleVersions = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await (supabase
          .from('bible_versions') as ReturnType<typeof supabase.from>)
          .select('id, name, abbrev, is_default')
          .order('is_default', { ascending: false })
          .order('name', { ascending: true });

        if (error) {
          console.warn('[OperatorHUD] Failed to fetch bible versions:', error);
          return;
        }

        if (!cancelled && data) {
          const versions = data as BibleVersionOption[];
          setBibleVersions(versions);
          if (!bibleVersionId && versions.length > 0) {
            const defaultVersion = versions.find((v) => v.is_default) ?? versions[0];
            setBibleVersionId(defaultVersion?.id ?? null);
          }
        }
      } catch (error) {
        console.warn('[OperatorHUD] Failed to load bible versions:', error);
      }
    };

    loadBibleVersions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bibleMode || bibleVersionId || bibleVersions.length === 0) {
      return;
    }

    const defaultVersion = bibleVersions.find((v) => v.is_default) ?? bibleVersions[0];
    if (!defaultVersion) {
      return;
    }

    setBibleVersionId(defaultVersion.id);
    updateEventSettings({ bibleVersionId: defaultVersion.id });
    void persistEventSettings({ bible_version_id: defaultVersion.id });
  }, [bibleMode, bibleVersionId, bibleVersions, updateEventSettings]);

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
      console.log('[OperatorHUD] Setting sessionStatus to "active"');
      setSessionStatus('active');
      
      // Small delay to ensure sessionStatus state update propagates before starting audio
      // This ensures sessionActive prop is true when audio capture starts
      setTimeout(() => {
        console.log('[OperatorHUD] Starting audio capture, sessionStatus:', sessionStatus);
        // Auto-start audio capture immediately when session starts (permission should already be granted)
        if (!audioCapture.state.isRecording) {
          if (audioCapture.state.permissionState === 'granted') {
            // Start immediately - no delays
            console.log('[OperatorHUD] Starting audio capture (permission already granted)');
            audioCapture.start().catch((error) => {
              console.error('[OperatorHUD] Failed to start audio capture:', error);
              toast.error('Audio Capture Failed', {
                description: 'Failed to start microphone. Please check permissions.',
              });
            });
          } else {
            // Request permission and start
            console.log('[OperatorHUD] Requesting microphone permission');
            audioCapture.requestPermission().then((granted) => {
              if (granted) {
                console.log('[OperatorHUD] Permission granted, starting audio capture');
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
        } else {
          console.log('[OperatorHUD] Audio capture already recording');
        }
      }, 100); // Small delay to ensure state propagation
    }
  }, [lastMessage, audioCapture, sessionStatus]);

  // Sync projector font from session start or settings updates
  useEffect(() => {
    if (!lastMessage) return;
    if (isSessionStartedMessage(lastMessage)) {
      setProjectorFontId(getProjectorFontIdOrDefault(lastMessage.payload.projectorFont));
      setBibleMode(lastMessage.payload.bibleMode ?? false);
      if (lastMessage.payload.bibleVersionId !== undefined) {
        setBibleVersionId(lastMessage.payload.bibleVersionId);
      }
      if (lastMessage.payload.bibleFollow !== undefined) {
        setBibleFollow(lastMessage.payload.bibleFollow);
      }
      return;
    }
    if (isEventSettingsUpdatedMessage(lastMessage)) {
      if (lastMessage.payload.projectorFont !== undefined) {
        setProjectorFontId(getProjectorFontIdOrDefault(lastMessage.payload.projectorFont));
      }
      if (lastMessage.payload.bibleMode !== undefined) {
        setBibleMode(lastMessage.payload.bibleMode);
      }
      if (lastMessage.payload.bibleVersionId !== undefined) {
        setBibleVersionId(lastMessage.payload.bibleVersionId);
      }
      if (lastMessage.payload.bibleFollow !== undefined) {
        setBibleFollow(lastMessage.payload.bibleFollow);
      }
    }
  }, [lastMessage]);

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
          // Non-fatal errors should not flip the session to error state.
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
          startSession(eventId, { smartListenEnabled: smartListenEnabled });
        }
      }, 100);
      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkConnection), 5000);
    } else if (isConnected) {
      console.log('[OperatorHUD] Starting session for event:', eventId);
      setSessionStatus('starting');
      startSession(eventId, { smartListenEnabled: smartListenEnabled });
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

  const persistEventSettings = async (updates: Record<string, unknown>) => {
    try {
      const supabase = createClient();
      await (supabase
        .from('events') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', eventId);
    } catch (error) {
      console.warn('[OperatorHUD] Failed to persist event settings:', error);
    }
  };

  const handleProjectorFontChange = async (fontId: string) => {
    setProjectorFontId(fontId);
    updateEventSettings({ projectorFont: fontId });

    await persistEventSettings({ projector_font: fontId });
  };

  const handleBibleModeToggle = async () => {
    const nextMode = !bibleMode;
    let nextVersionId = bibleVersionId;

    if (nextMode && !nextVersionId && bibleVersions.length > 0) {
      const defaultVersion = bibleVersions.find((v) => v.is_default) ?? bibleVersions[0];
      nextVersionId = defaultVersion?.id ?? null;
      setBibleVersionId(nextVersionId);
    }

    setBibleMode(nextMode);
    if (!nextMode) {
      setBibleFollow(false);
    }
    updateEventSettings({ bibleMode: nextMode, bibleVersionId: nextVersionId ?? undefined });
    await persistEventSettings({ bible_mode: nextMode, bible_version_id: nextVersionId });

    if (nextMode) {
      toast.success('Bible mode enabled');
    } else {
      toast.info('Bible mode disabled');
    }
  };

  const handleBibleVersionChange = async (versionId: string) => {
    setBibleVersionId(versionId);
    updateEventSettings({ bibleVersionId: versionId });
    await persistEventSettings({ bible_version_id: versionId });
  };

  const handleStopBibleFollow = () => {
    setBibleFollow(false);
    updateEventSettings({ bibleFollow: false });
    toast.info('Passage follow paused');
  };

  const projectorFontClass = getProjectorFontClass(projectorFontId);

  const sessionLabel =
    sessionStatus === 'active'
      ? 'Live'
      : sessionStatus === 'starting'
      ? 'Starting'
      : sessionStatus === 'error'
      ? 'Error'
      : 'Idle';

  return (
    <div className="min-h-screen pt-16 flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Command Bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/5 backdrop-blur z-40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap',
                sessionStatus === 'active'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : sessionStatus === 'starting'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : sessionStatus === 'error'
                  ? 'bg-red-500/15 text-red-300 border-red-500/40'
                  : 'bg-slate-500/15 text-slate-300 border-slate-500/40'
              )}
            >
              Session: {sessionLabel}
            </span>
            <h1 className="text-lg font-semibold truncate">{eventName}</h1>
          </div>
          <ConnectionStatus />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Projector Font
            </span>
            <select
              value={projectorFontId}
              onChange={(e) => handleProjectorFontChange(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
            >
              {projectorFonts.map((font) => (
                <option key={font.id} value={font.id} className="text-slate-900">
                  {font.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Bible
            </span>
            <button
              onClick={handleBibleModeToggle}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors',
                bibleMode
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                  : 'bg-slate-500/20 text-slate-300 border-slate-500/40'
              )}
            >
              {bibleMode ? 'On' : 'Off'}
            </button>
            <select
              value={bibleVersionId ?? ''}
              onChange={(e) => handleBibleVersionChange(e.target.value)}
              disabled={!bibleMode || bibleVersions.length === 0}
              className={cn(
                'bg-transparent text-xs focus:outline-none',
                bibleMode ? 'text-slate-200' : 'text-slate-500'
              )}
            >
              <option value="" disabled className="text-slate-900">
                Version
              </option>
              {bibleVersions.map((version) => (
                <option key={version.id} value={version.id} className="text-slate-900">
                  {version.abbrev}
                </option>
              ))}
            </select>
          </div>
          {bibleFollow && (
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                Following
              </span>
              <button
                onClick={handleStopBibleFollow}
                className="text-[10px] font-semibold text-emerald-100/90 hover:text-white transition-colors"
              >
                Stop
              </button>
            </div>
          )}
          {/* Smart Bible Listen: only stream STT when wake word or manual trigger */}
          {bibleMode && (
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Smart Listen</span>
              <button
                onClick={() => {
                  const next = !smartListenEnabled;
                  setSmartListenEnabled(next);
                  if (sessionStatus === 'active') {
                    updateEventSettings({ smartListenEnabled: next });
                  }
                  if (next) toast.success('Smart Listen on: STT only after wake word or Listen now');
                  else toast.info('Smart Listen off: STT always on for Bible');
                }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors',
                  smartListenEnabled ? 'bg-amber-500/20 text-amber-200 border-amber-500/40' : 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                )}
              >
                {smartListenEnabled ? 'On' : 'Off'}
              </button>
              {smartListenEnabled && currentItemIsBible && sessionStatus === 'active' && audioCapture.requestSttWindow && (
                <>
                  {wakeWord.isListening && (
                    <span className="text-[10px] text-slate-400" title="Listening for Bible wake words">
                      Wake
                    </span>
                  )}
                  {wakeWord.error && (
                    <span className="text-[10px] text-amber-400" title={wakeWord.error}>
                      No wake
                    </span>
                  )}
                  <button
                    onClick={() => audioCapture.requestSttWindow?.()}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-sky-500/40 bg-sky-500/20 text-sky-200"
                    title="Open STT window now (send buffer + next 30s)"
                  >
                    <Mic className="inline h-3 w-3 mr-1" />
                    Listen now
                  </button>
                </>
              )}
            </div>
          )}
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
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                : state === 'connecting'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
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
      <div className="flex-1 grid grid-cols-[320px_1fr_320px] gap-4 p-4 overflow-hidden min-h-0">
        {/* Left Panel: Signal Stack */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <div className="px-4 pt-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Signal Stack
            </h2>
          </div>
          <div className="px-4 py-4 space-y-4 overflow-y-auto">
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Live Transcription
              </h3>
              <GhostText />
              <MatchStatus />
            </div>

            <div className="pt-2 border-t border-white/10 space-y-3">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Audio System
              </h3>
              <MicrophoneStatus
                state={audioCapture.state}
                requestPermission={audioCapture.requestPermission}
              />
              <AudioLevelMeter state={audioCapture.state} />
              <STTStatus audioActive={audioCapture.state.isRecording && !audioCapture.state.isPaused} />
            </div>
          </div>
        </div>

        {/* Center Panel: Live Display */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-white/5 to-white/5 backdrop-blur">
          <div className="flex-1 p-4 overflow-y-auto">
            <CurrentSlideDisplay fontClassName={projectorFontClass} />
          </div>
          <div className="px-4 pb-4">
            <NextSlidePreview />
          </div>

          {/* Command Dock */}
          <div className="relative flex-shrink-0 border-t border-white/10 bg-white/5 px-4 py-3">
            <div className="pointer-events-none absolute inset-x-4 bottom-2 h-2 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent blur-[8px]" />
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={prevSlide}
                disabled={sessionStatus !== 'active'}
                className={cn(
                  'px-6 py-3 rounded-xl text-base font-semibold min-w-[110px] transition-all',
                  'flex flex-col items-center gap-1',
                  'border border-indigo-400/40 bg-gradient-to-b from-indigo-500/40 via-indigo-500/20 to-indigo-500/10',
                  'shadow-[0_10px_30px_rgba(49,46,129,0.35)] hover:shadow-[0_16px_36px_rgba(49,46,129,0.45)]',
                  'hover:translate-y-[-1px] active:translate-y-0',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                )}
                title={sessionStatus !== 'active' ? 'Start session first' : 'Previous slide'}
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="text-xs tracking-[0.2em] uppercase">Prev</span>
              </button>
              {sessionStatus === 'active' ? (
                audioCapture.state.isRecording && !audioCapture.state.isPaused ? (
                  <button
                    onClick={() => audioCapture.pause()}
                    className="px-6 py-3 rounded-xl text-base font-semibold min-w-[110px] transition-all border border-amber-400/40 bg-gradient-to-b from-amber-500/50 via-amber-500/25 to-amber-500/10 shadow-[0_10px_30px_rgba(245,158,11,0.35)] hover:shadow-[0_16px_36px_rgba(245,158,11,0.45)] hover:translate-y-[-1px] active:translate-y-0"
                  >
                    PAUSE
                  </button>
                ) : audioCapture.state.isRecording && audioCapture.state.isPaused ? (
                  <button
                    onClick={() => audioCapture.resume()}
                    className="px-6 py-3 rounded-xl text-base font-semibold min-w-[110px] transition-all border border-blue-400/40 bg-gradient-to-b from-blue-500/50 via-blue-500/25 to-blue-500/10 shadow-[0_10px_30px_rgba(59,130,246,0.35)] hover:shadow-[0_16px_36px_rgba(59,130,246,0.45)] hover:translate-y-[-1px] active:translate-y-0"
                  >
                    RESUME
                  </button>
                ) : (
                  <button
                    onClick={() => audioCapture.start()}
                    disabled={audioCapture.state.permissionState !== 'granted'}
                    className="px-6 py-3 rounded-xl text-base font-semibold min-w-[110px] transition-all border border-emerald-400/40 bg-gradient-to-b from-emerald-500/60 via-emerald-500/30 to-emerald-500/10 shadow-[0_10px_30px_rgba(16,185,129,0.35)] hover:shadow-[0_16px_36px_rgba(16,185,129,0.45)] hover:translate-y-[-1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    START AUDIO
                  </button>
                )
              ) : (
                <div className="relative">
                  <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-emerald-500/30 blur-md animate-pulse" />
                  <button
                    onClick={handleStartSession}
                    disabled={sessionStatus === 'starting'}
                    className="relative px-6 py-3 rounded-xl text-base font-semibold min-w-[110px] transition-all border border-emerald-400/40 bg-gradient-to-b from-emerald-500/70 via-emerald-500/35 to-emerald-500/10 shadow-[0_10px_30px_rgba(16,185,129,0.4)] hover:shadow-[0_18px_40px_rgba(16,185,129,0.5)] hover:translate-y-[-1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {sessionStatus === 'starting' ? 'STARTING...' : 'START SESSION'}
                  </button>
                </div>
              )}
              <button
                onClick={nextSlide}
                disabled={sessionStatus !== 'active'}
                className={cn(
                  'px-6 py-3 rounded-xl text-base font-semibold min-w-[110px] transition-all',
                  'flex flex-col items-center gap-1',
                  'border border-indigo-400/40 bg-gradient-to-b from-indigo-500/40 via-indigo-500/20 to-indigo-500/10',
                  'shadow-[0_10px_30px_rgba(49,46,129,0.35)] hover:shadow-[0_16px_36px_rgba(49,46,129,0.45)]',
                  'hover:translate-y-[-1px] active:translate-y-0',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                )}
                title={sessionStatus !== 'active' ? 'Start session first' : 'Next slide'}
              >
                <ChevronRight className="h-5 w-5" />
                <span className="text-xs tracking-[0.2em] uppercase">Next</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Setlist */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <SetlistPanel initialSetlist={initialSetlist} />
        </div>
      </div>
    </div>
  );
}
