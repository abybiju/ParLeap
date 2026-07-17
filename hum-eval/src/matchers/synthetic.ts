/**
 * Synthetic matchers for harness self-validation.
 *
 * The harness itself must be proven before it can judge real matchers:
 *  - a matcher with genuine discrimination must PASS the gates
 *  - a matcher with v2's signature (all songs score 0.87–0.97 regardless of
 *    input) must FAIL the gates
 * If either self-test fails, the harness is broken — fix it before trusting
 * any real evaluation.
 */

import type { Matcher, QueryMeta, RankedCandidate } from '../types.ts';

/** Deterministic PRNG (mulberry32) so self-tests are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ranked(scores: Map<string, number>): RankedCandidate[] {
  return [...scores.entries()]
    .map(([songId, score]) => ({ songId, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * A matcher with real discrimination: the correct song scores high,
 * everything else (and every imposter/noise query) scores low.
 */
export function createPerfectMatcher(songIds: string[], seed = 42): Matcher {
  const rng = makeRng(seed);
  return {
    name: 'synthetic-perfect',
    async match(_path: string, meta: QueryMeta) {
      const scores = new Map<string, number>();
      const target =
        meta.type === 'genuine'
          ? meta.songId
          : meta.probeKind === 'transposed' || meta.probeKind === 'stretched'
            ? meta.sourceSongId
            : undefined;
      for (const id of songIds) {
        scores.set(
          id,
          id === target ? 0.88 + rng() * 0.08 : 0.3 + rng() * 0.12
        );
      }
      return ranked(scores);
    },
  };
}

/**
 * v2's exact failure signature: every song scores 0.87–0.97 no matter what
 * was hummed (or whether anything was hummed at all).
 */
export function createV2LikeMatcher(songIds: string[], seed = 42): Matcher {
  const rng = makeRng(seed);
  return {
    name: 'synthetic-v2-like (no discrimination)',
    async match(_path: string, _meta: QueryMeta) {
      const scores = new Map<string, number>();
      for (const id of songIds) scores.set(id, 0.87 + rng() * 0.1);
      return ranked(scores);
    },
  };
}
