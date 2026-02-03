/**
 * Slide Service
 * 
 * Compiles lyrics into multi-line slides based on configuration
 * Supports stanza-aware grouping, manual breaks, and per-event overrides
 */

export interface SlideConfig {
  linesPerSlide?: number; // Default: 4
  respectStanzaBreaks?: boolean; // Default: true
  manualBreaks?: number[]; // Line indices after which to force a break (0-indexed, non-empty lines only)
}

export interface CompiledSlide {
  lines: string[]; // Array of lines in this slide
  slideText: string; // Lines joined with \n
  startLineIndex: number; // First line index (0-indexed) in this slide
  endLineIndex: number; // Last line index (0-indexed) in this slide
}

export interface SlideCompilationResult {
  lines: string[]; // All non-empty lyric lines (for matching)
  slides: CompiledSlide[]; // Compiled slides
  lineToSlideIndex: number[]; // Mapping: lineIndex -> slideIndex
}

const DEFAULT_CONFIG: Required<SlideConfig> = {
  linesPerSlide: 4,
  respectStanzaBreaks: true,
  manualBreaks: [],
};

/**
 * Merge song default config with event override
 * Event override takes precedence
 */
export function mergeSlideConfig(
  songConfig: SlideConfig | null | undefined,
  eventOverride: SlideConfig | null | undefined
): Required<SlideConfig> {
  const merged: SlideConfig = {
    ...songConfig,
    ...eventOverride,
    // Manual breaks: merge arrays (event breaks override song breaks)
    manualBreaks: eventOverride?.manualBreaks ?? songConfig?.manualBreaks ?? [],
  };

  return {
    linesPerSlide: merged.linesPerSlide ?? DEFAULT_CONFIG.linesPerSlide,
    respectStanzaBreaks: merged.respectStanzaBreaks ?? DEFAULT_CONFIG.respectStanzaBreaks,
    manualBreaks: merged.manualBreaks ?? [],
  };
}

/**
 * Parse lyrics into non-empty lines
 * Normalizes line endings and filters empty/whitespace-only lines
 */
export function parseLyricLines(lyrics: string): string[] {
  return lyrics
    .replace(/\r\n/g, '\n') // Normalize line endings
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Split lyrics into stanzas (groups separated by blank lines)
 * Returns array of stanzas, each stanza is an array of line indices
 */
function findStanzas(lines: string[]): number[][] {
  const stanzas: number[][] = [];
  let currentStanza: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    // All lines are non-empty at this point, so we just group sequentially
    // In the future, we could detect stanza breaks from the original lyrics
    // For now, we treat all lines as one stanza unless manual breaks are specified
    currentStanza.push(i);
  }

  if (currentStanza.length > 0) {
    stanzas.push(currentStanza);
  }

  return stanzas;
}

/**
 * Detect stanza breaks from original lyrics text
 * Returns array of line indices where stanzas end (before the break)
 */
function detectStanzaBreaks(lyrics: string, nonEmptyLineIndices: number[]): number[] {
  const breaks: number[] = [];
  const normalized = lyrics.replace(/\r\n/g, '\n');
  const allLines = normalized.split('\n');
  
  let nonEmptyIndex = 0;
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    
    if (line.length === 0) {
      // Blank line - this is a stanza break
      // The previous non-empty line should be marked as a break point
      if (nonEmptyIndex > 0 && nonEmptyIndex <= nonEmptyLineIndices.length) {
        const prevLineIndex = nonEmptyLineIndices[nonEmptyIndex - 1];
        if (!breaks.includes(prevLineIndex)) {
          breaks.push(prevLineIndex);
        }
      }
    } else {
      // Non-empty line
      nonEmptyIndex++;
    }
  }

  return breaks;
}

/**
 * Compile lyrics into slides based on configuration
 */
export function compileSlides(
  lyrics: string,
  config: Required<SlideConfig>
): SlideCompilationResult {
  // 1. Parse into non-empty lines
  const lines = parseLyricLines(lyrics);
  
  if (lines.length === 0) {
    return {
      lines: [],
      slides: [],
      lineToSlideIndex: [],
    };
  }

  // 2. Detect stanza breaks if enabled
  const stanzaBreaks = config.respectStanzaBreaks
    ? detectStanzaBreaks(lyrics, lines.map((_, i) => i))
    : [];

  // 3. Combine stanza breaks with manual breaks
  const allBreakPoints = new Set<number>([
    ...stanzaBreaks,
    ...config.manualBreaks,
  ]);

  // 4. Build slides
  const slides: CompiledSlide[] = [];
  const lineToSlideIndex: number[] = new Array(lines.length);
  
  let currentSlideLines: string[] = [];
  let currentSlideStartIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    currentSlideLines.push(line);

    // Check if we should break here
    const shouldBreak =
      allBreakPoints.has(lineIndex) || // Manual/stanza break
      currentSlideLines.length >= config.linesPerSlide; // Max lines reached

    if (shouldBreak) {
      // Finalize current slide
      const slide: CompiledSlide = {
        lines: [...currentSlideLines],
        slideText: currentSlideLines.join('\n'),
        startLineIndex: currentSlideStartIndex,
        endLineIndex: lineIndex,
      };
      slides.push(slide);

      // Map all lines in this slide to this slide index
      for (let i = currentSlideStartIndex; i <= lineIndex; i++) {
        lineToSlideIndex[i] = slides.length - 1;
      }

      // Start new slide
      currentSlideLines = [];
      currentSlideStartIndex = lineIndex + 1;
    } else {
      // Continue current slide
      lineToSlideIndex[lineIndex] = slides.length; // Will be finalized next iteration or at end
    }
  }

  // Finalize last slide if it has content
  if (currentSlideLines.length > 0) {
    const slide: CompiledSlide = {
      lines: currentSlideLines,
      slideText: currentSlideLines.join('\n'),
      startLineIndex: currentSlideStartIndex,
      endLineIndex: lines.length - 1,
    };
    slides.push(slide);

    // Map remaining lines
    for (let i = currentSlideStartIndex; i < lines.length; i++) {
      lineToSlideIndex[i] = slides.length - 1;
    }
  }

  return {
    lines,
    slides,
    lineToSlideIndex,
  };
}

/**
 * Auto-format lyrics using "magic wand" algorithm
 * Applies sensible defaults: respect stanzas, group by linesPerSlide
 */
export function autoFormatSlides(
  lyrics: string,
  linesPerSlide: number = 4
): Required<SlideConfig> {
  return {
    linesPerSlide,
    respectStanzaBreaks: true,
    manualBreaks: [],
  };
}
