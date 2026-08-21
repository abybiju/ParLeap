'use client';

import { ChevronLeft, ChevronRight, Pin, PinOff, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BibleCandidate, BibleProjectionSource, BibleStatusMessage } from '@/lib/websocket/types';

export type BibleStatus = BibleStatusMessage['payload'];

interface BibleControlsProps {
  status: BibleStatus | null;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleHold: () => void;
  onUndo: () => void;
  onProject: (candidate: BibleCandidate) => void;
}

const SOURCE_LABEL: Record<BibleProjectionSource, string> = {
  spoken: 'Heard reference',
  content: 'Matched by words',
  follow: 'Auto-advanced',
  manual: 'Operator',
  undo: 'Undo',
  setlist: 'Setlist',
};

function confidenceTone(score: number | null): string {
  if (score === null) return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  if (score >= 0.85) return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40';
  if (score >= 0.65) return 'bg-amber-500/20 text-amber-200 border-amber-500/40';
  return 'bg-red-500/20 text-red-200 border-red-500/40';
}

/**
 * Bible-mode operator strip: what's on screen and why, confidence, hold/pin, step verses, undo,
 * and one-click projection of alternative candidates. Keyboard: ←/→ step, H hold, U undo.
 */
export function BibleControls({ status, disabled = false, onPrev, onNext, onToggleHold, onUndo, onProject }: BibleControlsProps) {
  const hold = status?.hold ?? false;
  const current = status?.currentLabel ?? null;
  const confidence = status?.confidence ?? null;
  const source = status?.source ?? null;
  const candidates = (status?.candidates ?? []).filter((c) => c.label !== current).slice(0, 3);
  const held = status?.heldDetection ?? null;
  const btn =
    'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2',
        hold ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/5'
      )}
      data-testid="bible-controls"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">On screen</span>
          <span className="text-sm font-semibold text-white truncate">{current ?? 'Waiting for a reference…'}</span>
          {source && (
            <span className="hidden xl:inline text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-slate-300">
              {SOURCE_LABEL[source]}
            </span>
          )}
          {confidence !== null && (
            <span
              className={cn('text-[10px] rounded-full border px-2 py-0.5 font-semibold', confidenceTone(confidence))}
              title="Detector confidence for the verse on screen"
            >
              {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onPrev}
            disabled={disabled || !current}
            className={cn(btn, 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')}
            title="Previous verse (←)"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled || !current}
            className={cn(btn, 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')}
            title="Next verse (→)"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleHold}
            disabled={disabled}
            aria-pressed={hold}
            className={cn(
              btn,
              hold
                ? 'border-amber-400/60 bg-amber-500/30 text-amber-100 hover:bg-amber-500/40'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            )}
            title={hold ? 'Release hold — detection projects again (H)' : 'Hold this verse on screen; detection keeps listening (H)'}
          >
            {hold ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {hold ? 'Holding' : 'Hold'}
          </button>
          <button
            type="button"
            onClick={onUndo}
            disabled={disabled || !(status?.canUndo ?? false)}
            className={cn(btn, 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')}
            title={status?.historyDepth ? `Back to previous verse (U) — ${status.historyDepth} in history` : 'Nothing to undo'}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
      </div>

      {held && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5">
          <p className="text-xs text-amber-100 truncate">
            <span className="font-semibold">Up next:</span> {held.label}
            {held.text ? <span className="text-amber-200/80"> — {held.text}</span> : null}
          </p>
          <button
            type="button"
            onClick={() => onProject(held)}
            disabled={disabled}
            className={cn(btn, 'border-amber-400/60 bg-amber-500/30 text-amber-50 hover:bg-amber-500/40')}
          >
            Show now
          </button>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Also considered</span>
          {candidates.map((c) => (
            <button
              key={`${c.book}-${c.chapter}-${c.verse}`}
              type="button"
              onClick={() => onProject(c)}
              disabled={disabled}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/15 transition-colors disabled:opacity-40"
              title={c.text ? `${c.label}: ${c.text}` : `Project ${c.label}`}
            >
              {c.label} <span className="text-slate-400">{Math.round(c.score * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
