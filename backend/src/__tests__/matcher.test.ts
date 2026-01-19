/**
 * Phase 3: Fuzzy Matching Engine - Test Suite
 * 
 * Comprehensive tests for the matching algorithm
 * Run with: npx ts-node backend/src/__tests__/matcher.test.ts
 */

import {
  findBestMatch,
  splitLyricsIntoLines,
  createSongContext,
  validateConfig,
  type SongContext,
} from '../services/matcherService';
import type { SongData } from '../services/eventService';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    fn();
    results.push({ name, passed: true, message: '✓' });
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertGreater(actual: number, threshold: number, message?: string): void {
  if (actual <= threshold) {
    throw new Error(
      message || `Expected ${actual} > ${threshold}`
    );
  }
}

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
// Tests
// ============================================

console.log(`\n${colors.blue}=== Phase 3: Fuzzy Matching Engine - Test Suite ===${colors.reset}\n`);

// Test 1: Lyrics splitting
test('splitLyricsIntoLines: should split lyrics by newline', () => {
  const lines = splitLyricsIntoLines(testSong.lyrics!);
  assertEquals(lines.length, 4, 'Should have 4 lines');
  assertEquals(
    lines[0],
    'Amazing grace how sweet the sound',
    'First line should match'
  );
});

// Test 2: Song context creation
test('createSongContext: should create valid context', () => {
  const context = createSongContext(null, testSong, 0);
  assertEquals(context.id, testSong.id, 'IDs should match');
  assertEquals(context.title, testSong.title, 'Titles should match');
  assertEquals(context.lines.length, 4, 'Should have 4 lines');
  assertEquals(context.currentLineIndex, 0, 'Should start at line 0');
});

// Test 3: Exact match
test('findBestMatch: should find exact match', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({
    similarityThreshold: 0.85,
    minBufferLength: 1,
  });

  const buffer = 'Amazing grace how sweet the sound';
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, true, 'Should find a match');
  assertGreater(
    result.confidence,
    0.95,
    'Exact match should have high confidence (>0.95)'
  );
  assertEquals(result.currentLineIndex, 0, 'Should match first line');
});

// Test 4: Partial match with high confidence
test('findBestMatch: should find partial matches', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({
    similarityThreshold: 0.75,
    minBufferLength: 2,
  });

  const buffer = 'amazing grace how sweet'; // Missing "the sound"
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, true, 'Should find a match');
  assertGreater(
    result.confidence,
    0.7,
    'Partial match should have decent confidence'
  );
});

// Test 5: Multi-word buffer
test('findBestMatch: should handle rolling buffer', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({
    similarityThreshold: 0.80,
    minBufferLength: 2,
    bufferWindow: 100,
  });

  // Simulates rolling buffer with transcription progress
  const buffer = 'amazing grace how sweet the sound that saved';
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, true, 'Should find a match in buffer');
  assertGreater(
    result.confidence,
    0.65,
    'Buffer match should have reasonable confidence'
  );
});

// Test 6: Line progression
test('findBestMatch: should advance to next line', () => {
  const context = createSongContext(null, testSong, 0);
  context.currentLineIndex = 0; // Start at first line

  const config = validateConfig({
    similarityThreshold: 0.85,
    minBufferLength: 2,
  });

  const buffer = 'that saved a wretch like me';
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, true, 'Should find second line');
  assertEquals(result.nextLineIndex, 1, 'Should find next line index');
  assertEquals(result.isLineEnd, true, 'Should indicate line end');
});

// Test 7: No match below threshold
test('findBestMatch: should not match below threshold', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({
    similarityThreshold: 0.95,
    minBufferLength: 1,
  });

  const buffer = 'this is completely random text';
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, false, 'Should not find a match');
  assertEquals(result.confidence, 0, 'Confidence should be 0');
});

// Test 8: Buffer too short
test('findBestMatch: should require minimum buffer length', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({
    similarityThreshold: 0.85,
    minBufferLength: 5,
  });

  const buffer = 'amazing grace'; // Only 2 words
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, false, 'Should not match short buffer');
});

// Test 9: Punctuation normalization
test('findBestMatch: should handle punctuation', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({
    similarityThreshold: 0.80,
    minBufferLength: 2,
  });

  const buffer = 'Amazing grace, how sweet the sound!'; // With punctuation
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, true, 'Should match despite punctuation');
  assertGreater(
    result.confidence,
    0.90,
    'Punctuation-removed match should be high confidence'
  );
});

// Test 10: Case insensitivity
test('findBestMatch: should be case insensitive', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({
    similarityThreshold: 0.85,
    minBufferLength: 2,
  });

  const buffer = 'AMAZING GRACE HOW SWEET THE SOUND';
  const result = findBestMatch(buffer, context, config);

  assertEquals(result.matchFound, true, 'Should match uppercase');
  assertGreater(
    result.confidence,
    0.95,
    'Case variation should not reduce confidence'
  );
});

// Test 11: Config validation
test('validateConfig: should validate configuration', () => {
  const config = validateConfig({
    similarityThreshold: 1.5, // Invalid: >1
    minBufferLength: 0, // Invalid: <1
    bufferWindow: -10, // Invalid: <1
  });

  assertEquals(config.similarityThreshold, 1, 'Threshold should be capped at 1');
  assertEquals(config.minBufferLength, 1, 'Min buffer should be at least 1');
  assertEquals(config.bufferWindow, 1, 'Buffer window should be at least 1');
});

// Test 12: Song progress tracking
test('findBestMatch: should track progress through song', () => {
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
      assertEquals(
        result.currentLineIndex,
        expectedIndex,
        `Line ${i} should match line ${expectedIndex}`
      );
    }
  }
});

// Test 13: Empty input handling
test('findBestMatch: should handle empty inputs', () => {
  const context = createSongContext(null, testSong, 0);
  const config = validateConfig({});

  const result1 = findBestMatch('', context, config);
  assertEquals(result1.matchFound, false, 'Empty buffer should not match');

  const emptyContext: SongContext = {
    id: '',
    title: '',
    lines: [],
    currentLineIndex: 0,
  };

  const result2 = findBestMatch('test', emptyContext, config);
  assertEquals(result2.matchFound, false, 'Empty song context should not match');
});

// ============================================
// Results Summary
// ============================================

console.log(`\n${colors.yellow}Test Results:${colors.reset}\n`);

let passCount = 0;
let failCount = 0;

results.forEach((result) => {
  if (result.passed) {
    console.log(`${colors.green}✓${colors.reset} ${result.name}`);
    passCount++;
  } else {
    console.log(
      `${colors.red}✗${colors.reset} ${result.name}\n  ${colors.gray}${result.message}${colors.reset}`
    );
    failCount++;
  }
});

console.log(`\n${colors.blue}═══════════════════════════════════${colors.reset}`);
console.log(
  `${colors.green}Passed: ${passCount}${colors.reset} | ${colors.red}Failed: ${failCount}${colors.reset}`
);
console.log(`${colors.blue}═══════════════════════════════════${colors.reset}\n`);

if (failCount === 0) {
  console.log(`${colors.green}🎉 All tests passed!${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`${colors.red}❌ Some tests failed${colors.reset}\n`);
  process.exit(1);
}

