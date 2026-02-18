/**
 * Format Song Service (Smart Paste / Auto-Format)
 *
 * Uses OpenAI gpt-4o-mini with structured JSON output to extract and clean
 * lyrics from a raw paste (chords, messy breaks, various site formats).
 * No site-specific parsers — one LLM as "universal translator."
 */

import OpenAI from 'openai';

const FORMAT_SONG_SYSTEM_PROMPT = `You are a lyrics formatting engine for a church presentation software.

Extract the lyrics from the user's input.

Remove all chords, musical notation, and 'x2' repeat markers.

Structure the song into logical sections (Verse, Chorus, Bridge). If labels are missing, infer them based on context.

Format lines with proper capitalization.

Return null for Title/Artist if they are not explicitly present in the text.`;

export interface FormatSongSection {
  label: string;
  lines: string[];
}

export interface FormatSongResult {
  title: string | null;
  artist: string | null;
  sections: FormatSongSection[];
}

const MAX_RAW_LENGTH = 50_000;

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

export function isFormatSongEnabled(): boolean {
  return !!getApiKey();
}

/**
 * Serialize structured sections to a single lyrics string (label + lines per section).
 */
export function serializeSectionsToLyrics(sections: FormatSongSection[]): string {
  return sections
    .map((s) => [s.label, ...s.lines].join('\n'))
    .join('\n\n');
}

/**
 * Call OpenAI to extract and structure song from raw pasted text.
 * Returns structured result or null if disabled/failed.
 */
export async function formatSong(rawText: string): Promise<FormatSongResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[FormatSong] OPENAI_API_KEY not set');
    return null;
  }

  const trimmed = rawText.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_RAW_LENGTH) {
    console.warn('[FormatSong] rawText exceeds max length:', trimmed.length);
    return null;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: FORMAT_SONG_SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'song_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              artist: { type: 'string' },
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    lines: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['label', 'lines'],
                  additionalProperties: false,
                },
              },
            },
            required: ['title', 'artist', 'sections'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[FormatSong] Empty completion');
      return null;
    }

    const parsed = JSON.parse(content) as FormatSongResult;
    if (!parsed || !Array.isArray(parsed.sections)) {
      console.error('[FormatSong] Invalid schema:', parsed);
      return null;
    }

    return {
      title: parsed.title && String(parsed.title).trim() ? String(parsed.title).trim() : null,
      artist: parsed.artist && String(parsed.artist).trim() ? String(parsed.artist).trim() : null,
      sections: parsed.sections.map((s) => ({
        label: String(s?.label ?? 'Verse'),
        lines: Array.isArray(s?.lines) ? s.lines.map((l) => String(l)) : [],
      })),
    };
  } catch (err) {
    console.error('[FormatSong] OpenAI error:', err);
    throw err;
  }
}
