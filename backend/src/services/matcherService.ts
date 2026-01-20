/**
 * Fuzzy Matching Service
 * 
 * Performs real-time matching of transcribed text against song lyrics
 * using string similarity algorithms. This is the "Predictive Layer" that
 * decides when to auto-advance slides.
 * 
 * Architecture:
 * - Rolling buffer of recent transcriptions (last 5-10 seconds)
 * - Current song lyrics split into displayable lines
 * - Fuzzy string matching to find best match
 * - Confidence-based threshold (0.85+) triggers auto-advance
 */

import { compareTwoStrings } from 'string-similarity';
import type { SongData } from './eventService';

/**
 * Represents a matched line with confidence
 */
export interface MatchResult {
  matchFound: boolean;
  currentLineIndex: number;
  confidence: number;
  matchedText: string;
  nextLineIndex?: number;
  isLineEnd?: boolean;
}

/**
 * Song context for matching
 */
export interface SongContext {
  id: string;
  title: string;
  artist?: string;
  lines: string[]; // Individual lines of lyrics
  currentLineIndex: number;
}

/**
 * Configuration for matching behavior
 */
export interface MatcherConfig {
  similarityThreshold: number; // 0.0 - 1.0, default 0.85
  minBufferLength: number; // Minimum words in buffer before matching
  bufferWindow: number; // How many recent words to consider
  debug?: boolean;
}

const DEFAULT_CONFIG: MatcherConfig = {
  similarityThreshold: 0.85,
  minBufferLength: 3, // At least 3 words before trying to match
  bufferWindow: 100, // Compare against last 100 words
  debug: false,
};

/**
 * Normalize text for matching:
 * - Lowercase
 * - Remove extra whitespace
 * - Remove punctuation (but keep apostrophes for contractions)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s']/g, '') // Keep apostrophes for contractions like "it's"
    .replace(/\s+/g, ' ');
}

/**
 * Split lyrics into displayable lines
 * Assumes lyrics are separated by newlines or double spaces
 */
export function splitLyricsIntoLines(lyrics: string): string[] {
  const lines = lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0); // Remove empty lines

  if (lines.length === 0) {
    return [lyrics]; // Fallback: treat entire lyrics as one line
  }

  return lines;
}

/**
 * Find the best match for buffer text in song lines
 * 
 * Algorithm:
 * 1. Get recent words from buffer (last N words)
 * 2. Normalize buffer and each song line
 * 3. Calculate similarity score for each line
 * 4. Return line with highest score if above threshold
 * 5. Handle edge cases (end of song, silence, etc.)
 */
export function findBestMatch(
  buffer: string,
  songContext: SongContext,
  config: MatcherConfig = DEFAULT_CONFIG
): MatchResult {
  const result: MatchResult = {
    matchFound: false,
    currentLineIndex: songContext.currentLineIndex,
    confidence: 0,
    matchedText: '',
  };

  // Validate inputs
  if (!buffer || !songContext.lines || songContext.lines.length === 0) {
    return result;
  }

  // Get recent words from buffer
  const bufferWords = buffer.split(/\s+/).filter(w => w.length > 0);
  if (bufferWords.length < config.minBufferLength) {
    if (config.debug) {
      console.log(
        `[MATCHER] Buffer too short: ${bufferWords.length} < ${config.minBufferLength}`
      );
    }
    return result;
  }

  // Get last N words from buffer
  const recentBuffer = bufferWords
    .slice(-config.bufferWindow)
    .join(' ');
  const normalizedBuffer = normalizeText(recentBuffer);

  if (config.debug) {
    console.log(`[MATCHER] Buffer: "${normalizedBuffer.slice(-50)}..."`);
  }

  // Compare against all upcoming lines (current and next few)
  // This helps handle edge cases where buffer might partially match next line
  const lookAheadWindow = 3; // Look at current + next 2 lines
  let bestScore = 0;
  let bestLineIndex = songContext.currentLineIndex;
  let matchedLineText = '';

  // For better line transition detection, also check if the END of buffer matches next line
  // This helps with noisy transcripts where buffer contains multiple lines
  const endWindowWords = 6; // Check last 6 words for line transition
  const endBuffer = bufferWords.length >= endWindowWords
    ? bufferWords.slice(-endWindowWords).join(' ')
    : normalizedBuffer;
  const normalizedEndBuffer = normalizeText(endBuffer);

  for (
    let i = songContext.currentLineIndex;
    i < Math.min(songContext.currentLineIndex + lookAheadWindow, songContext.lines.length);
    i++
  ) {
    const line = songContext.lines[i];
    const normalizedLine = normalizeText(line);

    // Calculate similarity with full buffer
    const fullSimilarity = compareTwoStrings(normalizedBuffer, normalizedLine);
    
    // Also check if end of buffer matches this line (helps detect transitions)
    const endSimilarity = i > songContext.currentLineIndex 
      ? compareTwoStrings(normalizedEndBuffer, normalizedLine)
      : 0;
    
    // Use the higher of the two similarities, but weight end similarity more for next lines
    const similarity = i > songContext.currentLineIndex
      ? Math.max(fullSimilarity, endSimilarity * 1.2) // Boost end match for next lines
      : fullSimilarity;

    if (config.debug) {
      console.log(
        `[MATCHER] Line ${i}: "${normalizedLine.slice(0, 40)}..." → ${(similarity * 100).toFixed(1)}% (full: ${(fullSimilarity * 100).toFixed(1)}%, end: ${(endSimilarity * 100).toFixed(1)}%)`
      );
    }

    if (similarity > bestScore) {
      bestScore = similarity;
      bestLineIndex = i;
      matchedLineText = line;
    }
  }

  // Check if match meets threshold
  if (bestScore >= config.similarityThreshold) {
    result.matchFound = true;
    result.currentLineIndex = bestLineIndex;
    result.confidence = bestScore;
    result.matchedText = matchedLineText;

    // Determine if we should auto-advance
    if (bestLineIndex === songContext.currentLineIndex) {
      // Still on current line
      result.isLineEnd = false;
      if (config.debug) {
        console.log(
          `[MATCHER] ✅ MATCH FOUND: Line ${bestLineIndex} @ ${(bestScore * 100).toFixed(1)}% (current line, no advance)`
        );
      }
    } else {
      // Moved to next line(s)
      result.isLineEnd = true;
      result.nextLineIndex = bestLineIndex;
      if (config.debug) {
        console.log(
          `[MATCHER] ✅ MATCH FOUND: Line ${bestLineIndex} @ ${(bestScore * 100).toFixed(1)}% (advancing from ${songContext.currentLineIndex})`
        );
      }
    }
  } else {
    if (config.debug) {
      console.log(`[MATCHER] ❌ No match (best: ${(bestScore * 100).toFixed(1)}%)`);
    }
  }

  return result;
}

/**
 * Batch process multiple buffers at once
 * Useful for handling queued transcriptions
 */
export function findBestMatchBatch(
  buffers: string[],
  songContext: SongContext,
  config: MatcherConfig = DEFAULT_CONFIG
): MatchResult[] {
  return buffers.map(buffer =>
    findBestMatch(buffer, songContext, config)
  );
}

/**
 * Create song context from event item and song data
 * Helper function to prepare data for matching
 */
export function createSongContext(
  _eventItem: unknown, // Event item metadata (not used in current implementation)
  songData: SongData,
  currentLineIndex: number = 0
): SongContext {
  const lines = splitLyricsIntoLines(songData.lyrics || '');

  return {
    id: songData.id,
    title: songData.title,
    artist: songData.artist,
    lines,
    currentLineIndex: Math.min(currentLineIndex, lines.length - 1),
  };
}

/**
 * Calculate how far through a song we are
 * Returns percentage 0-100
 */
export function getSongProgress(
  currentLineIndex: number,
  totalLines: number
): number {
  if (totalLines === 0) return 0;
  return (currentLineIndex / totalLines) * 100;
}

/**
 * Validate matcher configuration
 */
export function validateConfig(config: Partial<MatcherConfig>): MatcherConfig {
  return {
    similarityThreshold: Math.max(0, Math.min(1, config.similarityThreshold ?? DEFAULT_CONFIG.similarityThreshold)),
    minBufferLength: Math.max(1, config.minBufferLength ?? DEFAULT_CONFIG.minBufferLength),
    bufferWindow: Math.max(1, config.bufferWindow ?? DEFAULT_CONFIG.bufferWindow),
    debug: config.debug ?? DEFAULT_CONFIG.debug,
  };
}

