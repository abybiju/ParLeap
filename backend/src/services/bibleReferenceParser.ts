/**
 * Smart Bible Listen — fuzzy spoken-reference parser.
 *
 * Replaces the old digits-only `findBibleReference` (which forced bare book names to
 * chapter 1:1 and ran a corrupting global homophone find-replace). This module:
 *   - normalizes spoken numbers ("nine" -> 9, "three sixteen" -> 3:16) SCOPED to the
 *     post-book chapter:verse zone only (so ordinary prose words stay words);
 *   - coerces separators ("John 10 16" / "10.16" / "10, 16" -> "John 10:16");
 *   - fuzzy-matches the book against the 66-book set via Jaro-Winkler + Damerau-Levenshtein,
 *     gated by a Double Metaphone phonetic check (optional, loaded async);
 *   - validates the final {book, chapter, verse} against authoritative versification using
 *     bible-passage-reference-parser (bcv) — out-of-range and bare-book inputs are rejected.
 *
 * Two thresholds for the "trigger liberally, project conservatively" design:
 *   - shouldTrigger()   — recall-first; opening the (invisible) listen window.
 *   - parseForProject() — precision-first; putting a verse on the big screen.
 *   - findBibleReference() — moderate, validated drop-in for the existing call sites.
 */

import { BIBLE_BOOKS } from '../data/bibleBooks';
import type { BibleReference } from './bibleService';

// ---------------------------------------------------------------------------
// bcv_parser (CommonJS build) — authoritative parse + in-range validation.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { bcv_parser } = require('bible-passage-reference-parser/cjs/en_bcv_parser.js');
const bcv = new bcv_parser();
bcv.set_options({
  book_alone_strategy: 'ignore', // bare "John" -> no match (fixes the 1:1 bug)
  book_sequence_strategy: 'ignore',
  passage_existence_strategy: 'bcv', // reject out-of-range chapters/verses
  invalid_passage_strategy: 'ignore',
  invalid_sequence_strategy: 'ignore',
});

/** True if `refString` (e.g. "Galatians 2:20", "Acts 9", "Mark 14:61-64") is a real, in-range passage. */
function validateInRange(refString: string): boolean {
  try {
    bcv.parse(refString);
    return typeof bcv.osis() === 'string' && bcv.osis().length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Double Metaphone — optional phonetic gate (ESM-only pkg, loaded via async import).
// ---------------------------------------------------------------------------
let doubleMetaphoneFn: ((value: string) => [string, string]) | null = null;
let initPromise: Promise<boolean> | null = null;

/** Load the phonetic encoder and precompute book codes. Idempotent. Safe to skip — parser degrades gracefully. */
export function initBibleReferenceParser(): Promise<boolean> {
  if (doubleMetaphoneFn) return Promise.resolve(true);
  if (!initPromise) {
    initPromise = (async () => {
      try {
        // `new Function` keeps a genuine dynamic import() that TS->CJS will not rewrite to require().
        const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<{ doubleMetaphone: (v: string) => [string, string] }>;
        const mod = await dynamicImport('double-metaphone');
        doubleMetaphoneFn = mod.doubleMetaphone;
        for (const entry of BOOK_INDEX) entry.dm = dmCodes(entry.core);
        return true;
      } catch (err) {
        console.warn('[bibleRefParser] double-metaphone unavailable; phonetic gate disabled:', (err as Error).message);
        return false;
      }
    })();
  }
  return initPromise;
}

function dmCodes(value: string): [string, string] | null {
  if (!doubleMetaphoneFn) return null;
  const collapsed = value.replace(/\s+/g, '');
  if (!collapsed) return null;
  return doubleMetaphoneFn(collapsed);
}

/** Min Levenshtein distance over the {primary,secondary}×{primary,secondary} code cross-product. */
function dmDistance(a: [string, string] | null, b: [string, string] | null): number {
  if (!a || !b) return Infinity;
  let best = Infinity;
  for (const x of a) for (const y of b) best = Math.min(best, levenshtein(x, y));
  return best;
}

// ---------------------------------------------------------------------------
// String-distance primitives (dependency-free, so the hot path stays sync).
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Optimal string alignment (Damerau-Levenshtein with adjacent transpositions). */
function damerau(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const low = Math.max(0, i - matchDistance);
    const high = Math.min(i + matchDistance + 1, len2);
    for (let j = low; j < high; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
}

function jaroWinkler(s1: string, s2: string, p = 0.1): number {
  const j = jaro(s1, s2);
  let prefix = 0;
  const max = Math.min(4, s1.length, s2.length);
  for (let i = 0; i < max; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return j + prefix * p * (1 - j);
}

// ---------------------------------------------------------------------------
// Book index (built once at module load).
// ---------------------------------------------------------------------------
interface BookEntry {
  name: string; // canonical, e.g. "1 Corinthians"
  ordinal: 0 | 1 | 2 | 3; // leading numeral for numbered books
  core: string; // name minus leading numeral and " of " (for phonetics), e.g. "corinthians", "song solomon"
  surfaces: string[]; // lowercased name + abbrev + aliases (full forms)
  isShort: boolean; // common-word book needing an adjacent number
  dm: [string, string] | null;
}

/** Short, common-word books that must have an adjacent number before they count. */
const SHORT_BOOKS = new Set(['Job', 'Acts', 'Mark', 'John', 'Jude', 'Ruth', 'Amos', 'Joel', 'Ezra', 'Luke']);

const ALIAS_MAP = new Map<string, string>(); // exact surface -> canonical name

function coreOf(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\s*[123]\s+/, '')
    .replace(/\bof\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BOOK_INDEX: BookEntry[] = BIBLE_BOOKS.map((book) => {
  const surfaces = Array.from(
    new Set([book.name.toLowerCase(), book.abbrev.toLowerCase(), ...book.aliases.map((a) => a.toLowerCase())])
  );
  for (const s of surfaces) ALIAS_MAP.set(s, book.name);
  const ordinalMatch = /^([123])\s+/.exec(book.name);
  return {
    name: book.name,
    ordinal: (ordinalMatch ? Number(ordinalMatch[1]) : 0) as 0 | 1 | 2 | 3,
    core: coreOf(book.name),
    surfaces,
    isShort: SHORT_BOOKS.has(book.name),
    dm: null,
  };
});

// Kick off phonetic init at load (fire-and-forget); prod is ready before audio flows.
void initBibleReferenceParser();

// ---------------------------------------------------------------------------
// Spoken-number handling.
// ---------------------------------------------------------------------------
const NUMBERED_STEMS = ['corinthians', 'john', 'kings', 'samuel', 'peter', 'thessalonians', 'timothy', 'chronicles'];
const ORDINAL_PREFIX: Record<string, string> = { first: '1', '1st': '1', second: '2', '2nd': '2', third: '3', '3rd': '3' };

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

/** Convert "first/second/third" + numbered-book stem -> "1/2/3 stem" (e.g. "first corinthians" -> "1 corinthians"). */
function normalizeOrdinalBooks(text: string): string {
  return text.replace(/\b(first|second|third|1st|2nd|3rd)\s+(\w+)/g, (m, ord: string, word: string) =>
    NUMBERED_STEMS.includes(word.toLowerCase()) ? `${ORDINAL_PREFIX[ord.toLowerCase()]} ${word}` : m
  );
}

/**
 * Parse the chapter:verse zone that trails the book. Scoped number-word conversion only here.
 * Returns null when no leading number is present (bare book).
 */
function parseNumberZone(text: string): { chapter: number; verse: number | null; endVerse: number | null } | null {
  // Convert number-words to digits, drop chapter markers, map verse markers to ':' and ranges to '-'.
  const tokens = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const raw of tokens) {
    const t = raw.replace(/[.,]+$/g, '');
    if (/^(chapter|chap|ch)$/.test(t)) continue;
    if (/^(verse|verses|vs|v)$/.test(t)) {
      out.push(':');
      continue;
    }
    if (/^(to|through|thru)$/.test(t)) {
      out.push('-');
      continue;
    }
    if (t in NUMBER_WORDS) {
      out.push(String(NUMBER_WORDS[t]));
      continue;
    }
    if (/^\d{1,3}$/.test(t)) {
      out.push(t);
      continue;
    }
    // "2.20" / "2:20" / "10,16" -> normalize inner separator
    const inner = /^(\d{1,3})[.:,](\d{1,3})$/.exec(t);
    if (inner) {
      out.push(inner[1], ':', inner[2]);
      continue;
    }
    break; // non-number token ends the reference zone
  }

  const zone = out.join(' ').replace(/\s*:\s*/g, ':').replace(/\s*-\s*/g, '-').trim();
  if (!zone) return null;

  const patterns: RegExp[] = [
    /^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?/, // 2:20 / 14:61-64
    /^(\d{1,3})\s+(\d{1,3})(?:-(\d{1,3}))?/, // 3 16 (space-separated chapter verse)
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(zone);
    if (match) {
      const chapter = Number(match[1]);
      const verse = Number(match[2]);
      const endVerse = match[3] ? Number(match[3]) : null;
      return { chapter, verse, endVerse: endVerse !== null && endVerse < verse ? null : endVerse };
    }
  }
  const chapterOnly = /^(\d{1,3})(?:-(\d{1,3}))?\s*$/.exec(zone);
  if (chapterOnly) return { chapter: Number(chapterOnly[1]), verse: null, endVerse: null };
  return null;
}

// ---------------------------------------------------------------------------
// Book matching.
// ---------------------------------------------------------------------------
const MAX_EDIT_CAP = (len: number): number => (len <= 4 ? 1 : len <= 7 ? 2 : 3);

interface BookMatch {
  entry: BookEntry;
  score: number; // combined 0..1
  jw: number;
  dmAgree: boolean;
  exact: boolean;
}

/** Score a spoken phrase against one book (best over its surfaces). */
function scoreBook(phrase: string, entry: BookEntry): { score: number; jw: number; dmAgree: boolean } {
  let bestScore = 0;
  let bestJw = 0;
  for (const surface of entry.surfaces) {
    const dist = damerau(phrase, surface);
    if (dist > MAX_EDIT_CAP(Math.max(phrase.length, surface.length))) continue;
    const jw = jaroWinkler(phrase, surface);
    const dl = 1 - dist / Math.max(phrase.length, surface.length);
    const combined = 0.6 * jw + 0.4 * dl;
    if (combined > bestScore) {
      bestScore = combined;
      bestJw = jw;
    }
  }
  // Phonetic gate only nudges the score when the encoder is actually loaded; otherwise stay neutral.
  const phon = doubleMetaphoneFn ? dmCodes(coreOf(phrase)) : null;
  const dmAgree = phon !== null && dmDistance(phon, entry.dm) <= 1;
  let score = bestScore;
  if (doubleMetaphoneFn) score = dmAgree ? Math.min(1, bestScore + 0.12) : bestScore * 0.85;
  return { score, jw: bestJw, dmAgree };
}

/** Find the best book among a window of phrase candidates; returns match + index of last consumed token. */
function matchBook(tokens: string[]): { match: BookMatch; endIndex: number } | null {
  // 1. Exact alias pass (longest window first so "1 corinthians" / "song of solomon" win).
  for (let i = 0; i < tokens.length; i++) {
    for (let w = Math.min(3, tokens.length - i); w >= 1; w--) {
      const phrase = tokens.slice(i, i + w).join(' ');
      const name = ALIAS_MAP.get(phrase);
      if (name) {
        const entry = BOOK_INDEX.find((b) => b.name === name)!;
        return { match: { entry, score: 1, jw: 1, dmAgree: true, exact: true }, endIndex: i + w - 1 };
      }
    }
  }

  // 2. Fuzzy pass over 1- and 2-token windows.
  let best: { match: BookMatch; endIndex: number } | null = null;
  const phraseOrdinalAt = (i: number): number => (/^[123]$/.test(tokens[i]) ? Number(tokens[i]) : 0);
  for (let i = 0; i < tokens.length; i++) {
    for (let w = 1; w <= 2 && i + w <= tokens.length; w++) {
      const slice = tokens.slice(i, i + w);
      if (slice.every((t) => /^\d+$/.test(t))) continue; // numbers aren't book names
      const phrase = slice.join(' ');
      if (phrase.length < 2) continue;
      const ord = phraseOrdinalAt(i);
      for (const entry of BOOK_INDEX) {
        if (entry.ordinal !== 0 && ord !== 0 && entry.ordinal !== ord) continue; // hard ordinal reject
        const { score, jw, dmAgree } = scoreBook(phrase, entry);
        if (!best || score > best.match.score) {
          best = { match: { entry, score, jw, dmAgree, exact: false }, endIndex: i + w - 1 };
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------
export interface ReferenceAnalysis {
  book: string | null;
  score: number;
  jw: number;
  dmAgree: boolean;
  exact: boolean;
  isShort: boolean;
  hasNumber: boolean;
  reference: BibleReference | null; // bcv-validated, in-range (null otherwise)
}

const BOOK_FLOOR = 0.6; // below this, no plausible book

function cleanInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9:.,\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Full analysis of a transcript: best book, scores, and a validated reference when present. */
export function analyzeReference(input: string): ReferenceAnalysis {
  const empty: ReferenceAnalysis = { book: null, score: 0, jw: 0, dmAgree: false, exact: false, isShort: false, hasNumber: false, reference: null };
  const cleaned = normalizeOrdinalBooks(cleanInput(input));
  if (!cleaned) return empty;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const found = matchBook(tokens);
  if (!found || found.match.score < BOOK_FLOOR) return empty;

  const { match, endIndex } = found;
  const trailing = tokens.slice(endIndex + 1).join(' ');
  const numbers = parseNumberZone(trailing);

  let reference: BibleReference | null = null;
  if (numbers) {
    const verse = numbers.verse ?? 1;
    const refString =
      numbers.verse === null
        ? `${match.entry.name} ${numbers.chapter}`
        : `${match.entry.name} ${numbers.chapter}:${verse}${numbers.endVerse ? `-${numbers.endVerse}` : ''}`;
    if (validateInRange(refString)) {
      reference = { book: match.entry.name, chapter: numbers.chapter, verse, endVerse: numbers.endVerse };
    }
  }

  return {
    book: match.entry.name,
    score: match.score,
    jw: match.jw,
    dmAgree: match.dmAgree,
    exact: match.exact,
    isShort: match.entry.isShort,
    hasNumber: numbers !== null,
    reference,
  };
}

const DROPIN_BOOK_MIN = 0.84;
const TRIGGER_BOOK_MIN = 0.72;
const TRIGGER_WITH_NUMBER_MIN = 0.65;
const PROJECT_BOOK_MIN = 0.9;
const PROJECT_NO_DM_MIN = 0.93; // fallback bar when the phonetic encoder isn't loaded

/**
 * Validated, recall-leaning reference parse. Drop-in replacement for the old findBibleReference:
 * returns a reference only when book + in-range chapter:verse validate. Bare book names and
 * out-of-range references return null (fixes the old 1:1 / out-of-range bugs).
 */
export function findBibleReference(input: string): BibleReference | null {
  const a = analyzeReference(input);
  if (!a.reference) return null;
  return a.exact || a.score >= DROPIN_BOOK_MIN ? a.reference : null;
}

/** Recall-first: should we open the (invisible) STT listen window? */
export function shouldTrigger(input: string): boolean {
  const a = analyzeReference(input);
  if (!a.book) return false;
  if (a.isShort && !a.hasNumber) return false; // "mark"/"john" alone must not trigger
  if (a.exact) return true;
  if (a.score >= TRIGGER_BOOK_MIN) return true;
  if (a.dmAgree && a.jw >= 0.8) return true;
  if (a.score >= TRIGGER_WITH_NUMBER_MIN && a.hasNumber) return true;
  return false;
}

/** Precision-first: may we put this verse on the big screen? */
export function parseForProject(input: string): BibleReference | null {
  const a = analyzeReference(input);
  if (!a.reference) return null; // requires in-range book+chapter[:verse] (so short-book guard is automatic)
  if (a.exact) return a.reference;
  if (a.score < PROJECT_BOOK_MIN) return null;
  const phoneticOk = doubleMetaphoneFn ? a.dmAgree : a.score >= PROJECT_NO_DM_MIN;
  return phoneticOk ? a.reference : null;
}
