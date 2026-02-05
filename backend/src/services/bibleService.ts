import { supabase, isSupabaseConfigured } from '../config/supabase';
import { BIBLE_BOOKS } from '../data/bibleBooks';

export type BibleReference = {
  book: string;
  chapter: number;
  verse: number;
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
};

type VersionCache = {
  byId: Map<string, { id: string; abbrev: string }>;
};

let bookCache: BookCache | null = null;
let versionCache: VersionCache | null = null;

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
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9:\s]/g, ' ')
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

    let refMatch = after.match(/^chapter\s+(\d{1,3})\s+verse\s+(\d{1,3})/);
    if (refMatch) {
      chapter = Number(refMatch[1]);
      verse = Number(refMatch[2]);
    } else {
      refMatch = after.match(/^(\d{1,3})\s*[:]\s*(\d{1,3})/);
      if (refMatch) {
        chapter = Number(refMatch[1]);
        verse = Number(refMatch[2]);
      } else {
        refMatch = after.match(/^(\d{1,3})\s+verse\s+(\d{1,3})/);
        if (refMatch) {
          chapter = Number(refMatch[1]);
          verse = Number(refMatch[2]);
        } else {
          refMatch = after.match(/^(\d{1,3})\s+(\d{1,3})/);
          if (refMatch) {
            chapter = Number(refMatch[1]);
            verse = Number(refMatch[2]);
          }
        }
      }
    }

    if (!chapter || !verse) continue;

    const bookName = aliasToBookName.get(alias);
    if (!bookName) continue;

    return { book: bookName, chapter, verse };
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
  for (const row of data) {
    byName.set(row.name.toLowerCase(), { id: row.id as string, name: row.name as string });
  }

  bookCache = { byName };
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

  const versions = await ensureVersionCache();
  const abbrev = versions?.byId.get(versionId)?.abbrev ?? 'Bible';

  return {
    book: bookEntry.name,
    chapter: reference.chapter,
    verse: reference.verse,
    text: data.text as string,
    versionAbbrev: abbrev,
  };
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
