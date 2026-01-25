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
        <p className="text-sm">Type or paste lyrics to see preview</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 overflow-y-auto ${className}`}>
      {stanzas.map((stanza, index) => (
        <div
          key={index}
          className="preview-card p-4 rounded-xl transition-all duration-200 hover:scale-[1.01]"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground font-medium">
              Slide {index + 1}
            </span>
            <Badge variant="secondary" className="text-xs">
              {stanza.length} {stanza.length === 1 ? 'line' : 'lines'}
            </Badge>
          </div>
          <div className="space-y-1">
            {stanza.map((line, lineIndex) => (
              <p 
                key={lineIndex} 
                className="text-foreground text-sm leading-relaxed"
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
