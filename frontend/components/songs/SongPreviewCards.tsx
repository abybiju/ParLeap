'use client';

import { useMemo } from 'react';
import { parseStanzas } from '@/lib/schemas/song';
import { Badge } from '@/components/ui/badge';

interface SongPreviewCardsProps {
  lyrics: string;
  className?: string;
}

export function SongPreviewCards({ lyrics, className = '' }: SongPreviewCardsProps) {
  const stanzas = useMemo(() => parseStanzas(lyrics), [lyrics]);

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
