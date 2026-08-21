'use client';

import { cn } from '@/lib/utils';
import type { BibleLogEntry, BibleProjectionSource } from '@/lib/websocket/types';

interface BibleHistoryPanelProps {
  entries: BibleLogEntry[];
  currentLabel: string | null;
  disabled?: boolean;
  onProject: (entry: BibleLogEntry) => void;
}

const SOURCE_SHORT: Record<BibleProjectionSource, string> = {
  spoken: 'heard',
  content: 'words',
  follow: 'auto',
  manual: 'you',
  undo: 'undo',
  setlist: 'setlist',
};

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

/**
 * Live session log for Bible mode (newest first). Click an entry to re-project it.
 * Held-but-not-shown detections are listed dimmed so the operator can see what the engine heard.
 */
export function BibleHistoryPanel({ entries, currentLabel, disabled = false, onProject }: BibleHistoryPanelProps) {
  return (
    <div className="space-y-2" data-testid="bible-history">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Verse history</h3>
        <span className="text-[10px] text-slate-500">{entries.length} this session</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500 italic">Verses you project will appear here.</p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {entries.map((e) => {
            const isCurrent = e.projected && e.label === currentLabel && e === entries.find((x) => x.projected);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onProject(e)}
                  disabled={disabled}
                  title={e.projected ? `Project ${e.label} again` : `Detected while holding — project ${e.label}`}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed',
                    isCurrent
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/5 bg-white/[0.03] hover:bg-white/10',
                    !e.projected && 'opacity-60'
                  )}
                >
                  <span className="text-[10px] tabular-nums text-slate-500 w-14 flex-shrink-0">{fmtTime(e.at)}</span>
                  <span className={cn('text-xs font-medium truncate flex-1', e.projected ? 'text-slate-100' : 'text-slate-300 line-through')}>
                    {e.label}
                  </span>
                  <span className="text-[10px] rounded-full border border-white/10 px-1.5 py-0.5 text-slate-400 flex-shrink-0">
                    {e.projected ? SOURCE_SHORT[e.source] : 'held'}
                  </span>
                  {e.confidence !== null && (
                    <span
                      className={cn(
                        'text-[10px] tabular-nums flex-shrink-0 w-8 text-right',
                        e.confidence >= 0.85 ? 'text-emerald-300' : e.confidence >= 0.65 ? 'text-amber-300' : 'text-red-300'
                      )}
                    >
                      {Math.round(e.confidence * 100)}%
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
