/**
 * Dynamic Time Warping (DTW) Service
 *
 * Compares pitch interval sequences for hum-to-search matching.
 * DTW naturally handles tempo differences — a slow hum matches a fast original.
 * Interval sequences (semitone deltas) are already key-invariant.
 *
 * For a catalog of ~2000 songs, brute-force DTW runs in milliseconds.
 */

/**
 * Compute DTW distance between two sequences.
 * Uses a cost matrix with Euclidean distance on individual elements.
 * Returns the normalized distance (lower = more similar).
 */
export function dtwDistance(seq1: number[], seq2: number[]): number {
  const n = seq1.length;
  const m = seq2.length;

  if (n === 0 || m === 0) return Infinity;

  // Use a 2-row rolling array to save memory (O(m) instead of O(n*m))
  let prev = new Float64Array(m + 1);
  let curr = new Float64Array(m + 1);

  // Initialize first row
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
    // Swap rows
    [prev, curr] = [curr, prev];
  }

  // Normalize by path length (geometric mean of sequence lengths)
  const pathLength = Math.sqrt(n * m);
  return prev[m] / pathLength;
}

/**
 * Subsequence DTW — find the best matching window of `query` within `reference`.
 * Useful when the user hums a chorus but the reference is the full song.
 * Returns the best (lowest) normalized distance.
 */
export function subsequenceDtwDistance(
  query: number[],
  reference: number[]
): number {
  const n = query.length;
  const m = reference.length;

  if (n === 0 || m === 0) return Infinity;

  // If query is longer than reference, use standard DTW
  if (n >= m) return dtwDistance(query, reference);

  // Subsequence DTW: allow free start position in reference
  // Initialize first row to 0 (can start matching anywhere in reference)
  let prev = new Float64Array(m + 1);
  let curr = new Float64Array(m + 1);

  // Free start: cost of starting at any position in reference is 0
  prev.fill(0);

  for (let i = 1; i <= n; i++) {
    curr[0] = Infinity;
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(query[i - 1] - reference[j - 1]);
      curr[j] = cost + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  // Find the minimum in the last row (best ending position)
  let minDist = Infinity;
  for (let j = 1; j <= m; j++) {
    if (prev[j] < minDist) minDist = prev[j];
  }

  // Normalize by query length (since we're matching a subsequence)
  return minDist / n;
}

/**
 * Convert a DTW distance to a similarity score in [0, 1].
 * Lower distance = higher similarity.
 *
 * Uses an exponential decay: similarity = exp(-distance / scale)
 * Scale controls how quickly similarity drops with distance.
 * For semitone intervals, a scale of ~2.0 works well:
 *   - distance 0 → similarity 1.0 (perfect match)
 *   - distance 1 → similarity ~0.61 (off by ~1 semitone per interval on average)
 *   - distance 2 → similarity ~0.37
 *   - distance 4 → similarity ~0.14
 */
export function distanceToSimilarity(distance: number, scale: number = 1.0): number {
  if (!isFinite(distance) || distance < 0) return 0;
  return Math.exp(-distance / scale);
}

/**
 * Match a query interval sequence against a list of reference sequences.
 * Returns results sorted by similarity (highest first).
 */
export interface DtwMatchCandidate {
  index: number;
  distance: number;
  similarity: number;
}

export function matchAgainstCatalog(
  queryIntervals: number[],
  catalog: { intervals: number[] }[],
  options: {
    threshold?: number; // Minimum similarity to include (default: 0.3)
    limit?: number;     // Max results (default: 5)
    useSubsequence?: boolean; // Use subsequence DTW (default: true)
  } = {}
): DtwMatchCandidate[] {
  const { threshold = 0.3, limit = 5, useSubsequence = true } = options;

  const results: DtwMatchCandidate[] = [];

  for (let i = 0; i < catalog.length; i++) {
    const ref = catalog[i].intervals;
    if (!ref || ref.length < 3) continue; // Skip entries with too few intervals

    const distance = useSubsequence
      ? subsequenceDtwDistance(queryIntervals, ref)
      : dtwDistance(queryIntervals, ref);

    const similarity = distanceToSimilarity(distance);

    if (similarity >= threshold) {
      results.push({ index: i, distance, similarity });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, limit);
}
