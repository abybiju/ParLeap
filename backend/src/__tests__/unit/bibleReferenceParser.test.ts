/**
 * Smart Bible Listen — fuzzy reference parser tests.
 * Cases are drawn from REAL sermon STT renderings measured on The Bridge PA "Acts 9"
 * sermons (Whisper + YouTube STT), plus the false-positive prose traps.
 */
import {
  findBibleReference,
  shouldTrigger,
  parseForProject,
  initBibleReferenceParser,
} from '../../services/bibleReferenceParser';

beforeAll(async () => {
  // Loads the optional phonetic encoder; parser works either way. Must not throw.
  await initBibleReferenceParser();
});

describe('findBibleReference — validated drop-in', () => {
  const cases: Array<[string, { book: string; chapter: number; verse: number; endVerse?: number | null }]> = [
    ['Galatians 2:20', { book: 'Galatians', chapter: 2, verse: 20 }],
    ['turn to Galatians 2:20', { book: 'Galatians', chapter: 2, verse: 20 }],
    ['Galatians 2.20', { book: 'Galatians', chapter: 2, verse: 20 }],
    ['John 10 16', { book: 'John', chapter: 10, verse: 16 }],
    ['John 10.16', { book: 'John', chapter: 10, verse: 16 }],
    ['Romans 8 28', { book: 'Romans', chapter: 8, verse: 28 }],
    ['Acts chapter 9', { book: 'Acts', chapter: 9, verse: 1 }],
    ['Acts chapter nine', { book: 'Acts', chapter: 9, verse: 1 }],
    ['Mark 14, 61 to 64', { book: 'Mark', chapter: 14, verse: 61, endVerse: 64 }],
    ['first Corinthians thirteen', { book: '1 Corinthians', chapter: 13, verse: 1 }],
    ['first Corinthians thirteen four', { book: '1 Corinthians', chapter: 13, verse: 4 }],
    ['John three sixteen', { book: 'John', chapter: 3, verse: 16 }],
    ['salms 23', { book: 'Psalms', chapter: 23, verse: 1 }],
    ['Ecclesiates 3', { book: 'Ecclesiastes', chapter: 3, verse: 1 }], // fuzzy (missing 's')
    ['Revelations 22', { book: 'Revelation', chapter: 22, verse: 1 }], // alias
    ['2 Samuel 7', { book: '2 Samuel', chapter: 7, verse: 1 }],
    ['second Samuel seven', { book: '2 Samuel', chapter: 7, verse: 1 }],
    ['1 John 4 8', { book: '1 John', chapter: 4, verse: 8 }],
    ['Song of Solomon 2', { book: 'Song of Solomon', chapter: 2, verse: 1 }],
  ];
  it.each(cases)('parses "%s"', (input, expected) => {
    const ref = findBibleReference(input);
    expect(ref).not.toBeNull();
    expect(ref!.book).toBe(expected.book);
    expect(ref!.chapter).toBe(expected.chapter);
    expect(ref!.verse).toBe(expected.verse);
    if (expected.endVerse !== undefined) expect(ref!.endVerse).toBe(expected.endVerse);
  });
});

describe('findBibleReference — false-positive & out-of-range guards (the bug fixes)', () => {
  const nulls = [
    'we turn to the Lord', // scripture-ish prose, no book+number
    'the book of life', // "life" is not a book, no number
    'John was a good man', // bare book name (old bug forced John 1:1)
    'mark', // short book name alone
    'three sixteen', // numbers with no book
    'Galatians 7:99', // Galatians has 6 chapters
    'Psalm 119:177', // Psalm 119 has 176 verses
    'Psalm 151', // Psalms ends at 150
    'John 25:99', // John has 21 chapters
    'hello everyone', // ordinary speech
  ];
  it.each(nulls)('rejects "%s"', (input) => {
    expect(findBibleReference(input)).toBeNull();
  });
});

describe('common-word / name book guard', () => {
  const blocked = ['number one', 'act two', 'we have three points number one', 'mark my words'];
  it.each(blocked)('does not fabricate a reference from "%s"', (input) => {
    expect(findBibleReference(input)).toBeNull();
  });

  const allowed: Array<[string, { book: string; chapter: number; verse: number }]> = [
    ['Acts nine', { book: 'Acts', chapter: 9, verse: 1 }], // exact book + number
    ['Numbers chapter 1', { book: 'Numbers', chapter: 1, verse: 1 }], // explicit "chapter" cue
    ['Numbers 1 5', { book: 'Numbers', chapter: 1, verse: 5 }], // verse number present
  ];
  it.each(allowed)('still resolves real references like "%s"', (input, expected) => {
    const ref = findBibleReference(input);
    expect(ref).not.toBeNull();
    expect(ref!.book).toBe(expected.book);
    expect(ref!.chapter).toBe(expected.chapter);
    expect(ref!.verse).toBe(expected.verse);
  });
});

describe('shouldTrigger — recall-first (liberal)', () => {
  const triggers = ['Galatians 2:20', 'Galician 2:20', 'Acts chapter nine', 'turn to Romans 8', 'Romans'];
  it.each(triggers)('opens window for "%s"', (input) => {
    expect(shouldTrigger(input)).toBe(true);
  });
  const noTriggers = [
    'we turn to the Lord',
    'the book of life',
    'John was a good man',
    'mark',
    'hello everyone',
    'so if you have your bible tonight', // fuzzy book match, no number -> must not open a window
  ];
  it.each(noTriggers)('stays idle for "%s"', (input) => {
    expect(shouldTrigger(input)).toBe(false);
  });
});

describe('parseForProject — precision-first (strict)', () => {
  it('projects a clean, in-range reference', () => {
    const ref = parseForProject('Galatians 2:20');
    expect(ref).not.toBeNull();
    expect(ref!.book).toBe('Galatians');
  });
  it('never projects an out-of-range reference', () => {
    expect(parseForProject('Galatians 7:99')).toBeNull();
  });
  it('never projects a bare book name', () => {
    expect(parseForProject('John')).toBeNull();
  });
  it('does not project a low-confidence homophone ("Galician 2:20") on a lone source', () => {
    expect(parseForProject('Galician 2:20')).toBeNull();
  });
});
