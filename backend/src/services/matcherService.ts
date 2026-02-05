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
  advanceReason?: 'end-words' | 'next-line';
  endTriggerScore?: number;
  nextLineConfidence?: number;
  wasForwardProgress?: boolean; // Track if this advances forward (prevents backward jumps with repeated lyrics)
}

/**
 * Multi-song match result (for checking all songs in setlist)
 */
export interface MultiSongMatchResult {
  currentSongMatch: MatchResult;
  suggestedSongSwitch?: {
    songId: string;
    songTitle: string;
    songIndex: number;
    confidence: number;
    matchedLine: string;
    matchedLineIndex: number;
  };
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
  lookAheadWindow?: number; // Override lookahead window for matching
  allowBackward?: boolean; // Allow backward matches (e.g., after bible mode)
}

const DEFAULT_CONFIG: MatcherConfig = {
  similarityThreshold: 0.85,
  minBufferLength: 3, // At least 3 words before trying to match
  bufferWindow: 100, // Compare against last 100 words
  debug: false,
  lookAheadWindow: 3,
  allowBackward: false,
};

// End-of-line detection configuration
const END_TRIGGER_PERCENTAGE = 0.40; // Last 40% of words trigger advance (adapts to line length)
const END_TRIGGER_THRESHOLD = 0.58; // Lower threshold for end trigger sensitivity
const END_TRIGGER_SECONDARY_THRESHOLD = 0.52; // Secondary threshold when next-line is also rising
const NEXT_LINE_SUPPORT_THRESHOLD = 0.60; // Require a reasonable next-line confidence for hybrid trigger
const END_TRIGGER_MATCH_GATE = 0.68; // Allow end-trigger even if full-line confidence is lower
// Fallback if using fixed word count: const END_TRIGGER_WORD_COUNT = 5;

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
 * Extract the last N words from a line for end-of-line detection
 * Can use either fixed word count or percentage of line length
 * Used to detect when singer has reached the end of current line
 */
function extractEndWords(text: string, wordCountOrPercentage: number): string {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  
  // If value is between 0 and 1, treat as percentage
  // Otherwise treat as fixed word count
  let numWords: number;
  if (wordCountOrPercentage > 0 && wordCountOrPercentage < 1) {
    // Percentage mode: extract last X% of words (minimum 3 words)
    numWords = Math.max(3, Math.ceil(words.length * wordCountOrPercentage));
  } else {
    // Fixed count mode
    numWords = Math.floor(wordCountOrPercentage);
  }
  
  const endWords = words.slice(-Math.min(numWords, words.length));
  return endWords.join(' ');
}

/**
 * Adaptive end-of-line trigger extraction
 * Short lines use fixed counts, longer lines use percentage
 */
function getAdaptiveEndTrigger(text: string): {
  triggerText: string;
  triggerWords: number;
  totalWords: number;
  mode: 'short' | 'medium' | 'percentage';
} {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  if (totalWords <= 6) {
    return {
      triggerText: extractEndWords(text, 3),
      triggerWords: Math.min(3, totalWords),
      totalWords,
      mode: 'short',
    };
  }

  if (totalWords <= 9) {
    return {
      triggerText: extractEndWords(text, 4),
      triggerWords: Math.min(4, totalWords),
      totalWords,
      mode: 'medium',
    };
  }

  if (totalWords <= 12) {
    return {
      triggerText: extractEndWords(text, 5),
      triggerWords: Math.min(5, totalWords),
      totalWords,
      mode: 'medium',
    };
  }

  const triggerText = extractEndWords(text, END_TRIGGER_PERCENTAGE);
  const triggerWords = triggerText.trim().split(/\s+/).filter(w => w.length > 0).length;
  return {
    triggerText,
    triggerWords,
    totalWords,
    mode: 'percentage',
  };
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
    if (config.debug) {
      console.log(`[MATCHER] Invalid input: buffer="${buffer}", lines.length=${songContext.lines?.length ?? 0}`);
    }
    return result;
  }

  if (config.debug) {
    console.log(`[MATCHER] Starting match with cleaned buffer: "${buffer}"`);
    console.log(`[MATCHER] Current line index: ${songContext.currentLineIndex}, Total lines: ${songContext.lines.length}`);
    console.log(`[MATCHER] Forward-only mode: ENABLED (prevents repeated lyrics backtracking)`);
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
  const lookAheadWindow = config.lookAheadWindow ?? 3; // Look at current + next N lines
  
  if (config.debug) {
    console.log(`[MATCHER] Search window: lines ${songContext.currentLineIndex} to ${Math.min(songContext.currentLineIndex + lookAheadWindow, songContext.lines.length - 1)}`);
  }
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
      ? Math.min(1.0, Math.max(fullSimilarity, endSimilarity * 1.2)) // Boost end match for next lines, cap at 1.0
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

  // FORWARD-ONLY CONSTRAINT: Never allow backward progression
  // This prevents issues with repeated lyrics (e.g., same line at end of each stanza)
  if (!config.allowBackward && bestScore >= config.similarityThreshold && bestLineIndex < songContext.currentLineIndex) {
    if (config.debug) {
      console.log(
        `[MATCHER] ⚠️  REJECTED BACKWARD MATCH: Line ${bestLineIndex} < current ${songContext.currentLineIndex} - "${matchedLineText.slice(0, 40)}..."`
      );
      console.log(
        `[MATCHER] This prevents jumping back to repeated lyrics from earlier stanzas`
      );
    }
    // Don't set matchFound - treat as no match (prevents backward jump)
    return result;
  }

  // Check if match meets threshold (or allow end-trigger at a lower gate)
  if (bestScore >= config.similarityThreshold) {
    result.matchFound = true;
    result.currentLineIndex = bestLineIndex;
    result.confidence = bestScore;
    result.matchedText = matchedLineText;
    result.wasForwardProgress = bestLineIndex >= songContext.currentLineIndex;

    // Determine if we should auto-advance
    if (bestLineIndex === songContext.currentLineIndex) {
      // Still on current line - check if we've reached the END of this line
      const currentLine = songContext.lines[songContext.currentLineIndex];
      const endTriggerInfo = getAdaptiveEndTrigger(currentLine);
      const normalizedEndTrigger = normalizeText(endTriggerInfo.triggerText);
      
      // Check if buffer contains the end trigger words (last 40% of current line)
      const endMatchScore = compareTwoStrings(normalizedEndBuffer, normalizedEndTrigger);
      result.endTriggerScore = endMatchScore;

      // Hybrid trigger: also consider next-line confidence
      let nextLineConfidence = 0;
      const nextLineIndex = songContext.currentLineIndex + 1;
      if (nextLineIndex < songContext.lines.length) {
        const nextLine = songContext.lines[nextLineIndex];
        const normalizedNextLine = normalizeText(nextLine);
        const nextFullSimilarity = compareTwoStrings(normalizedBuffer, normalizedNextLine);
        const nextEndSimilarity = compareTwoStrings(normalizedEndBuffer, normalizedNextLine);
        nextLineConfidence = Math.min(1.0, Math.max(nextFullSimilarity, nextEndSimilarity * 1.2));
        result.nextLineConfidence = nextLineConfidence;
      }

      const endTriggerStrong = endMatchScore >= END_TRIGGER_THRESHOLD;
      const endTriggerSupported =
        endMatchScore >= END_TRIGGER_SECONDARY_THRESHOLD &&
        nextLineConfidence >= NEXT_LINE_SUPPORT_THRESHOLD;
      
      if (config.debug) {
        console.log(
          `[MATCHER] ✅ MATCH FOUND: Line ${bestLineIndex} @ ${(bestScore * 100).toFixed(1)}% (current line)`
        );
        console.log(
          `[MATCHER] 🎯 End-of-line (${endTriggerInfo.mode}): "${endTriggerInfo.triggerText}" (${endTriggerInfo.triggerWords}/${endTriggerInfo.totalWords} words) → ${(endMatchScore * 100).toFixed(1)}%`
        );
        if (nextLineConfidence > 0) {
          console.log(
            `[MATCHER] 🔁 Next-line confidence: ${(nextLineConfidence * 100).toFixed(1)}%`
          );
        }
      }
      
      if (endTriggerStrong || endTriggerSupported) {
        // We've reached the END of this line - advance immediately!
        result.isLineEnd = true;
        result.nextLineIndex = songContext.currentLineIndex + 1;
        result.advanceReason = 'end-words';
        
        if (config.debug) {
          console.log(
            `[MATCHER] 🎯 END-OF-LINE DETECTED: "${endTriggerInfo.triggerText}" @ ${(endMatchScore * 100).toFixed(1)}% - advancing to next line (${result.nextLineIndex})`
          );
        }
      } else {
        // Still singing this line, not at the end yet
        result.isLineEnd = false;
        if (config.debug) {
          console.log(
            `[MATCHER] Still on current line (end match: ${(endMatchScore * 100).toFixed(1)}% < ${(END_TRIGGER_THRESHOLD * 100).toFixed(0)}%)`
          );
        }
      }
    } else {
      // Moved to next line(s) - original logic: next line already detected
      result.isLineEnd = true;
      result.nextLineIndex = bestLineIndex;
      result.advanceReason = 'next-line';
      if (config.debug) {
        console.log(
          `[MATCHER] ✅ MATCH FOUND: Line ${bestLineIndex} @ ${(bestScore * 100).toFixed(1)}% (next-line detected, advancing from ${songContext.currentLineIndex})`
        );
        console.log(
          `[MATCHER] isLineEnd=true because bestLineIndex (${bestLineIndex}) > currentLineIndex (${songContext.currentLineIndex}) - transition detected`
        );
      }
    }
  } else if (bestLineIndex === songContext.currentLineIndex) {
    // Allow end-trigger to advance even if overall confidence is lower
    const currentLine = songContext.lines[songContext.currentLineIndex];
    const endTriggerInfo = getAdaptiveEndTrigger(currentLine);
    const normalizedEndTrigger = normalizeText(endTriggerInfo.triggerText);
    const endMatchScore = compareTwoStrings(normalizedEndBuffer, normalizedEndTrigger);

    let nextLineConfidence = 0;
    const nextLineIndex = songContext.currentLineIndex + 1;
    if (nextLineIndex < songContext.lines.length) {
      const nextLine = songContext.lines[nextLineIndex];
      const normalizedNextLine = normalizeText(nextLine);
      const nextFullSimilarity = compareTwoStrings(normalizedBuffer, normalizedNextLine);
      const nextEndSimilarity = compareTwoStrings(normalizedEndBuffer, normalizedNextLine);
      nextLineConfidence = Math.min(1.0, Math.max(nextFullSimilarity, nextEndSimilarity * 1.2));
    }

    const endTriggerStrong = endMatchScore >= END_TRIGGER_THRESHOLD;
    const endTriggerSupported =
      endMatchScore >= END_TRIGGER_SECONDARY_THRESHOLD &&
      nextLineConfidence >= NEXT_LINE_SUPPORT_THRESHOLD;

    if ((endTriggerStrong || endTriggerSupported) && bestScore >= END_TRIGGER_MATCH_GATE) {
      result.matchFound = true;
      result.currentLineIndex = bestLineIndex;
      result.confidence = bestScore;
      result.matchedText = matchedLineText;
      result.wasForwardProgress = true;
      result.isLineEnd = true;
      result.nextLineIndex = songContext.currentLineIndex + 1;
      result.advanceReason = 'end-words';
      result.endTriggerScore = endMatchScore;
      result.nextLineConfidence = nextLineConfidence;

      if (config.debug) {
        console.log(
          `[MATCHER] 🎯 END-TRIGGER OVERRIDE: line ${bestLineIndex} @ ${(bestScore * 100).toFixed(1)}% (end match ${(endMatchScore * 100).toFixed(1)}%)`
        );
      }
    } else if (config.debug) {
      console.log(`[MATCHER] ❌ No match (best: ${(bestScore * 100).toFixed(1)}%)`);
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
  // Prefer pre-split lines when provided (e.g., from Supabase fetch)
  // Fallback to parsing full lyrics if lines are missing
  const lines =
    songData.lines && songData.lines.length > 0
      ? songData.lines
      : splitLyricsIntoLines(songData.lyrics || '');

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
    lookAheadWindow: Math.max(1, config.lookAheadWindow ?? DEFAULT_CONFIG.lookAheadWindow ?? 3),
    allowBackward: config.allowBackward ?? DEFAULT_CONFIG.allowBackward,
  };
}

/**
 * Find best match across ALL songs in the setlist (Adaptive Live Mode)
 * 
 * Optimization Strategy:
 * 1. Check current song FIRST (Priority 1) - most common case
 * 2. Only check other songs if current song confidence is LOW (< 60%)
 * 3. Use higher threshold for song switches (0.85+) to prevent false positives
 * 
 * This prevents expensive multi-song scanning when the singer is on-track.
 */
export function findBestMatchAcrossAllSongs(
  buffer: string,
  currentSongContext: SongContext,
  allSongs: SongData[],
  currentSongIndex: number,
  config: MatcherConfig = DEFAULT_CONFIG
): MultiSongMatchResult {
  const result: MultiSongMatchResult = {
    currentSongMatch: findBestMatch(buffer, currentSongContext, config),
  };

  // OPTIMIZATION: If current song has good confidence, don't check others
  // This is the 90% case - singer is on the right song
  const SONG_SWITCH_MIN_CONFIDENCE = 0.50; // LOWERED: Auto-switch at 50%+ (user requested)
  const CURRENT_SONG_LOW_CONFIDENCE = 0.6; // Only check others if current < 60%

  if (result.currentSongMatch.confidence >= CURRENT_SONG_LOW_CONFIDENCE) {
    // Current song is matching well, no need to check others
    if (config.debug) {
      console.log(
        `[MULTI-SONG] Current song confidence ${(result.currentSongMatch.confidence * 100).toFixed(1)}% is good (>60%), skipping other songs`
      );
    }
    return result;
  }

  if (config.debug) {
    console.log(
      `[MULTI-SONG] Current song confidence ${(result.currentSongMatch.confidence * 100).toFixed(1)}% is low (<60%), checking other songs...`
    );
  }

  // Check all OTHER songs for better matches
  let bestOtherSongScore = 0;
  let bestOtherSongIndex = -1;
  let bestOtherSongLineIndex = -1;
  let bestOtherSongLineText = '';

  for (let i = 0; i < allSongs.length; i++) {
    // Skip current song (already checked)
    if (i === currentSongIndex) continue;

    const song = allSongs[i];
    const lines = song.lines && song.lines.length > 0 
      ? song.lines 
      : splitLyricsIntoLines(song.lyrics || '');

    if (lines.length === 0) continue;

    // Check this song (look at first few lines only for efficiency)
    const lookAheadLines = Math.min(5, lines.length); // Only check first 5 lines
    const normalizedBuffer = normalizeText(buffer);

    for (let lineIdx = 0; lineIdx < lookAheadLines; lineIdx++) {
      const line = lines[lineIdx];
      const normalizedLine = normalizeText(line);
      const similarity = compareTwoStrings(normalizedBuffer, normalizedLine);

      if (similarity > bestOtherSongScore) {
        bestOtherSongScore = similarity;
        bestOtherSongIndex = i;
        bestOtherSongLineIndex = lineIdx;
        bestOtherSongLineText = line;
      }

      if (config.debug) {
        console.log(
          `[MULTI-SONG] Song ${i} ("${song.title}") Line ${lineIdx}: ${(similarity * 100).toFixed(1)}%`
        );
      }
    }
  }

  // Only suggest song switch if confidence is reasonable (50%+) - debouncing prevents false positives
  if (bestOtherSongScore >= SONG_SWITCH_MIN_CONFIDENCE) {
    const suggestedSong = allSongs[bestOtherSongIndex];
    result.suggestedSongSwitch = {
      songId: suggestedSong.id,
      songTitle: suggestedSong.title,
      songIndex: bestOtherSongIndex,
      confidence: bestOtherSongScore,
      matchedLine: bestOtherSongLineText,
      matchedLineIndex: bestOtherSongLineIndex,
    };

    if (config.debug) {
      console.log(
        `[MULTI-SONG] 🎵 SONG SWITCH DETECTED: "${suggestedSong.title}" @ ${(bestOtherSongScore * 100).toFixed(1)}%`
      );
    }
  } else if (bestOtherSongScore >= 0.6) {
    // Any reasonable confidence (50%+) - auto-switch after debouncing
    const suggestedSong = allSongs[bestOtherSongIndex];
    result.suggestedSongSwitch = {
      songId: suggestedSong.id,
      songTitle: suggestedSong.title,
      songIndex: bestOtherSongIndex,
      confidence: bestOtherSongScore,
      matchedLine: bestOtherSongLineText,
      matchedLineIndex: bestOtherSongLineIndex,
    };

    if (config.debug) {
      console.log(
        `[MULTI-SONG] 🤔 Possible song switch to "${suggestedSong.title}" @ ${(bestOtherSongScore * 100).toFixed(1)}% (medium confidence)`
      );
    }
  } else {
    if (config.debug) {
      console.log(
        `[MULTI-SONG] No strong match in other songs (best: ${(bestOtherSongScore * 100).toFixed(1)}%)`
      );
    }
  }

  return result;
}
