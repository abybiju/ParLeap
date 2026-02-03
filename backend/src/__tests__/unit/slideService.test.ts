/**
 * Slide Service Tests
 */

import {
  parseLyricLines,
  compileSlides,
  mergeSlideConfig,
  autoFormatSlides,
  type SlideConfig,
} from '../../services/slideService';

describe('slideService', () => {
  describe('parseLyricLines', () => {
    it('should parse lyrics into non-empty lines', () => {
      const lyrics = 'Line 1\nLine 2\n\nLine 3';
      const lines = parseLyricLines(lyrics);
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should normalize line endings', () => {
      const lyrics = 'Line 1\r\nLine 2\r\nLine 3';
      const lines = parseLyricLines(lyrics);
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should filter empty lines', () => {
      const lyrics = 'Line 1\n\n\nLine 2';
      const lines = parseLyricLines(lyrics);
      expect(lines).toEqual(['Line 1', 'Line 2']);
    });
  });

  describe('mergeSlideConfig', () => {
    it('should merge song config with event override', () => {
      const songConfig: SlideConfig = {
        linesPerSlide: 3,
        respectStanzaBreaks: true,
        manualBreaks: [5],
      };
      const eventOverride: SlideConfig = {
        linesPerSlide: 4,
        manualBreaks: [7],
      };
      const merged = mergeSlideConfig(songConfig, eventOverride);
      expect(merged.linesPerSlide).toBe(4); // Event override wins
      expect(merged.respectStanzaBreaks).toBe(true); // From song config
      expect(merged.manualBreaks).toEqual([7]); // Event override wins
    });

    it('should use defaults when configs are empty', () => {
      const merged = mergeSlideConfig(undefined, undefined);
      expect(merged.linesPerSlide).toBe(4);
      expect(merged.respectStanzaBreaks).toBe(true);
      expect(merged.manualBreaks).toEqual([]);
    });
  });

  describe('compileSlides', () => {
    it('should compile slides with default config', () => {
      const lyrics = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
      const config = mergeSlideConfig(undefined, undefined);
      const result = compileSlides(lyrics, config);
      
      expect(result.lines.length).toBe(6);
      expect(result.slides.length).toBe(2); // 6 lines / 4 per slide = 2 slides
      expect(result.slides[0].lines).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4']);
      expect(result.slides[1].lines).toEqual(['Line 5', 'Line 6']);
    });

    it('should respect manual breaks', () => {
      const lyrics = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const config = mergeSlideConfig(undefined, {
        linesPerSlide: 4,
        manualBreaks: [1], // Break after line 1
      });
      const result = compileSlides(lyrics, config);
      
      expect(result.slides.length).toBe(2);
      expect(result.slides[0].lines).toEqual(['Line 1', 'Line 2']); // Break at line 1
      expect(result.slides[1].lines).toEqual(['Line 3', 'Line 4', 'Line 5']);
    });

    it('should create lineToSlideIndex mapping', () => {
      const lyrics = 'Line 1\nLine 2\nLine 3\nLine 4';
      const config = mergeSlideConfig(undefined, { linesPerSlide: 2 });
      const result = compileSlides(lyrics, config);
      
      expect(result.lineToSlideIndex).toEqual([0, 0, 1, 1]); // Lines 0-1 map to slide 0, lines 2-3 map to slide 1
    });

    it('should handle empty lyrics', () => {
      const config = mergeSlideConfig(undefined, undefined);
      const result = compileSlides('', config);
      
      expect(result.lines.length).toBe(0);
      expect(result.slides.length).toBe(0);
      expect(result.lineToSlideIndex.length).toBe(0);
    });
  });

  describe('autoFormatSlides', () => {
    it('should return sensible defaults', () => {
      const config = autoFormatSlides('test lyrics', 4);
      expect(config.linesPerSlide).toBe(4);
      expect(config.respectStanzaBreaks).toBe(true);
      expect(config.manualBreaks).toEqual([]);
    });
  });
});
