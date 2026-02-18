/**
 * Format Song Service (Smart Paste / Auto-Format)
 *
 * Uses OpenAI gpt-4o-mini with structured JSON output to extract and clean
 * lyrics from a raw paste (chords, messy breaks, various site formats).
 * No site-specific parsers — one LLM as "universal translator."
 */

import OpenAI from 'openai';

const FORMAT_SONG_SYSTEM_PROMPT = `You are a professional worship presentation formatter.

TASK:
1. Extract lyrics from the user's text; remove chords and metadata.
2. METADATA RULES:
   - Look for explicit cues: lines starting with "By", "Written by", "Artist:", or copyright info (e.g. ©).
   - CRITICAL: If the artist is NOT explicitly mentioned in the text, return null. Do not guess from lyrics or style (e.g. do not assume "Hillsong" because it sounds like them).
   - If a CCLI number appears, you may use it to infer the standard title only when obvious; still return null for artist if unsure.
   - Fill the title when it appears in a header or byline; fill the artist only when it appears in one of the explicit cues above.
3. Structure into sections (Verse 1, Verse 2, Chorus, Bridge, etc.). If labels are missing, infer from context.
4. Format lines with proper capitalization.

PAGINATION RULES (CRITICAL):
- Target: 4 lines per slide.
- Max: 6 lines per slide.
- If a section exceeds 6 lines: split it into two BALANCED slides (e.g. 8 lines → 4+4, not 6+2; 7 lines → 4+3; 6 lines → 3+3).
- Orphan rule: NEVER leave a single line on a slide by itself (unless the whole section is 1 line).
- Musical flow: Split at the end of a sentence or phrase. Keep rhyming couplets together when possible.
- When splitting a section, use the same label for each part (e.g. "Bridge" for both parts).

Output strict JSON.`;

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
