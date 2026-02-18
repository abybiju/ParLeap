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
  /** When provided (e.g. from parent CCLI-only fetch), do not fetch by line count; use this list and selectedTemplateId */
  templatesFromCcliOnly?: CommunityTemplate[];
  selectedTemplateId?: string | null;
}

function parseLyricLines(lyrics: string): string[] {
  return lyrics
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Section labels (Chorus, Verse 1, Bridge, etc.) — not counted as content lines in slide preview */
const SECTION_LABEL_PATTERN = /^(verse\s*\d*|chorus|bridge|outro|intro|pre\s*-?\s*chorus|post\s*-?\s*chorus|tag|interlude|ending)$/i;

function isSectionLabel(line: string): boolean {
  return SECTION_LABEL_PATTERN.test(line.trim());
}

function contentLineCount(stanza: string[]): number {
  return stanza.filter((l) => !isSectionLabel(l)).length;
}

function isUsableTemplate(tpl: CommunityTemplate) {
  if (!tpl) return false;
  if (typeof tpl.id !== 'string' || tpl.id.length === 0) return false;
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
  templatesFromCcliOnly,
  selectedTemplateId,
}: SongPreviewCardsProps) {
  const [appliedTemplate, setAppliedTemplate] = useState<CommunityTemplate | null>(null);
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lines = parseLyricLines(lyrics);
  const lineCount = lines.length;
  const hasParentTemplates = Array.isArray(templatesFromCcliOnly) && templatesFromCcliOnly.length >= 0;

  // When parent passes CCLI-only templates: no fetch; filter by line count and apply selected or best
  useEffect(() => {
    if (!hasParentTemplates || !templatesFromCcliOnly || !ccliNumber || !lyrics.trim() || lineCount === 0) {
      if (hasParentTemplates && (!lyrics.trim() || lineCount === 0)) {
        setAppliedTemplate(null);
        onTemplateApplied?.(null);
      }
      return;
    }
    const matching = templatesFromCcliOnly.filter((t) => isUsableTemplate(t) && t.line_count === lineCount);
    const preferred = selectedTemplateId && matching.find((t) => t.id === selectedTemplateId);
    const best = preferred ?? matching.find((t) => (t.score ?? 0) >= 0) ?? matching.find((t) => (t.score ?? 0) >= -5) ?? matching[0];
    if (!best) {
      setAppliedTemplate(null);
      onTemplateApplied?.(null);
      return;
    }
    const applied = applyTemplate(lines, best);
    if (applied) {
      setAppliedTemplate(best);
      onTemplateApplied?.(best.id);
      recordTemplateUsage(best.id).catch(() => {});
    } else {
      setAppliedTemplate(null);
      onTemplateApplied?.(null);
    }
  }, [hasParentTemplates, templatesFromCcliOnly, ccliNumber, lyrics, lineCount, selectedTemplateId, onTemplateApplied]);

  // When parent does NOT pass templates: fetch by CCLI + line count (legacy behavior)
  useEffect(() => {
    if (hasParentTemplates) return;
    let cancelled = false;
    const run = async () => {
      setAppliedTemplate(null);
      onTemplateApplied?.(null);
      if (!ccliNumber || !lyrics.trim()) return;
      if (lineCount === 0) return;
      const fetched = (await fetchTemplates(ccliNumber, lineCount)).filter(isUsableTemplate);
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
  }, [hasParentTemplates, ccliNumber, lyrics, lineCount, onTemplateApplied]);

  // Swap dialog: when parent provides templates, use filtered list; otherwise fetch on open
  useEffect(() => {
    if (!swapOpen) return;
    if (!ccliNumber || !lyrics.trim()) {
      onSwapClose?.();
      return;
    }
    if (hasParentTemplates && templatesFromCcliOnly) {
      const matching = templatesFromCcliOnly.filter((t) => isUsableTemplate(t) && t.line_count === lineCount);
      setTemplates(matching);
    } else if (templates.length === 0 && !loadingTemplates) {
      setLoadingTemplates(true);
      fetchTemplates(ccliNumber, lineCount)
        .then((tpls) => setTemplates(tpls.filter(isUsableTemplate)))
        .finally(() => setLoadingTemplates(false));
    }
  }, [swapOpen, ccliNumber, lyrics, lineCount, hasParentTemplates, templatesFromCcliOnly, templates.length, loadingTemplates, onSwapClose]);

  const stanzas = useMemo(() => {
    if (appliedTemplate) {
      const lines = parseLyricLines(lyrics);
      const slides = applyTemplate(lines, appliedTemplate);
      if (slides) return slides;
    }
    return parseStanzas(lyrics);
  }, [appliedTemplate, lyrics]);

  const selectedTemplate = selectedTemplateId && templatesFromCcliOnly?.find((t) => t.id === selectedTemplateId);
  const lineCountMismatch =
    hasParentTemplates &&
    selectedTemplate &&
    lyrics.trim().length > 0 &&
    lineCount > 0 &&
    lineCount !== selectedTemplate.line_count &&
    !appliedTemplate;

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
      {lineCountMismatch && (
        <p className="text-xs text-amber-400/90 mb-2">
          Your lyrics have {lineCount} lines; your chosen format is for {selectedTemplate?.line_count} lines. Use another format or keep as-is.
        </p>
      )}
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
                {contentLineCount(stanza)} {contentLineCount(stanza) === 1 ? 'line' : 'lines'}
              </Badge>
            </div>
            <div className="space-y-1">
              {stanza.map((line, lineIndex) => {
                const isLabel = isSectionLabel(line);
                return (
                  <p
                    key={lineIndex}
                    className={
                      isLabel
                        ? 'text-xs text-muted-foreground font-medium uppercase tracking-wider'
                        : 'text-foreground text-sm leading-relaxed font-light'
                    }
                  >
                    {line}
                  </p>
                );
              })}
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
              const templateLabel = typeof tpl.id === 'string' ? tpl.id.slice(0, 8) : 'unknown';
              return (
                <div key={tpl.id} className="rounded-lg border border-white/10 p-3 bg-white/5 flex items-center justify-between">
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">Template {templateLabel}</div>
                    <div className="text-slate-400">
                      {(tpl.upvotes ?? 0)} upvotes • {tpl.usage_count ?? 0} uses • {tpl.slides.length} slides
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
