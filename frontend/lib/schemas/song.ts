import { z } from 'zod';

export const songSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  artist: z.string().max(200).optional().or(z.literal('')),
  ccli_number: z.string().max(50).optional().or(z.literal('')),
  lyrics: z.string().min(1, 'Lyrics are required'),
});

export type SongFormData = z.infer<typeof songSchema>;

/**
 * Parse lyrics into stanzas (groups of lines separated by blank lines)
 */
export function parseStanzas(lyrics: string): string[][] {
  if (!lyrics.trim()) return [];
  
  // Split on double newlines (blank lines between stanzas)
  const stanzas = lyrics.split(/\n\s*\n/).filter(Boolean);
  
  // Each stanza split into lines
  return stanzas.map(stanza => 
    stanza.split('\n').map(line => line.trim()).filter(Boolean)
  );
}

/**
 * Count total lines in lyrics
 */
export function countLines(lyrics: string): number {
  return parseStanzas(lyrics).reduce((acc, stanza) => acc + stanza.length, 0);
}
