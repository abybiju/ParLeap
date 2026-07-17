/**
 * FROZEN verbatim copy of backend/src/services/dtwService.ts (v2 matcher).
 *
 * Copied on purpose, not imported: this is the failing baseline every v3
 * candidate must beat, and it must keep working even after the v2 services
 * are torn out of the backend (Phase 4). Do not "fix" or improve this file.
 */

export function dtwDistance(seq1: number[], seq2: number[]): number {
  const n = seq1.length;
  const m = seq2.length;

  if (n === 0 || m === 0) return Infinity;

  let prev = new Float64Array(m + 1);
  let curr = new Float64Array(m + 1);

  prev[0] = 0;
  for (let j = 1; j <= m; j++) {
    prev[j] = Infinity;
  }

  for (let i = 1; i <= n; i++) {
    curr[0] = Infinity;
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(seq1[i - 1] - seq2[j - 1]);
      curr[j] = cost + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  const pathLength = Math.sqrt(n * m);
  return prev[m] / pathLength;
}

export function subsequenceDtwDistance(
  query: number[],
  reference: number[]
): number {
  const n = query.length;
  const m = reference.length;

  if (n === 0 || m === 0) return Infinity;

  if (n >= m) return dtwDistance(query, reference);

  let prev = new Float64Array(m + 1);
  let curr = new Float64Array(m + 1);

  prev.fill(0);

  for (let i = 1; i <= n; i++) {
    curr[0] = Infinity;
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(query[i - 1] - reference[j - 1]);
      curr[j] = cost + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  let minDist = Infinity;
  for (let j = 1; j <= m; j++) {
    if (prev[j] < minDist) minDist = prev[j];
  }

  return minDist / n;
}

export function distanceToSimilarity(distance: number, scale: number = 1.0): number {
  if (!isFinite(distance) || distance < 0) return 0;
  return Math.exp(-distance / scale);
}

export interface DtwMatchCandidate {
  index: number;
  distance: number;
  similarity: number;
}

export function matchAgainstCatalog(
  queryIntervals: number[],
  catalog: { intervals: number[] }[],
  options: {
    threshold?: number;
    limit?: number;
    useSubsequence?: boolean;
  } = {}
): DtwMatchCandidate[] {
  const { threshold = 0.3, limit = 5, useSubsequence = true } = options;

  const results: DtwMatchCandidate[] = [];

  for (let i = 0; i < catalog.length; i++) {
    const ref = catalog[i].intervals;
    if (!ref || ref.length < 3) continue;

    const distance = useSubsequence
      ? subsequenceDtwDistance(queryIntervals, ref)
      : dtwDistance(queryIntervals, ref);

    const similarity = distanceToSimilarity(distance);

    if (similarity >= threshold) {
      results.push({ index: i, distance, similarity });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, limit);
}
