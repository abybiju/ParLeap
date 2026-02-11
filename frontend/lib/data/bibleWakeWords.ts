/**
 * Keywords and phrases used for Smart Bible Listen wake-word detection.
 * Matched against live transcript (e.g. from Web Speech API) to open STT window.
 * Kept minimal; overlaps with backend BIBLE_BOOKS for consistency.
 */

export const BIBLE_WAKE_WORDS: string[] = [
  // Common book names and abbreviations (subset for reliable matching)
  'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy',
  'joshua', 'judges', 'ruth', 'samuel', 'kings', 'chronicles',
  'ezra', 'nehemiah', 'esther', 'job', 'psalms', 'psalm',
  'proverbs', 'ecclesiastes', 'song of solomon', 'isaiah', 'jeremiah',
  'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos',
  'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah',
  'haggai', 'zechariah', 'malachi',
  'matthew', 'matt', 'mark', 'luke', 'john', 'acts', 'romans',
  'corinthians', 'galatians', 'ephesians', 'philippians', 'phil',
  'colossians', 'thessalonians', 'timothy', 'titus', 'philemon',
  'hebrews', 'james', 'peter', 'jude', 'revelation', 'rev',
  // Abbreviations
  'gen', 'exod', 'lev', 'num', 'deut', 'josh', 'judg', 'neh',
  'ps', 'prov', 'eccl', 'isa', 'jer', 'lam', 'ezek', 'dan',
  'hos', 'joel', 'mic', 'nah', 'hab', 'zeph', 'hag', 'zech', 'mal',
  'mt', 'mk', 'lk', 'jhn', 'rom', 'cor', 'gal', 'eph', 'col',
  'thess', 'tim', 'phlm', 'heb', 'jas', 'pet', 'jn',
  // Wake phrases
  'verse', 'verses', 'chapter', 'chap', 'scripture', 'bible',
  'it is written', 'scripture says', 'the bible says', 'as written in',
  'according to scripture', 'the word says',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a regex that matches any wake word as a whole word (case-insensitive). */
export function getWakeWordPattern(): RegExp {
  const alternation = BIBLE_WAKE_WORDS.map((w) => escapeRegex(w)).join('|');
  return new RegExp(`\\b(?:${alternation})\\b`, 'gi');
}
