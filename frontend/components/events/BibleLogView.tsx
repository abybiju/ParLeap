'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface BibleLogRow {
  id: string;
  session_id: string;
  book: string;
  chapter: number;
  verse: number;
  end_verse: number | null;
  version_abbrev: string | null;
  source: string;
  confidence: number | null;
  projected: boolean;
  transcript_snippet: string | null;
  created_at: string;
}

interface BibleLogViewProps {
  eventId: string;
}

const SOURCE_LABEL: Record<string, string> = {
  spoken: 'Heard reference',
  content: 'Matched by words',
  follow: 'Auto-advanced',
  manual: 'Operator',
  undo: 'Undo',
  setlist: 'Setlist',
};

function label(r: BibleLogRow): string {
  return `${r.book} ${r.chapter}:${r.verse}${r.end_verse && r.end_verse > r.verse ? `-${r.end_verse}` : ''}`;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Post-service review of everything Smart Bible Listen projected (or heard while holding)
 * for this event, grouped by live session. Reads bible_projection_log via RLS.
 */
export function BibleLogView({ eventId }: BibleLogViewProps) {
  const [rows, setRows] = useState<BibleLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: qErr } = await (supabase.from('bible_projection_log') as ReturnType<typeof supabase.from>)
        .select('id, session_id, book, chapter, verse, end_verse, version_abbrev, source, confidence, projected, transcript_snippet, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (qErr) {
        setError(qErr.code === '42P01' || /relation .* does not exist/i.test(qErr.message) ? 'Verse log table is not set up yet (run migration 026).' : qErr.message);
        setRows([]);
      } else {
        setRows((data ?? []) as BibleLogRow[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verse log');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sessions = useMemo(() => {
    const map = new Map<string, BibleLogRow[]>();
    for (const r of rows) {
      const list = map.get(r.session_id) ?? [];
      list.push(r);
      map.set(r.session_id, list);
    }
    return [...map.entries()];
  }, [rows]);

  const stats = useMemo(() => {
    const projected = rows.filter((r) => r.projected);
    const auto = projected.filter((r) => r.source === 'spoken' || r.source === 'content' || r.source === 'follow').length;
    const books = new Map<string, number>();
    for (const r of projected) books.set(r.book, (books.get(r.book) ?? 0) + 1);
    const topBooks = [...books.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total: projected.length, auto, manual: projected.length - auto, held: rows.length - projected.length, topBooks };
  }, [rows]);

  const exportCsv = () => {
    const header = ['time', 'session', 'reference', 'version', 'source', 'confidence', 'projected', 'transcript'];
    const lines = rows.map((r) =>
      [r.created_at, r.session_id, label(r), r.version_abbrev ?? '', r.source, r.confidence ?? '', r.projected ? 'yes' : 'held', r.transcript_snippet ?? '']
        .map(csvEscape)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bible-log-${eventId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-xl shadow-slate-900/40 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-300" />
            Verse log
          </h2>
          <p className="text-sm text-slate-300">Every verse Smart Bible Listen put on screen during this event, and why.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{error}</p>}

      {!error && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Verses shown" value={stats.total} />
          <Stat label="Auto-detected" value={stats.auto} hint={stats.total ? `${Math.round((stats.auto / stats.total) * 100)}%` : undefined} />
          <Stat label="Operator" value={stats.manual} />
          <Stat label="Held (not shown)" value={stats.held} />
          {stats.topBooks.length > 0 && (
            <div className="col-span-2 md:col-span-4 text-xs text-slate-400">
              Most quoted: {stats.topBooks.map(([b, n]) => `${b} (${n})`).join(' · ')}
            </div>
          )}
        </div>
      )}

      {!error && !loading && rows.length === 0 && (
        <p className="text-sm text-slate-500 italic">No verses logged yet. Run a live session in Bible mode and they will show up here.</p>
      )}

      {sessions.map(([sessionId, list]) => (
        <section key={sessionId} className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Session {sessionId.replace(/^session_/, '')} · {new Date(list[list.length - 1].created_at).toLocaleString()}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Reference</th>
                  <th className="px-3 py-2 text-left font-medium">How</th>
                  <th className="px-3 py-2 text-right font-medium">Conf.</th>
                  <th className="px-3 py-2 text-left font-medium">Transcript</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={cn('border-t border-white/5', !r.projected && 'opacity-60')}>
                    <td className="px-3 py-2 tabular-nums text-slate-400 whitespace-nowrap">{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td className="px-3 py-2 font-medium text-white whitespace-nowrap">
                      {label(r)} {r.version_abbrev && <span className="text-slate-500 font-normal">{r.version_abbrev}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{r.projected ? SOURCE_LABEL[r.source] ?? r.source : 'Held (not shown)'}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        r.confidence === null ? 'text-slate-500' : r.confidence >= 0.85 ? 'text-emerald-300' : r.confidence >= 0.65 ? 'text-amber-300' : 'text-red-300'
                      )}
                    >
                      {r.confidence === null ? '—' : `${Math.round(r.confidence * 100)}%`}
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-[28rem] truncate" title={r.transcript_snippet ?? ''}>
                      {r.transcript_snippet ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-white">
        {value}
        {hint && <span className="ml-1.5 text-sm font-normal text-slate-400">{hint}</span>}
      </p>
    </div>
  );
}
