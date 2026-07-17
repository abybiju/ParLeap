/**
 * Evaluation harness: runs one matcher over a manifest of queries and
 * produces a gated report. The harness owns no matching logic — it only
 * measures, so every matcher generation is judged identically.
 */

import path from 'node:path';
import type {
  EvaluatedQuery,
  Manifest,
  Matcher,
  ProbeOutcome,
  Report,
} from './types.ts';
import {
  evaluateGates,
  farFrrSweep,
  GATE_TARGETS,
  mrr,
  operatingPoint,
  rankOf,
  separationMargin,
  topK,
} from './metrics.ts';

export interface HarnessOptions {
  /** Directory that manifest file paths are relative to. */
  baseDir?: string;
  /** Called after each query completes (progress reporting). */
  onProgress?: (done: number, total: number, file: string) => void;
}

export async function runEvaluation(
  matcher: Matcher,
  manifest: Manifest,
  options: HarnessOptions = {}
): Promise<Report> {
  const { baseDir = '.', onProgress } = options;

  const evaluated: EvaluatedQuery[] = [];
  let done = 0;
  for (const meta of manifest.queries) {
    const wavPath = path.resolve(baseDir, meta.file);
    const ranked = await matcher.match(wavPath, meta);
    evaluated.push({ meta, ranked });
    done++;
    onProgress?.(done, manifest.queries.length, meta.file);
  }

  const genuine = evaluated.filter((q) => q.meta.type === 'genuine');
  const imposters = evaluated.filter((q) => q.meta.type === 'imposter');
  const probes = evaluated.filter((q) => q.meta.type === 'probe');

  const sweep = farFrrSweep(genuine, imposters);
  const op = operatingPoint(sweep, GATE_TARGETS.maxFrr);
  const margin = separationMargin(genuine);
  const top1 = topK(genuine, 1);
  const top3 = topK(genuine, 3);
  const top10 = topK(genuine, 10);
  const mrrValue = mrr(genuine);

  const probeOutcomes: ProbeOutcome[] = probes.map((q) => {
    const kind = q.meta.probeKind ?? 'noise';
    const top1Score = q.ranked[0]?.score ?? 0;
    if (kind === 'transposed' || kind === 'stretched') {
      const sourceRank = q.meta.sourceSongId
        ? rankOf(q.ranked, q.meta.sourceSongId)
        : null;
      return { file: q.meta.file, probeKind: kind, top1Score, sourceRank, pass: sourceRank === 1 };
    }
    // noise/monotone must fall below the operating threshold (i.e., be rejected)
    const rejected = op !== null ? top1Score < op.tau : false;
    return { file: q.meta.file, probeKind: kind, top1Score, sourceRank: null, pass: rejected };
  });

  const gates = evaluateGates({
    top1,
    top3,
    mrr: mrrValue,
    separationMargin: margin,
    operatingPoint: op,
    imposterCount: imposters.length,
  });

  return {
    matcher: matcher.name,
    catalogSize: manifest.songs.length,
    counts: {
      genuine: genuine.length,
      imposter: imposters.length,
      probe: probes.length,
    },
    mrr: mrrValue,
    top1,
    top3,
    top10,
    separationMargin: margin,
    operatingPoint: op,
    gates,
    allGatesPass: gates.every((g) => g.pass),
    probes: probeOutcomes,
    perQuery: evaluated.map((q) => ({
      file: q.meta.file,
      type: q.meta.type,
      expected: q.meta.songId ?? q.meta.sourceSongId ?? null,
      top1: q.ranked[0]?.songId ?? null,
      top1Score: q.ranked[0]?.score ?? 0,
      correctRank: q.meta.songId ? rankOf(q.ranked, q.meta.songId) : null,
    })),
  };
}
