import { compareTwoStrings } from 'string-similarity';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { BIBLE_BOOKS } from '../data/bibleBooks';

export type BibleReference = {
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number | null;
};

export type BibleVerseResult = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  versionAbbrev: string;
};

type BookCache = {
  byName: Map<string, { id: string; name: string }>;
  byId: Map<string, { id: string; name: string }>;
};

type VersionCache = {
  byId: Map<string, { id: string; abbrev: string }>;
};

let bookCache: BookCache | null = null;
let versionCache: VersionCache | null = null;
let defaultVersionId: string | null = null;
const esvApiKey = process.env.ESV_API_KEY || '';
const esvApiUrl = process.env.ESV_API_URL || '';

const aliasToBookName = new Map<string, string>();
const aliasList: string[] = [];

for (const book of BIBLE_BOOKS) {
  const canonical = book.name.toLowerCase();
  const aliases = new Set<string>([canonical, book.abbrev.toLowerCase(), ...book.aliases.map((a) => a.toLowerCase())]);
  for (const alias of aliases) {
    aliasToBookName.set(alias, book.name);
  }
}

aliasList.push(...aliasToBookName.keys());
aliasList.sort((a, b) => b.length - a.length);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReferenceText(input: string) {
  return input
    .toLowerCase()
    .replace(/\b(first|1st)\b/g, '1')
    .replace(/\b(second|2nd)\b/g, '2')
    .replace(/\b(third|3rd)\b/g, '3')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9:\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findBibleReference(input: string): BibleReference | null {
  const normalized = normalizeReferenceText(input);
  if (!normalized) return null;

  for (const alias of aliasList) {
    const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`);
    const match = normalized.match(pattern);
    if (!match || match.index === undefined) continue;

    const after = normalized.slice(match.index + match[0].length).trim();

    let chapter: number | null = null;
    let verse: number | null = null;
    let endVerse: number | null = null;

    const patterns = [
      // chapter 2 verse 1 / chapter 2: verse 1 / ch 2 v 1
      /^(?:chapter|chap|ch)\s+(\d{1,3})\s*[:-]?\s*(?:verse|verses|v)\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      // chapter 2:1
      /^(?:chapter|chap|ch)\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      // 2:1
      /^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      // 2 verse 1 / 2 verses 1-3
      /^(\d{1,3})\s+(?:verse|verses|v)\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      // chapter 2 1
      /^(?:chapter|chap|ch)\s+(\d{1,3})\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      // 2 1
      /^(\d{1,3})\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
    ];

    for (const pattern of patterns) {
      const refMatch = after.match(pattern);
      if (!refMatch) continue;
      chapter = Number(refMatch[1]);
      verse = Number(refMatch[2]);
      endVerse = refMatch[3] ? Number(refMatch[3]) : null;
      break;
    }

    // Chapter-only: "Luke 1", "Luke chapter 1", "Romans 5" → verse 1
    if (!chapter || !verse) {
      const chapterOnly1 = /^(?:chapter|chap|ch)\s+(\d{1,3})\s*$/.exec(after);
      const chapterOnly2 = /^(\d{1,3})\s*$/.exec(after);
      if (chapterOnly1) {
        chapter = Number(chapterOnly1[1]);
        verse = 1;
      } else if (chapterOnly2) {
        chapter = Number(chapterOnly2[1]);
        verse = 1;
      }
    }

    if (!chapter || !verse) continue;
    if (endVerse !== null && endVerse < verse) {
      endVerse = null;
    }

    const bookName = aliasToBookName.get(alias);
    if (!bookName) continue;

    return { book: bookName, chapter, verse, endVerse };
  }

  // Fuzzy book match: no alias matched (e.g. STT said "roman" for Romans)
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const bookToken =
    tokens.length >= 2 && /^\d+$/.test(tokens[0]) ? `${tokens[0]} ${tokens[1]}` : tokens[0];
  const afterFuzzy = normalized.slice(normalized.indexOf(bookToken) + bookToken.length).trim();

  let bestBook: (typeof BIBLE_BOOKS)[number] | null = null;
  let bestScore = 0;
  const bookTokenLower = bookToken.toLowerCase();
  for (const book of BIBLE_BOOKS) {
    const candidates = [
      book.name.toLowerCase(),
      book.abbrev.toLowerCase(),
      ...book.aliases.map((a) => a.toLowerCase()),
    ];
    const score = Math.max(...candidates.map((c) => compareTwoStrings(bookTokenLower, c)));
    if (score > bestScore) {
      bestScore = score;
      bestBook = book;
    }
  }
  const FUZZY_BOOK_THRESHOLD = 0.82;
  if (bestBook && bestScore >= FUZZY_BOOK_THRESHOLD) {
    let chapter: number | null = null;
    let verse: number | null = null;
    let endVerse: number | null = null;
    const patterns = [
      /^(?:chapter|chap|ch)\s+(\d{1,3})\s*[:-]?\s*(?:verse|verses|v)\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      /^(?:chapter|chap|ch)\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      /^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      /^(\d{1,3})\s+(?:verse|verses|v)\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      /^(?:chapter|chap|ch)\s+(\d{1,3})\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
      /^(\d{1,3})\s+(\d{1,3})(?:\s*(?:-|to|through)\s*(\d{1,3}))?/,
    ];
    for (const pattern of patterns) {
      const refMatch = afterFuzzy.match(pattern);
      if (!refMatch) continue;
      chapter = Number(refMatch[1]);
      verse = Number(refMatch[2]);
      endVerse = refMatch[3] ? Number(refMatch[3]) : null;
      break;
    }
    if (!chapter || !verse) {
      const ch1 = /^(?:chapter|chap|ch)\s+(\d{1,3})\s*$/.exec(afterFuzzy);
      const ch2 = /^(\d{1,3})\s*$/.exec(afterFuzzy);
      if (ch1) {
        chapter = Number(ch1[1]);
        verse = 1;
      } else if (ch2) {
        chapter = Number(ch2[1]);
        verse = 1;
      }
    }
    if (chapter && verse) {
      if (endVerse !== null && endVerse < verse) endVerse = null;
      return { book: bestBook.name, chapter, verse, endVerse };
    }
  }

  return null;
}

export function detectBibleVersionCommand(input: string): 'ESV' | 'KJV' | null {
  const normalized = normalizeReferenceText(input);
  if (!normalized) return null;

  if (/(?:\besv\b|english standard version|reading from the esv|in the esv)/i.test(normalized)) {
    return 'ESV';
  }
  if (/(?:\bkjv\b|king james version|back to kjv|in the king james)/i.test(normalized)) {
    return 'KJV';
  }
  return null;
}

async function ensureBookCache(): Promise<BookCache | null> {
  if (bookCache) return bookCache;
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('bible_books')
    .select('id, name');

  if (error || !data) {
    console.warn('[BibleService] Failed to load bible_books cache:', error);
    return null;
  }

  const byName = new Map<string, { id: string; name: string }>();
  const byId = new Map<string, { id: string; name: string }>();
  for (const row of data) {
    const entry = { id: row.id as string, name: row.name as string };
    byName.set(row.name.toLowerCase(), entry);
    byId.set(row.id as string, entry);
  }

  bookCache = { byName, byId };
  return bookCache;
}

async function ensureVersionCache(): Promise<VersionCache | null> {
  if (versionCache) return versionCache;
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('bible_versions')
    .select('id, abbrev');

  if (error || !data) {
    console.warn('[BibleService] Failed to load bible_versions cache:', error);
    return null;
  }

  const byId = new Map<string, { id: string; abbrev: string }>();
  for (const row of data) {
    byId.set(row.id as string, { id: row.id as string, abbrev: row.abbrev as string });
  }

  versionCache = { byId };
  return versionCache;
}

export async function fetchBibleVerse(
  reference: BibleReference,
  versionId?: string | null
): Promise<BibleVerseResult | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  if (!versionId) return null;

  const books = await ensureBookCache();
  if (!books) return null;

  const bookEntry = books.byName.get(reference.book.toLowerCase());
  if (!bookEntry) {
    console.warn(`[BibleService] Book not found in cache: ${reference.book}`);
    return null;
  }

  const versions = await ensureVersionCache();
  const versionAbbrev = versions?.byId.get(versionId)?.abbrev?.toUpperCase() ?? 'BIBLE';

  if (versionAbbrev === 'ESV') {
    const esvText = await fetchEsvPassage(reference);
    if (!esvText) return null;
    return {
      book: bookEntry.name,
      chapter: reference.chapter,
      verse: reference.verse,
      text: esvText,
      versionAbbrev,
    };
  }

  const { data, error } = await supabase
    .from('bible_verses')
    .select('text')
    .eq('version_id', versionId)
    .eq('book_id', bookEntry.id)
    .eq('chapter', reference.chapter)
    .eq('verse', reference.verse)
    .limit(1)
    .single();

  if (error || !data) {
    console.warn('[BibleService] Verse lookup failed:', error);
    return null;
  }

  const abbrev = versions?.byId.get(versionId)?.abbrev ?? 'Bible';

  return {
    book: bookEntry.name,
    chapter: reference.chapter,
    verse: reference.verse,
    text: data.text as string,
    versionAbbrev: abbrev,
  };
}

export async function getDefaultBibleVersionId(): Promise<string | null> {
  if (defaultVersionId) return defaultVersionId;
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('bible_versions')
    .select('id')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    console.warn('[BibleService] Failed to resolve default bible version:', error);
    return null;
  }

  defaultVersionId = data.id as string;
  return defaultVersionId;
}

export async function getBibleVersionIdByAbbrev(abbrev: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const versions = await ensureVersionCache();
  if (!versions) return null;
  const match = Array.from(versions.byId.values()).find(
    (entry) => entry.abbrev.toLowerCase() === abbrev.toLowerCase()
  );
  return match?.id ?? null;
}

function extractEsvText(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (typeof payload === 'object') {
    const data = payload as { passages?: string[]; passage?: string; text?: string };
    if (Array.isArray(data.passages) && data.passages.length > 0) {
      return data.passages.join(' ').trim();
    }
    if (typeof data.passage === 'string') {
      return data.passage.trim();
    }
    if (typeof data.text === 'string') {
      return data.text.trim();
    }
  }
  return null;
}

async function fetchEsvPassage(reference: BibleReference): Promise<string | null> {
  if (!esvApiKey || !esvApiUrl) {
    console.warn('[BibleService] ESV API not configured. Set ESV_API_KEY and ESV_API_URL.');
    return null;
  }

  const ref = `${reference.book} ${reference.chapter}:${reference.verse}`;
  const url = new URL(esvApiUrl);
  url.searchParams.set('q', ref);
  url.searchParams.set('include-headings', 'false');
  url.searchParams.set('include-verse-numbers', 'false');
  url.searchParams.set('include-footnotes', 'false');
  url.searchParams.set('include-passage-references', 'false');
  url.searchParams.set('include-short-copyright', 'false');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${esvApiKey}`,
    },
  });

  if (!response.ok) {
    console.warn('[BibleService] ESV API error:', response.status, response.statusText);
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as unknown;
    return extractEsvText(data);
  }

  const text = await response.text();
  return extractEsvText(text);
}

export function wrapBibleText(text: string, maxLineLength = 48, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const trimmed = lines.slice(0, maxLines - 1);
  trimmed.push(lines.slice(maxLines - 1).join(' '));
  return trimmed;
}

/** Result row for verse-by-content candidate search (book name, chapter, verse, text). */
export type VerseCandidateRow = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

/**
 * Search bible_verses by keywords (search_text ilike any word), return up to `limit` candidates
 * with book name, chapter, verse, text for use in semantic rerank (findVerseByContent).
 * Used for full-Bible verse-by-content lookup when no reference is detected.
 */
export async function searchVerseCandidatesByWords(
  versionId: string,
  words: string[],
  limit: number = 80
): Promise<VerseCandidateRow[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  if (!words.length) return [];

  const books = await ensureBookCache();
  if (!books) return [];

  const cleanWords = words
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 2);
  if (!cleanWords.length) return [];

  const orConditions = cleanWords
    .slice(0, 10)
    .map((w) => `search_text.ilike.%${w}%`)
    .join(',');
  if (!orConditions) return [];

  const { data: rows, error } = await supabase
    .from('bible_verses')
    .select('book_id, chapter, verse, text')
    .eq('version_id', versionId)
    .or(orConditions)
    .limit(limit);

  if (error || !rows?.length) {
    if (error) console.warn('[BibleService] searchVerseCandidatesByWords error:', error.message);
    return [];
  }

  const result: VerseCandidateRow[] = [];
  for (const row of rows) {
    const bookEntry = books.byId.get(row.book_id as string);
    const book = bookEntry?.name ?? 'Unknown';
    result.push({
      book,
      chapter: row.chapter as number,
      verse: row.verse as number,
      text: (row.text as string) ?? '',
    });
  }
  return result;
}
