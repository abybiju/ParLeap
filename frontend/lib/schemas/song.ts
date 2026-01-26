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
 * 
 * Handles:
 * - Double newlines (\n\n) as stanza separators (primary)
 * - Windows line endings (\r\n)
 * - Blank lines with only whitespace
 */
export function parseStanzas(lyrics: string): string[][] {
  if (!lyrics.trim()) return [];
  
  // Normalize line endings (handle \r\n from different OS/pastes)
  const normalized = lyrics.replace(/\r\n/g, '\n');
  
  // Split on double newlines or more (blank lines between stanzas)
  // This regex matches: \n followed by any whitespace, followed by \n
  const rawStanzas = normalized.split(/\n\s*\n+/);
  
  // Filter and parse stanzas
  return rawStanzas
    .map(stanza => {
      // Split into individual lines and trim
      const lines = stanza
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0); // Remove empty lines
      
      // Only include stanzas that have content
      return lines.length > 0 ? lines : null;
    })
    .filter((stanza): stanza is string[] => stanza !== null);
}

/**
 * Count total lines in lyrics
 */
export function countLines(lyrics: string): number {
  return parseStanzas(lyrics).reduce((acc, stanza) => acc + stanza.length, 0);
}
