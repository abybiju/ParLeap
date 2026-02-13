'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseStanzas } from '@/lib/schemas/song';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchTemplates, submitTemplate, recordTemplateUsage, CommunityTemplate } from '@/lib/api/templates';
import { toast } from 'sonner';

interface SongPreviewCardsProps {
  lyrics: string;
  ccliNumber?: string;
  className?: string;
  onTemplateApplied?: (templateId: string | null) => void;
  swapOpen?: boolean;
  onSwapClose?: () => void;
  offerSubmit?: boolean;
}

function parseLyricLines(lyrics: string): string[] {
  return lyrics
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function isUsableTemplate(tpl: CommunityTemplate) {
  if (!tpl) return false;
  if (!Array.isArray(tpl.slides) || tpl.slides.length === 0) return false;
  if (typeof tpl.line_count !== 'number' || tpl.line_count <= 0) return false;
  return tpl.slides.every(
    (s) =>
      s &&
      typeof s.start_line === 'number' &&
      typeof s.end_line === 'number' &&
      s.start_line >= 0 &&
      s.end_line >= s.start_line,
  );
}

function applyTemplate(lines: string[], tpl: CommunityTemplate) {
  if (!isUsableTemplate(tpl)) return null;
  if (tpl.line_count !== lines.length) return null;
  const slides = tpl.slides.map((s) => lines.slice(s.start_line, s.end_line + 1));
  // guard against empty slices
  if (slides.some((seg) => seg.length === 0)) return null;
  return slides;
}

export function SongPreviewCards({
  lyrics,
  ccliNumber,
  className = '',
  onTemplateApplied,
  swapOpen = false,
  onSwapClose,
  offerSubmit = false,
}: SongPreviewCardsProps) {
  const [appliedTemplate, setAppliedTemplate] = useState<CommunityTemplate | null>(null);
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setAppliedTemplate(null);
      onTemplateApplied?.(null);
      if (!ccliNumber || !lyrics.trim()) return;
      const lines = parseLyricLines(lyrics);
      if (lines.length === 0) return;
      const fetched = (await fetchTemplates(ccliNumber, lines.length)).filter(isUsableTemplate);
      if (cancelled) return;
      setTemplates(fetched);
      const best = fetched.find((t) => (t.score ?? 0) >= 0) ?? fetched.find((t) => (t.score ?? 0) >= -5) ?? fetched[0];
      if (!best) return;
      const applied = applyTemplate(lines, best);
      if (applied && !cancelled) {
        setAppliedTemplate(best);
        toast.success(`Applied Community Version`, {
          description: `Score ${best.score ?? 0}${best.usage_count ? ` • ${best.usage_count} uses` : ''}`,
        });
        onTemplateApplied?.(best.id);
        recordTemplateUsage(best.id).catch(() => {});
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [ccliNumber, lyrics, onTemplateApplied]);

  useEffect(() => {
    if (!swapOpen) return;
    if (!ccliNumber || !lyrics.trim()) {
      onSwapClose?.();
      return;
    }
    if (templates.length === 0 && !loadingTemplates) {
      setLoadingTemplates(true);
      fetchTemplates(ccliNumber, parseLyricLines(lyrics).length)
        .then((tpls) => setTemplates(tpls))
        .finally(() => setLoadingTemplates(false));
    }
  }, [swapOpen, ccliNumber, lyrics, templates.length, loadingTemplates, onSwapClose]);

  const stanzas = useMemo(() => {
    if (appliedTemplate) {
      const lines = parseLyricLines(lyrics);
      const slides = applyTemplate(lines, appliedTemplate);
      if (slides) return slides;
    }
    return parseStanzas(lyrics);
  }, [appliedTemplate, lyrics]);

  if (stanzas.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-muted-foreground ${className}`}>
        <div className="text-center">
          <p className="text-sm">Type or paste lyrics to see preview</p>
          <p className="text-xs text-muted-foreground/60 mt-2">Separate stanzas with blank lines (press Enter twice)</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-4 overflow-y-auto pr-2 ${className}`}>
        {stanzas.map((stanza, index) => (
          <div
            key={index}
            className="preview-card p-4 rounded-xl transition-all duration-200 hover:shadow-lg"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Slide {index + 1}
              </span>
              <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                {stanza.length} {stanza.length === 1 ? 'line' : 'lines'}
              </Badge>
            </div>
            <div className="space-y-1">
              {stanza.map((line, lineIndex) => (
                <p 
                  key={lineIndex} 
                  className="text-foreground text-sm leading-relaxed font-light"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={swapOpen} onOpenChange={(open) => !open && onSwapClose?.()}>
        <DialogContent className="max-w-3xl border-white/10 bg-[#0A0A0A]/95 text-white">
          <DialogHeader>
            <DialogTitle>Swap Community Template</DialogTitle>
            <DialogDescription>Select a version to apply to this song.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loadingTemplates && <p className="text-sm text-slate-400">Loading templates…</p>}
            {!loadingTemplates && templates.length === 0 && (
              <p className="text-sm text-slate-400">No community templates available for this CCLI/line count.</p>
            )}
            {!loadingTemplates && templates.map((tpl) => {
              const slidesApplied = applyTemplate(parseLyricLines(lyrics), tpl);
              const valid = !!slidesApplied;
              return (
                <div key={tpl.id} className="rounded-lg border border-white/10 p-3 bg-white/5 flex items-center justify-between">
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">Template {tpl.id.slice(0, 8)}</div>
                    <div className="text-slate-400">
                      Score {tpl.score ?? 0} • Uses {tpl.usage_count ?? 0} • Slides {tpl.slides.length}
                    </div>
                    {!valid && <div className="text-amber-400 text-xs">Line count mismatch; cannot apply.</div>}
                    {(tpl.score ?? 0) < 0 && <div className="text-amber-400 text-xs">Low score; not auto-applied.</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!valid}
                      onClick={() => {
                        const lines = parseLyricLines(lyrics);
                        const applied = applyTemplate(lines, tpl);
                        if (!applied) return;
                        setAppliedTemplate(tpl);
                        onTemplateApplied?.(tpl.id);
                        recordTemplateUsage(tpl.id).catch(() => {});
                        toast.success('Applied community template');
                        onSwapClose?.();
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {offerSubmit && (
            <DialogFooter className="flex items-center justify-between">
              <div className="text-sm text-slate-400">Don’t see a good version? Submit your current formatting.</div>
              <Button
                variant="default"
                disabled={submitting}
                onClick={async () => {
                  const lines = parseLyricLines(lyrics);
                  if (!ccliNumber || lines.length === 0) {
                    toast.error('Need CCLI number and lyrics to submit.');
                    return;
                  }
                  setSubmitting(true);
                  const slidesToSend = stanzas.map((stanza, idx) => {
                    const start = stanzas.slice(0, idx).reduce((acc, s) => acc + s.length, 0);
                    return { start_line: start, end_line: start + stanza.length - 1 };
                  });
                  const res = await submitTemplate({
                    ccliNumber,
                    lineCount: lines.length,
                    slides: slidesToSend,
                    sections: [],
                  });
                  if (res.success) {
                    toast.success('Submitted formatting to community');
                    // refresh template list after submit
                    setTemplates(await fetchTemplates(ccliNumber, lines.length));
                  } else {
                    toast.error(res.error || 'Submit failed');
                  }
                  setSubmitting(false);
                }}
              >
                {submitting ? 'Submitting…' : 'Submit This Formatting'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
