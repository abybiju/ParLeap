/**
 * Bible Ingestion Script
 *
 * Ingests a Bible JSON file into Supabase tables:
 * - bible_versions
 * - bible_books
 * - bible_verses
 *
 * Expected JSON format (array of verses):
 * [
 *   { "book": "Genesis", "chapter": 1, "verse": 1, "text": "In the beginning..." },
 *   ...
 * ]
 *
 * Usage:
 *   ts-node backend/scripts/ingest-bible.ts --file backend/bible_input/kjv.json --version "King James Version" --abbrev KJV
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type VerseInput = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

type SourceBook = {
  name: string;
  abbrev: string;
  chapters: string[][];
};

const BOOKS: Array<{ name: string; abbrev: string; order: number; aliases: string[] }> = [
  { name: 'Genesis', abbrev: 'Gen', order: 1, aliases: ['gen', 'ge', 'gn'] },
  { name: 'Exodus', abbrev: 'Exod', order: 2, aliases: ['exod', 'ex', 'exo'] },
  { name: 'Leviticus', abbrev: 'Lev', order: 3, aliases: ['lev', 'le', 'lv'] },
  { name: 'Numbers', abbrev: 'Num', order: 4, aliases: ['num', 'nu', 'nm', 'nb'] },
  { name: 'Deuteronomy', abbrev: 'Deut', order: 5, aliases: ['deut', 'de', 'dt'] },
  { name: 'Joshua', abbrev: 'Josh', order: 6, aliases: ['josh', 'jos', 'jsh'] },
  { name: 'Judges', abbrev: 'Judg', order: 7, aliases: ['judg', 'jdg', 'jg', 'jdgs'] },
  { name: 'Ruth', abbrev: 'Ruth', order: 8, aliases: ['ruth', 'ru'] },
  { name: '1 Samuel', abbrev: '1Sam', order: 9, aliases: ['1 samuel', '1 sam', '1sa', '1 sm'] },
  { name: '2 Samuel', abbrev: '2Sam', order: 10, aliases: ['2 samuel', '2 sam', '2sa', '2 sm'] },
  { name: '1 Kings', abbrev: '1Kgs', order: 11, aliases: ['1 kings', '1 kgs', '1ki', '1 k'] },
  { name: '2 Kings', abbrev: '2Kgs', order: 12, aliases: ['2 kings', '2 kgs', '2ki', '2 k'] },
  { name: '1 Chronicles', abbrev: '1Chr', order: 13, aliases: ['1 chronicles', '1 chr', '1ch', '1 chron'] },
  { name: '2 Chronicles', abbrev: '2Chr', order: 14, aliases: ['2 chronicles', '2 chr', '2ch', '2 chron'] },
  { name: 'Ezra', abbrev: 'Ezra', order: 15, aliases: ['ezra', 'ezr'] },
  { name: 'Nehemiah', abbrev: 'Neh', order: 16, aliases: ['nehemiah', 'neh', 'ne'] },
  { name: 'Esther', abbrev: 'Esth', order: 17, aliases: ['esther', 'esth', 'es'] },
  { name: 'Job', abbrev: 'Job', order: 18, aliases: ['job', 'jb'] },
  { name: 'Psalms', abbrev: 'Ps', order: 19, aliases: ['psalms', 'psalm', 'ps', 'psa'] },
  { name: 'Proverbs', abbrev: 'Prov', order: 20, aliases: ['proverbs', 'prov', 'pr', 'prv'] },
  { name: 'Ecclesiastes', abbrev: 'Eccl', order: 21, aliases: ['ecclesiastes', 'eccl', 'ecc', 'qohelet'] },
  { name: 'Song of Solomon', abbrev: 'Song', order: 22, aliases: ['song of solomon', 'song', 'songs', 'song of songs', 'canticles'] },
  { name: 'Isaiah', abbrev: 'Isa', order: 23, aliases: ['isaiah', 'isa', 'is'] },
  { name: 'Jeremiah', abbrev: 'Jer', order: 24, aliases: ['jeremiah', 'jer', 'je'] },
  { name: 'Lamentations', abbrev: 'Lam', order: 25, aliases: ['lamentations', 'lam', 'la'] },
  { name: 'Ezekiel', abbrev: 'Ezek', order: 26, aliases: ['ezekiel', 'ezek', 'eze', 'ezk'] },
  { name: 'Daniel', abbrev: 'Dan', order: 27, aliases: ['daniel', 'dan', 'da', 'dn'] },
  { name: 'Hosea', abbrev: 'Hos', order: 28, aliases: ['hosea', 'hos', 'ho'] },
  { name: 'Joel', abbrev: 'Joel', order: 29, aliases: ['joel', 'jl'] },
  { name: 'Amos', abbrev: 'Amos', order: 30, aliases: ['amos', 'am'] },
  { name: 'Obadiah', abbrev: 'Obad', order: 31, aliases: ['obadiah', 'obad', 'ob'] },
  { name: 'Jonah', abbrev: 'Jonah', order: 32, aliases: ['jonah', 'jon'] },
  { name: 'Micah', abbrev: 'Mic', order: 33, aliases: ['micah', 'mic', 'mi'] },
  { name: 'Nahum', abbrev: 'Nah', order: 34, aliases: ['nahum', 'nah', 'na'] },
  { name: 'Habakkuk', abbrev: 'Hab', order: 35, aliases: ['habakkuk', 'hab', 'hb'] },
  { name: 'Zephaniah', abbrev: 'Zeph', order: 36, aliases: ['zephaniah', 'zeph', 'zep', 'zp'] },
  { name: 'Haggai', abbrev: 'Hag', order: 37, aliases: ['haggai', 'hag', 'hg'] },
  { name: 'Zechariah', abbrev: 'Zech', order: 38, aliases: ['zechariah', 'zech', 'zec', 'zc'] },
  { name: 'Malachi', abbrev: 'Mal', order: 39, aliases: ['malachi', 'mal', 'ml'] },
  { name: 'Matthew', abbrev: 'Matt', order: 40, aliases: ['matthew', 'matt', 'mt'] },
  { name: 'Mark', abbrev: 'Mark', order: 41, aliases: ['mark', 'mrk', 'mk', 'mr'] },
  { name: 'Luke', abbrev: 'Luke', order: 42, aliases: ['luke', 'luk', 'lk'] },
  { name: 'John', abbrev: 'John', order: 43, aliases: ['john', 'jhn', 'jn', 'joh'] },
  { name: 'Acts', abbrev: 'Acts', order: 44, aliases: ['acts', 'ac'] },
  { name: 'Romans', abbrev: 'Rom', order: 45, aliases: ['romans', 'rom', 'ro', 'rm'] },
  { name: '1 Corinthians', abbrev: '1Cor', order: 46, aliases: ['1 corinthians', '1 cor', '1co'] },
  { name: '2 Corinthians', abbrev: '2Cor', order: 47, aliases: ['2 corinthians', '2 cor', '2co'] },
  { name: 'Galatians', abbrev: 'Gal', order: 48, aliases: ['galatians', 'gal', 'ga'] },
  { name: 'Ephesians', abbrev: 'Eph', order: 49, aliases: ['ephesians', 'eph', 'ep'] },
  { name: 'Philippians', abbrev: 'Phil', order: 50, aliases: ['philippians', 'phil', 'php', 'ph'] },
  { name: 'Colossians', abbrev: 'Col', order: 51, aliases: ['colossians', 'col', 'co'] },
  { name: '1 Thessalonians', abbrev: '1Thess', order: 52, aliases: ['1 thessalonians', '1 thess', '1th'] },
  { name: '2 Thessalonians', abbrev: '2Thess', order: 53, aliases: ['2 thessalonians', '2 thess', '2th'] },
  { name: '1 Timothy', abbrev: '1Tim', order: 54, aliases: ['1 timothy', '1 tim', '1ti'] },
  { name: '2 Timothy', abbrev: '2Tim', order: 55, aliases: ['2 timothy', '2 tim', '2ti'] },
  { name: 'Titus', abbrev: 'Titus', order: 56, aliases: ['titus', 'tit', 'ti'] },
  { name: 'Philemon', abbrev: 'Phlm', order: 57, aliases: ['philemon', 'phlm', 'phm', 'pm'] },
  { name: 'Hebrews', abbrev: 'Heb', order: 58, aliases: ['hebrews', 'heb', 'he'] },
  { name: 'James', abbrev: 'Jas', order: 59, aliases: ['james', 'jas', 'jm'] },
  { name: '1 Peter', abbrev: '1Pet', order: 60, aliases: ['1 peter', '1 pet', '1pe'] },
  { name: '2 Peter', abbrev: '2Pet', order: 61, aliases: ['2 peter', '2 pet', '2pe'] },
  { name: '1 John', abbrev: '1John', order: 62, aliases: ['1 john', '1 jn', '1jo'] },
  { name: '2 John', abbrev: '2John', order: 63, aliases: ['2 john', '2 jn', '2jo'] },
  { name: '3 John', abbrev: '3John', order: 64, aliases: ['3 john', '3 jn', '3jo'] },
  { name: 'Jude', abbrev: 'Jude', order: 65, aliases: ['jude', 'jud'] },
  { name: 'Revelation', abbrev: 'Rev', order: 66, aliases: ['revelation', 'rev', 're'] },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeBookName(book: string): string {
  return normalizeText(book);
}

function resolveBook(bookRaw: string): { name: string; abbrev: string; order: number } | null {
  const normalized = normalizeBookName(bookRaw);
  for (const book of BOOKS) {
    if (normalizeBookName(book.name) === normalized) return book;
    if (book.aliases.includes(normalized)) return book;
  }
  return null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function flattenBibleData(sourceData: SourceBook[]): VerseInput[] {
  const flatVerses: VerseInput[] = [];

  sourceData.forEach((book) => {
    book.chapters.forEach((chapterVerses, chapterIndex) => {
      const chapterNum = chapterIndex + 1;
      chapterVerses.forEach((verseText, verseIndex) => {
        const verseNum = verseIndex + 1;
        flatVerses.push({
          book: book.name,
          chapter: chapterNum,
          verse: verseNum,
          text: verseText,
        });
      });
    });
  });

  return flatVerses;
}

function stripBom(input: string) {
  return input.replace(/\uFEFF/g, '');
}

function fetchJsonFromUrl(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`Request failed: ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = stripBom(Buffer.concat(chunks).toString('utf-8'));
            const json = JSON.parse(raw);
            resolve(json);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const getArg = (name: string, fallback?: string) => {
    const idx = args.findIndex((a) => a === name);
    if (idx === -1) return fallback;
    return args[idx + 1];
  };
  const fileFallback = path.join(__dirname, '../bible_input/en_kjv.json');
  return {
    file: getArg('--file', fileFallback) || fileFallback,
    url: getArg('--url'),
    version: getArg('--version', 'King James Version'),
    abbrev: getArg('--abbrev', 'KJV'),
    language: getArg('--language', 'en'),
    replace: getArg('--replace', 'true') !== 'false',
  };
}

async function main() {
  const { file, url, version, abbrev, language, replace } = parseArgs();
  let sourceData: unknown;

  if (url) {
    console.log(`🌐 Fetching source JSON from: ${url}`);
    sourceData = await fetchJsonFromUrl(url);
  } else {
    if (!fs.existsSync(file)) {
      console.error(`❌ Input file not found: ${file}`);
      console.error('Expected JSON array of { book, chapter, verse, text }');
      process.exit(1);
    }
    const raw = stripBom(fs.readFileSync(file, 'utf-8'));
    sourceData = JSON.parse(raw);
  }

  if (!Array.isArray(sourceData) || sourceData.length === 0) {
    console.error('❌ Input must be a non-empty array');
    process.exit(1);
  }

  const isFlat = sourceData.length > 0 && typeof (sourceData as VerseInput[])[0]?.chapter === 'number';
  const verses: VerseInput[] = isFlat
    ? (sourceData as VerseInput[])
    : flattenBibleData(sourceData as SourceBook[]);

  console.log(`📖 Ingesting ${verses.length} verses for ${abbrev}...`);

  const { data: versionRow, error: versionError } = await supabase
    .from('bible_versions')
    .upsert({ name: version, abbrev, language }, { onConflict: 'abbrev' })
    .select()
    .single();

  if (versionError || !versionRow) {
    console.error('❌ Failed to upsert bible_versions:', versionError);
    process.exit(1);
  }

  const versionId = versionRow.id as string;

  if (replace) {
    console.log('🧹 Clearing existing verses for version...');
    const { error: deleteError } = await supabase
      .from('bible_verses')
      .delete()
      .eq('version_id', versionId);
    if (deleteError) {
      console.error('❌ Failed to clear verses:', deleteError);
      process.exit(1);
    }
  }

  const uniqueBooks = new Map<string, { name: string; abbrev: string; order: number }>();
  for (const verse of verses) {
    const book = resolveBook(verse.book);
    if (!book) {
      console.error(`❌ Unknown book name: "${verse.book}"`);
      process.exit(1);
    }
    uniqueBooks.set(book.name, book);
  }

  const booksPayload = Array.from(uniqueBooks.values()).map((book) => ({
    name: book.name,
    abbrev: book.abbrev,
    book_order: book.order,
  }));

  const { error: booksError } = await supabase
    .from('bible_books')
    .upsert(booksPayload, { onConflict: 'name' });

  if (booksError) {
    console.error('❌ Failed to upsert bible_books:', booksError);
    process.exit(1);
  }

  const { data: booksData, error: booksFetchError } = await supabase
    .from('bible_books')
    .select('id, name, abbrev, book_order');

  if (booksFetchError || !booksData) {
    console.error('❌ Failed to fetch bible_books:', booksFetchError);
    process.exit(1);
  }

  const bookIdByName = new Map<string, string>();
  for (const book of booksData) {
    bookIdByName.set(book.name, book.id as string);
  }

  const verseRows = verses.map((verse) => {
    const book = resolveBook(verse.book);
    if (!book) {
      throw new Error(`Unknown book name: ${verse.book}`);
    }
    const bookId = bookIdByName.get(book.name);
    if (!bookId) {
      throw new Error(`Book ID not found for: ${book.name}`);
    }
    return {
      version_id: versionId,
      book_id: bookId,
      chapter: verse.chapter,
      verse: verse.verse,
      text: verse.text,
      search_text: normalizeText(verse.text),
    };
  });

  const batches = chunk(verseRows, 1000);
  let inserted = 0;

  for (const batch of batches) {
    const { error } = await supabase.from('bible_verses').insert(batch);
    if (error) {
      console.error('❌ Failed to insert verses:', error);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`✅ Inserted ${inserted}/${verseRows.length} verses`);
  }

  console.log('✨ Bible ingestion complete.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Bible ingestion failed:', error);
    process.exit(1);
  });
}
