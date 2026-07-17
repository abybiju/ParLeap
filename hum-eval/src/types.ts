/**
 * Shared types for the hum-to-search evaluation harness.
 *
 * The harness is matcher-agnostic: v2 baseline, v3 candidates, and synthetic
 * self-test matchers all implement `Matcher` and are measured identically.
 */

export type QueryType = 'genuine' | 'imposter' | 'probe';

export type ProbeKind = 'noise' | 'monotone' | 'transposed' | 'stretched';

export interface QueryMeta {
  /** Path to the WAV file, relative to the manifest's directory. */
  file: string;
  type: QueryType;
  /** Ground-truth song for genuine queries. */
  songId?: string;
  /** For probes only. */
  probeKind?: ProbeKind;
  /** For transposed/stretched probes: the song that must still match. */
  sourceSongId?: string;
  section?: string;
  hummer?: string;
  take?: number;
  /** MediaTrackSettings captured at record time (echoCancellation etc.). */
  captureSettings?: Record<string, unknown>;
}

export interface ManifestSong {
  id: string;
  title: string;
}

export interface Manifest {
  version: 1;
  songs: ManifestSong[];
  queries: QueryMeta[];
}

export interface RankedCandidate {
  songId: string;
  score: number;
}

export interface Matcher {
  name: string;
  /**
   * Score the query against the whole catalog.
   * Must return one entry per catalog song (best first). Returning all
   * scores — not just top-N — is required for separation-margin and FAR
   * computation.
   */
  match(queryWavPath: string, meta: QueryMeta): Promise<RankedCandidate[]>;
}

export interface EvaluatedQuery {
  meta: QueryMeta;
  ranked: RankedCandidate[];
}

export interface GateResult {
  name: string;
  target: string;
  actual: string;
  pass: boolean;
}

export interface OperatingPoint {
  tau: number;
  far: number;
  frr: number;
}

export interface ProbeOutcome {
  file: string;
  probeKind: ProbeKind;
  /** noise/monotone: top-1 score (should fall below the operating threshold). */
  top1Score: number;
  /** transposed/stretched: rank of the source song (should be 1). */
  sourceRank: number | null;
  pass: boolean;
}

export interface Report {
  matcher: string;
  catalogSize: number;
  counts: { genuine: number; imposter: number; probe: number };
  mrr: number;
  top1: number;
  top3: number;
  top10: number;
  separationMargin: number;
  operatingPoint: OperatingPoint | null;
  gates: GateResult[];
  allGatesPass: boolean;
  probes: ProbeOutcome[];
  perQuery: {
    file: string;
    type: QueryType;
    expected: string | null;
    top1: string | null;
    top1Score: number;
    correctRank: number | null;
  }[];
}
