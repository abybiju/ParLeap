/**
 * Smart Bible Listen wake detection should be strict:
 * - Avoid triggering on random noise words.
 * - Trigger only for explicit scripture-style phrasing.
 */

const BIBLE_BOOK_ALIASES: string[] = [
  // Pentateuch
  'genesis', 'gen',
  'exodus', 'exod',
  'leviticus', 'lev',
  'numbers', 'num',
  'deuteronomy', 'deut',
  // Historical
  'joshua', 'josh',
  'judges', 'judg',
  'ruth',
  'samuel', 'kings', 'chronicles',
  'ezra', 'nehemiah', 'neh',
  'esther',
  // Wisdom/Poetry
  'job',
  'psalms', 'psalm', 'ps',
  'proverbs', 'prov',
  'ecclesiastes', 'eccl',
  'song of solomon', 'song of songs',
  // Prophets
  'isaiah', 'isa',
  'jeremiah', 'jer',
  'lamentations', 'lam',
  'ezekiel', 'ezek',
  'daniel', 'dan',
  'hosea', 'hos',
  'joel',
  'amos',
  'obadiah',
  'jonah',
  'micah', 'mic',
  'nahum', 'nah',
  'habakkuk', 'hab',
  'zephaniah', 'zeph',
  'haggai', 'hag',
  'zechariah', 'zech',
  'malachi', 'mal',
  // New Testament
  'matthew', 'matt',
  'mark',
  'luke',
  'john',
  'acts',
  'romans', 'rom',
  'corinthians', 'cor',
  'galatians', 'gal',
  'ephesians', 'eph',
  'philippians', 'phil',
  'colossians', 'col',
  'thessalonians', 'thess',
  'timothy', 'tim',
  'titus',
  'philemon', 'phlm',
  'hebrews', 'heb',
  'james', 'jas',
  'peter', 'pet',
  'jude',
  'revelation', 'rev',
];

const SCRIPTURE_CUES = [
  'it is written',
  'as it is written',
  'the bible says',
  'scripture says',
  'the word says',
  'book of',
  'gospel of',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildBookPattern(): string {
  const unique = Array.from(new Set(BIBLE_BOOK_ALIASES))
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  return `(?:${unique.join('|')})`;
}

const BOOK_PATTERN = buildBookPattern();
const RANGE_PART = '(?:\\s*(?:-|to|through)\\s*\\d{1,3})?';
const BOOK_REF_PATTERNS: RegExp[] = [
  // Luke 2:13 / Romans 4:5-15
  new RegExp(`\\b${BOOK_PATTERN}\\s+\\d{1,3}\\s*:\\s*\\d{1,3}${RANGE_PART}\\b`, 'i'),
  // Luke chapter 2 verse 13 / Luke ch 2 v 13
  new RegExp(
    `\\b${BOOK_PATTERN}\\s+(?:chapter|chap|ch)\\s*\\d{1,3}\\s*(?::|,)?\\s*(?:verse|verses|v)\\s*\\d{1,3}${RANGE_PART}\\b`,
    'i'
  ),
  // Luke 2 verse 13
  new RegExp(`\\b${BOOK_PATTERN}\\s+\\d{1,3}\\s+(?:verse|verses|v)\\s*\\d{1,3}${RANGE_PART}\\b`, 'i'),
  // In the book of Luke chapter 2...
  new RegExp(`\\b(?:book|gospel)\\s+of\\s+${BOOK_PATTERN}\\b`, 'i'),
];

const CHAPTER_VERSE_PATTERN = /\b(?:chapter|chap|ch)\s*\d{1,3}\s*(?::|,)?\s*(?:verse|verses|v)\s*\d{1,3}(?:\s*(?:-|to|through)\s*\d{1,3})?\b/i;
const SHORT_CHAPTER_VERSE_PATTERN = /\b\d{1,3}\s*:\s*\d{1,3}(?:\s*(?:-|to|through)\s*\d{1,3})?\b/;

function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9:\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true only when transcript contains explicit scripture phrasing.
 * This intentionally ignores single keywords like "verse" to avoid false wakeups.
 */
export function shouldWakeForBibleTranscript(text: string): boolean {
  const normalized = normalizeTranscript(text);
  if (!normalized) return false;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;

  const hasBookRef = BOOK_REF_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasBookRef) {
    return true;
  }

  const hasBook = new RegExp(`\\b${BOOK_PATTERN}\\b`, 'i').test(normalized);
  const hasChapterVerse = CHAPTER_VERSE_PATTERN.test(normalized);
  if (hasBook && hasChapterVerse) {
    return true;
  }

  // "it is written ... Luke 2:13" style phrasing
  const hasScriptureCue = SCRIPTURE_CUES.some((cue) => normalized.includes(cue));
  if (hasScriptureCue && hasBook && SHORT_CHAPTER_VERSE_PATTERN.test(normalized)) {
    return true;
  }

  return false;
}
