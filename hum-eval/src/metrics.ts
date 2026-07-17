/**
 * Retrieval metrics for QbH evaluation, following MIREX QBSH practice:
 * MRR + Top-K hit rates on genuine queries, open-set FAR/FRR against
 * imposter queries, and a score-separation margin.
 *
 * The separation margin is the direct detector for v2's failure mode
 * (every song scoring 87–97% regardless of input → margin ≤ 0).
 */

import type {
  EvaluatedQuery,
  GateResult,
  OperatingPoint,
  RankedCandidate,
} from './types.ts';

/** 1-based rank of `songId` in a ranked list, or null if absent. */
export function rankOf(ranked: RankedCandidate[], songId: string): number | null {
  const idx = ranked.findIndex((c) => c.songId === songId);
  return idx === -1 ? null : idx + 1;
}

export function scoreOf(ranked: RankedCandidate[], songId: string): number | null {
  const hit = ranked.find((c) => c.songId === songId);
  return hit ? hit.score : null;
}

/** Mean reciprocal rank over genuine queries (absent correct song counts 0). */
export function mrr(genuine: EvaluatedQuery[]): number {
  if (genuine.length === 0) return 0;
  let sum = 0;
  for (const q of genuine) {
    const rank = q.meta.songId ? rankOf(q.ranked, q.meta.songId) : null;
    if (rank !== null) sum += 1 / rank;
  }
  return sum / genuine.length;
}

/** Fraction of genuine queries whose correct song ranks within top k. */
export function topK(genuine: EvaluatedQuery[], k: number): number {
  if (genuine.length === 0) return 0;
  let hits = 0;
  for (const q of genuine) {
    const rank = q.meta.songId ? rankOf(q.ranked, q.meta.songId) : null;
    if (rank !== null && rank <= k) hits++;
  }
  return hits / genuine.length;
}

/** Linear-interpolated percentile (p in [0,1]) of an unsorted array. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * median(correct-song scores) − p95(wrong-song scores), over genuine queries.
 * A matcher that cannot discriminate produces a margin ≤ 0.
 */
export function separationMargin(genuine: EvaluatedQuery[]): number {
  const correct: number[] = [];
  const wrong: number[] = [];
  for (const q of genuine) {
    for (const c of q.ranked) {
      if (q.meta.songId && c.songId === q.meta.songId) correct.push(c.score);
      else wrong.push(c.score);
    }
  }
  if (correct.length === 0 || wrong.length === 0) return -Infinity;
  return percentile(correct, 0.5) - percentile(wrong, 0.95);
}

export interface SweepPoint {
  tau: number;
  far: number;
  frr: number;
}

/**
 * Threshold sweep over top-1 scores.
 * FRR(τ) = fraction of genuine queries rejected (top-1 wrong OR top-1 score < τ).
 * FAR(τ) = fraction of imposter queries accepted (top-1 score ≥ τ).
 */
export function farFrrSweep(
  genuine: EvaluatedQuery[],
  imposters: EvaluatedQuery[]
): SweepPoint[] {
  const taus = new Set<number>();
  for (const q of [...genuine, ...imposters]) {
    if (q.ranked.length > 0) taus.add(q.ranked[0].score);
  }
  taus.add(0);
  const sorted = [...taus].sort((a, b) => a - b);

  return sorted.map((tau) => {
    let rejectedGenuine = 0;
    for (const q of genuine) {
      const top = q.ranked[0];
      const accepted =
        top !== undefined && top.score >= tau && top.songId === q.meta.songId;
      if (!accepted) rejectedGenuine++;
    }
    let acceptedImposters = 0;
    for (const q of imposters) {
      const top = q.ranked[0];
      if (top !== undefined && top.score >= tau) acceptedImposters++;
    }
    return {
      tau,
      frr: genuine.length === 0 ? 1 : rejectedGenuine / genuine.length,
      far: imposters.length === 0 ? NaN : acceptedImposters / imposters.length,
    };
  });
}

/**
 * Best operating point: minimum FAR among thresholds where FRR ≤ maxFrr
 * (ties broken toward the higher threshold). Null when imposters are missing
 * or no threshold satisfies the FRR constraint.
 */
export function operatingPoint(
  sweep: SweepPoint[],
  maxFrr: number
): OperatingPoint | null {
  let best: OperatingPoint | null = null;
  for (const pt of sweep) {
    if (Number.isNaN(pt.far)) continue;
    if (pt.frr > maxFrr) continue;
    if (
      best === null ||
      pt.far < best.far ||
      (pt.far === best.far && pt.tau > best.tau)
    ) {
      best = { tau: pt.tau, far: pt.far, frr: pt.frr };
    }
  }
  return best;
}

export interface GateInputs {
  top1: number;
  top3: number;
  mrr: number;
  separationMargin: number;
  operatingPoint: OperatingPoint | null;
  imposterCount: number;
}

/** Ship gates from HUM_SEARCH_V3_PLAN.md §4 Phase 2. */
export const GATE_TARGETS = {
  top1: 0.8,
  top3: 0.9,
  mrr: 0.85,
  maxFar: 0.05,
  maxFrr: 0.15,
} as const;

export function evaluateGates(inputs: GateInputs): GateResult[] {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const gates: GateResult[] = [
    {
      name: 'Top-1 accuracy',
      target: `≥ ${pct(GATE_TARGETS.top1)}`,
      actual: pct(inputs.top1),
      pass: inputs.top1 >= GATE_TARGETS.top1,
    },
    {
      name: 'Top-3 accuracy',
      target: `≥ ${pct(GATE_TARGETS.top3)}`,
      actual: pct(inputs.top3),
      pass: inputs.top3 >= GATE_TARGETS.top3,
    },
    {
      name: 'MRR',
      target: `≥ ${GATE_TARGETS.mrr}`,
      actual: inputs.mrr.toFixed(3),
      pass: inputs.mrr >= GATE_TARGETS.mrr,
    },
    {
      name: `FAR at FRR ≤ ${pct(GATE_TARGETS.maxFrr)}`,
      target: `≤ ${pct(GATE_TARGETS.maxFar)}`,
      actual:
        inputs.imposterCount === 0
          ? 'no imposter queries'
          : inputs.operatingPoint === null
            ? 'no viable threshold'
            : pct(inputs.operatingPoint.far),
      pass:
        inputs.imposterCount > 0 &&
        inputs.operatingPoint !== null &&
        inputs.operatingPoint.far <= GATE_TARGETS.maxFar,
    },
    {
      name: 'Separation margin',
      target: '> 0',
      actual: Number.isFinite(inputs.separationMargin)
        ? inputs.separationMargin.toFixed(4)
        : String(inputs.separationMargin),
      pass: inputs.separationMargin > 0,
    },
  ];
  return gates;
}
