'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseStanzas } from '@/lib/schemas/song';
import { Badge } from '@/components/ui/badge';
import { fetchTemplates, CommunityTemplate } from '@/lib/api/templates';
import { toast } from 'sonner';

interface SongPreviewCardsProps {
  lyrics: string;
  ccliNumber?: string;
  className?: string;
  onTemplateApplied?: (templateId: string | null) => void;
}

function parseLyricLines(lyrics: string): string[] {
  return lyrics
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function applyTemplate(lines: string[], tpl: CommunityTemplate) {
  if (tpl.line_count !== lines.length) return null;
  const slides = tpl.slides.map((s) => {
    const segment = lines.slice(s.start_line, s.end_line + 1);
    return segment;
  });
  return slides;
}

export function SongPreviewCards({ lyrics, ccliNumber, className = '', onTemplateApplied }: SongPreviewCardsProps) {
  const [appliedTemplate, setAppliedTemplate] = useState<CommunityTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setAppliedTemplate(null);
      onTemplateApplied?.(null);
      if (!ccliNumber || !lyrics.trim()) return;
      const lines = parseLyricLines(lyrics);
      if (lines.length === 0) return;
      const templates = await fetchTemplates(ccliNumber, lines.length);
      const best = templates.find((t) => (t.score ?? 0) >= -5) ?? templates[0];
      if (!best) return;
      const applied = applyTemplate(lines, best);
      if (applied && !cancelled) {
        setAppliedTemplate(best);
        toast.success(`Applied Community Version`, {
          description: `Score ${best.score ?? 0}${best.usage_count ? ` • ${best.usage_count} uses` : ''}`,
        });
        onTemplateApplied?.(best.id);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [ccliNumber, lyrics]);

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
  );
}
