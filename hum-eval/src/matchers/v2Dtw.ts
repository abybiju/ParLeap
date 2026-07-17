/**
 * v2 baseline matcher adapter: WAV file → pitch-extraction service
 * (hum-embedding-service /extract-pitch) → interval sequence → frozen v2
 * DTW matching. This reproduces the shipped v2 pipeline so it can run as
 * the baseline row of every evaluation.
 *
 * Requires the Python service running (default http://localhost:8000) and a
 * reference catalog JSON produced by `npm run export:v2-fingerprints`.
 */

import fs from 'node:fs';
import type { Matcher, RankedCandidate } from '../types.ts';
import { matchAgainstCatalog } from './v2DtwCore.ts';

export interface V2Reference {
  songId: string;
  title: string;
  intervals: number[];
}

export interface V2DtwOptions {
  extractUrl?: string;
  /** v2 shipped with voiced_threshold=0.15 for hums. */
  voicedThreshold?: number;
}

interface ExtractResponse {
  interval_sequence: number[];
  num_voiced: number;
  method: string;
}

export function createV2DtwMatcher(
  references: V2Reference[],
  options: V2DtwOptions = {}
): Matcher {
  const {
    extractUrl = 'http://localhost:8000/extract-pitch',
    voicedThreshold = 0.15,
  } = options;

  return {
    name: 'v2-baseline (CREPE/pYIN + subsequence DTW)',
    async match(queryWavPath: string): Promise<RankedCandidate[]> {
      const wavBytes = fs.readFileSync(queryWavPath);
      const form = new FormData();
      form.append(
        'audio',
        new Blob([new Uint8Array(wavBytes)], { type: 'audio/wav' }),
        'query.wav'
      );

      const url = `${extractUrl}?voiced_threshold=${voicedThreshold}`;
      const res = await fetch(url, { method: 'POST', body: form });
      if (!res.ok) {
        throw new Error(
          `Pitch extraction failed (${res.status}): ${await res.text()}`
        );
      }
      const extraction = (await res.json()) as ExtractResponse;
      const intervals = extraction.interval_sequence ?? [];

      // threshold 0 + full limit: the harness needs scores for ALL songs,
      // not just the ones v2 would have shown to the user.
      const candidates = matchAgainstCatalog(
        intervals,
        references.map((r) => ({ intervals: r.intervals })),
        { threshold: 0, limit: references.length, useSubsequence: true }
      );

      const scored = new Map<string, number>();
      for (const c of candidates) {
        scored.set(references[c.index].songId, c.similarity);
      }
      // Songs skipped by v2 (too few intervals) still need a row: score 0.
      const ranked: RankedCandidate[] = references.map((r) => ({
        songId: r.songId,
        score: scored.get(r.songId) ?? 0,
      }));
      ranked.sort((a, b) => b.score - a.score);
      return ranked;
    },
  };
}

export function loadV2References(catalogPath: string): V2Reference[] {
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as unknown;
  if (!Array.isArray(raw)) throw new Error('Catalog JSON must be an array');
  return raw.map((r, i) => {
    const ref = r as Partial<V2Reference>;
    if (!ref.songId || !Array.isArray(ref.intervals)) {
      throw new Error(`Catalog entry ${i} needs songId and intervals[]`);
    }
    return { songId: ref.songId, title: ref.title ?? ref.songId, intervals: ref.intervals };
  });
}
