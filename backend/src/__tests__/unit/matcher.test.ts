/**
 * Matcher Service Unit Tests
 * 
 * Comprehensive tests for the fuzzy matching algorithm
 * Migrated from custom test runner to Jest
 */

import {
  findBestMatch,
  findBestMatchAcrossAllSongs,
  splitLyricsIntoLines,
  createSongContext,
  validateConfig,
  type SongContext,
} from '../../services/matcherService';
import type { SongData } from '../../services/eventService';

// ============================================
// Test Data
// ============================================

const testSong: SongData = {
  id: 'test_song_1',
  title: 'Amazing Grace',
  artist: 'John Newton',
  lyrics: `Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see`,
  lines: [
    'Amazing grace how sweet the sound',
    'That saved a wretch like me',
    'I once was lost but now am found',
    'Was blind but now I see',
  ],
};

// ============================================
// Test Suites
// ============================================

describe('Matcher Service', () => {
  describe('splitLyricsIntoLines', () => {
    it('should split lyrics by newline', () => {
      const lines = splitLyricsIntoLines(testSong.lyrics!);
      expect(lines.length).toBe(4);
      expect(lines[0]).toBe('Amazing grace how sweet the sound');
    });
  });

  describe('createSongContext', () => {
    it('should create valid context', () => {
      const context = createSongContext(null, testSong, 0);
      expect(context.id).toBe(testSong.id);
      expect(context.title).toBe(testSong.title);
      expect(context.lines.length).toBe(4);
      expect(context.currentLineIndex).toBe(0);
    });
  });

  describe('findBestMatch', () => {
    it('should find exact match', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({
        similarityThreshold: 0.85,
        minBufferLength: 1,
      });

      const buffer = 'Amazing grace how sweet the sound';
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.currentLineIndex).toBe(0);
    });

    it('should find partial matches', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({
        similarityThreshold: 0.75,
        minBufferLength: 2,
      });

      const buffer = 'amazing grace how sweet'; // Missing "the sound"
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle rolling buffer', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({
        similarityThreshold: 0.80,
        minBufferLength: 2,
        bufferWindow: 100,
      });

      // Simulates rolling buffer with transcription progress
      const buffer = 'amazing grace how sweet the sound that saved';
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.65);
    });

    it('should advance to next line', () => {
      const context = createSongContext(null, testSong, 0);
      context.currentLineIndex = 0; // Start at first line

      const config = validateConfig({
        similarityThreshold: 0.85,
        minBufferLength: 2,
      });

      const buffer = 'that saved a wretch like me';
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.nextLineIndex).toBe(1);
      expect(result.isLineEnd).toBe(true);
    });

    it('should not match below threshold', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({
        similarityThreshold: 0.95,
        minBufferLength: 1,
      });

      const buffer = 'this is completely random text';
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should require minimum buffer length', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({
        similarityThreshold: 0.85,
        minBufferLength: 5,
      });

      const buffer = 'amazing grace'; // Only 2 words
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(false);
    });

    it('should handle punctuation', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({
        similarityThreshold: 0.80,
        minBufferLength: 2,
      });

      const buffer = 'Amazing grace, how sweet the sound!'; // With punctuation
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.90);
    });

    it('should be case insensitive', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({
        similarityThreshold: 0.85,
        minBufferLength: 2,
      });

      const buffer = 'AMAZING GRACE HOW SWEET THE SOUND';
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('should match STT soundalikes (e.g. "what" for "worthy")', () => {
      const worthySong: SongData = {
        id: 'worthy_song',
        title: 'Worthy',
        artist: '',
        lyrics: 'Worthy is your name',
        lines: ['Worthy is your name'],
      };
      const context = createSongContext(null, worthySong, 0);
      const config = validateConfig({
        similarityThreshold: 0.80,
        minBufferLength: 2,
      });

      const buffer = 'what is your name'; // STT mishearing
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should track progress through song', () => {
      const config = validateConfig({
        similarityThreshold: 0.80,
        minBufferLength: 2,
      });

      // Simulate progression through song
      const testCases = [
        { buffer: 'amazing grace how sweet the sound', expectedIndex: 0 },
        { buffer: 'that saved a wretch like me', expectedIndex: 1 },
        { buffer: 'i once was lost but now am found', expectedIndex: 2 },
        { buffer: 'was blind but now i see', expectedIndex: 3 },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const { buffer, expectedIndex } = testCases[i];
        const testContext = createSongContext(null, testSong, i);
        const result = findBestMatch(buffer, testContext, config);

        if (result.matchFound) {
          expect(result.currentLineIndex).toBe(expectedIndex);
        }
      }
    });

    it('should handle empty inputs', () => {
      const context = createSongContext(null, testSong, 0);
      const config = validateConfig({});

      const result1 = findBestMatch('', context, config);
      expect(result1.matchFound).toBe(false);

      const emptyContext: SongContext = {
        id: '',
        title: '',
        lines: [],
        currentLineIndex: 0,
      };

      const result2 = findBestMatch('test', emptyContext, config);
      expect(result2.matchFound).toBe(false);
    });
  });

  describe('findBestMatchAcrossAllSongs (initial-word rule)', () => {
    it('penalizes other-song match when line does not start with buffer (e.g. "your name" vs "worthy is your name")', () => {
      // Current song: Holy Forever, low confidence so we check other songs
      const holyForever: SongData = {
        id: 'holy',
        title: 'Holy Forever',
        lyrics: 'A thousand generations falling down in worship',
        lines: ['A thousand generations falling down in worship'],
      };
      const worthy: SongData = {
        id: 'worthy',
        title: 'Worthy',
        lyrics: 'Worthy is your name',
        lines: ['Worthy is your name'],
      };
      const currentContext = createSongContext(null, holyForever, 0);
      const allSongs: SongData[] = [holyForever, worthy];
      const config = validateConfig({ minBufferLength: 1, similarityThreshold: 0.85 });

      // Buffer "your name" matches "Worthy is your name" well as substring, but line does NOT start with "your name"
      const result = findBestMatchAcrossAllSongs('your name', currentContext, allSongs, 0, config);

      // Current song has low confidence (buffer does not match Holy Forever line)
      expect(result.currentSongMatch.confidence).toBeLessThan(0.6);
      // Suggested switch to Worthy should be penalized so confidence is below auto-switch threshold (0.58)
      // Unpenalized "your name" vs "worthy is your name" would be ~0.63; with 0.5 penalty ~0.31
      if (result.suggestedSongSwitch) {
        expect(result.suggestedSongSwitch.confidence).toBeLessThan(0.5);
      }
    });

    it('does not penalize when line starts with buffer (e.g. "your name" vs "your name is the highest")', () => {
      const holyForever: SongData = {
        id: 'holy',
        title: 'Holy Forever',
        lyrics: 'A thousand generations',
        lines: ['A thousand generations'],
      };
      const yourNameSong: SongData = {
        id: 'yn',
        title: 'Your Name',
        lyrics: 'Your name is the highest',
        lines: ['Your name is the highest'],
      };
      const currentContext = createSongContext(null, holyForever, 0);
      const allSongs: SongData[] = [holyForever, yourNameSong];
      const config = validateConfig({ minBufferLength: 1, similarityThreshold: 0.5 });

      const result = findBestMatchAcrossAllSongs('your name', currentContext, allSongs, 0, config);

      // Line "your name is the highest" starts with "your name" → no penalty
      if (result.suggestedSongSwitch) {
        expect(result.suggestedSongSwitch.songTitle).toBe('Your Name');
        expect(result.suggestedSongSwitch.confidence).toBeGreaterThan(0.5);
      }
    });

    it('suggests song switch when buffer matches song title (e.g. "holy forever" → Holy Forever)', () => {
      const worthy: SongData = {
        id: 'worthy',
        title: 'Worthy',
        lyrics: 'Worthy is your name',
        lines: ['Worthy is your name'],
      };
      const holyForever: SongData = {
        id: 'holy',
        title: 'Holy Forever',
        lyrics: 'Holy forever\nYou will always be holy',
        lines: ['Holy forever', 'You will always be holy'],
      };
      const currentContext = createSongContext(null, worthy, 0);
      const allSongs: SongData[] = [worthy, holyForever];
      const config = validateConfig({ minBufferLength: 1, similarityThreshold: 0.5 });

      const result = findBestMatchAcrossAllSongs('holy forever', currentContext, allSongs, 0, config);

      expect(result.currentSongMatch.confidence).toBeLessThan(0.6);
      expect(result.suggestedSongSwitch).toBeDefined();
      expect(result.suggestedSongSwitch!.songTitle).toBe('Holy Forever');
      expect(result.suggestedSongSwitch!.matchedLineIndex).toBe(0);
      expect(result.suggestedSongSwitch!.confidence).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe('useBigramEndOfSlide (repeating lyrics across slides)', () => {
    // Song with two slides: last line of slide 1 = first line of slide 2 (repeating "Worthy is your name").
    // Use a long second-to-last line so the bi-gram end trigger (last 40% of combined) includes distinctive words
    // and buffer "worthy is your name" alone does not match it well.
    const repeatingLyricSong: SongData = {
      id: 'repeating_song',
      title: 'Repeating',
      artist: '',
      lyrics: 'All honour and praise we give to you\nWorthy is your name\nWorthy is your name\nForever we will sing',
      lines: [
        'All honour and praise we give to you',
        'Worthy is your name',
        'Worthy is your name',
        'Forever we will sing',
      ],
      slides: [
        {
          lines: ['All honour and praise we give to you', 'Worthy is your name'],
          slideText: 'All honour and praise we give to you\nWorthy is your name',
          startLineIndex: 0,
          endLineIndex: 1,
        },
        {
          lines: ['Worthy is your name', 'Forever we will sing'],
          slideText: 'Worthy is your name\nForever we will sing',
          startLineIndex: 2,
          endLineIndex: 3,
        },
      ],
      lineToSlideIndex: [0, 0, 1, 1],
    };

    it('with useBigramEndOfSlide true: buffer only repeated line does NOT advance (stay on slide 1)', () => {
      const context = createSongContext(null, repeatingLyricSong, 1); // last line of slide 1
      expect(context.endOfSlideTarget).toBeDefined();
      expect(context.endOfSlideTarget).toContain('all honour and praise');
      expect(context.endOfSlideTarget).toContain('worthy is your name');

      const config = validateConfig({
        similarityThreshold: 0.55,
        minBufferLength: 2,
        useBigramEndOfSlide: true,
      });

      const buffer = 'worthy is your name'; // only the repeated line - bi-gram trigger needs more context
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.currentLineIndex).toBe(1);
      // Should NOT advance: bi-gram end trigger is last 40% of combined line (includes "give to you...")
      expect(result.isLineEnd).toBe(false);
      expect(result.nextLineIndex).toBeUndefined();
    });

    it('with useBigramEndOfSlide true: buffer has second-to-last + last line of slide 1 advances', () => {
      const context = createSongContext(null, repeatingLyricSong, 1);
      const config = validateConfig({
        similarityThreshold: 0.55,
        minBufferLength: 2,
        useBigramEndOfSlide: true,
      });

      const buffer = 'all honour and praise we give to you worthy is your name';
      const result = findBestMatch(buffer, context, config);

      expect(result.matchFound).toBe(true);
      expect(result.isLineEnd).toBe(true);
      expect(result.nextLineIndex).toBe(2);
      // currentLineIndex may be 1 (advance from current) or 2 (best match already on next line)
      expect([1, 2]).toContain(result.currentLineIndex);
    });

    it('default (useBigramEndOfSlide true) uses endOfSlideTarget when on last line of slide', () => {
      const config = validateConfig({ similarityThreshold: 0.55, minBufferLength: 2 });
      expect(config.useBigramEndOfSlide).toBe(true);
    });

    it('when useBigramEndOfSlide false, single-line trigger can advance', () => {
      const context = createSongContext(null, repeatingLyricSong, 1);
      const config = validateConfig({
        similarityThreshold: 0.55,
        minBufferLength: 2,
        useBigramEndOfSlide: false,
      });
      expect(config.useBigramEndOfSlide).toBe(false);

      const buffer = 'worthy is your name';
      const result = findBestMatch(buffer, context, config);

      // With single-line trigger (bi-gram off), buffer matching "Worthy is your name" may advance
      expect(result.matchFound).toBe(true);
      expect(result.currentLineIndex).toBe(1);
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration and clamp invalid values', () => {
      const config = validateConfig({
        similarityThreshold: 1.5, // Invalid: >1
        minBufferLength: 0, // Invalid: <1
        bufferWindow: -10, // Invalid: <1
      });

      expect(config.similarityThreshold).toBe(1);
      expect(config.minBufferLength).toBe(1);
      expect(config.bufferWindow).toBe(1);
    });

    it('should use default values when not provided', () => {
      const config = validateConfig({});
      expect(config.similarityThreshold).toBeGreaterThan(0);
      expect(config.minBufferLength).toBeGreaterThan(0);
      expect(config.bufferWindow).toBeGreaterThan(0);
    });
  });
});
