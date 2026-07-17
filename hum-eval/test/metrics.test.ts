import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGates,
  farFrrSweep,
  mrr,
  operatingPoint,
  percentile,
  rankOf,
  separationMargin,
  topK,
} from '../src/metrics.ts';
import type { EvaluatedQuery, RankedCandidate } from '../src/types.ts';

function q(
  type: 'genuine' | 'imposter',
  songId: string | undefined,
  ranked: [string, number][]
): EvaluatedQuery {
  return {
    meta: { file: 'x.wav', type, songId },
    ranked: ranked.map(([id, score]) => ({ songId: id, score })),
  };
}

test('rankOf returns 1-based rank or null', () => {
  const ranked: RankedCandidate[] = [
    { songId: 'a', score: 0.9 },
    { songId: 'b', score: 0.5 },
  ];
  assert.equal(rankOf(ranked, 'a'), 1);
  assert.equal(rankOf(ranked, 'b'), 2);
  assert.equal(rankOf(ranked, 'zzz'), null);
});

test('mrr with known ranks', () => {
  const queries = [
    q('genuine', 'a', [['a', 0.9], ['b', 0.5]]), // rank 1
    q('genuine', 'b', [['a', 0.9], ['b', 0.5]]), // rank 2
    q('genuine', 'c', [['a', 0.9], ['b', 0.5]]), // absent → 0
  ];
  assert.ok(Math.abs(mrr(queries) - (1 + 0.5 + 0) / 3) < 1e-12);
});

test('topK with known ranks', () => {
  const queries = [
    q('genuine', 'a', [['a', 0.9], ['b', 0.5], ['c', 0.4]]),
    q('genuine', 'c', [['a', 0.9], ['b', 0.5], ['c', 0.4]]),
  ];
  assert.equal(topK(queries, 1), 0.5);
  assert.equal(topK(queries, 3), 1);
});

test('percentile interpolates linearly', () => {
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(percentile([10], 0.95), 10);
  assert.equal(percentile([0, 100], 0.25), 25);
});

test('separationMargin positive for discriminating scores, negative for v2-like', () => {
  const discriminating = [
    q('genuine', 'a', [['a', 0.9], ['b', 0.3], ['c', 0.35]]),
    q('genuine', 'b', [['b', 0.88], ['a', 0.32], ['c', 0.31]]),
  ];
  assert.ok(separationMargin(discriminating) > 0);

  const v2like = [
    q('genuine', 'a', [['b', 0.97], ['a', 0.92], ['c', 0.88]]),
    q('genuine', 'b', [['a', 0.96], ['c', 0.93], ['b', 0.89]]),
  ];
  assert.ok(separationMargin(v2like) <= 0);
});

test('farFrrSweep and operatingPoint find a separating threshold', () => {
  const genuine = [
    q('genuine', 'a', [['a', 0.9], ['b', 0.3]]),
    q('genuine', 'b', [['b', 0.85], ['a', 0.28]]),
  ];
  const imposters = [
    q('imposter', undefined, [['a', 0.4], ['b', 0.35]]),
    q('imposter', undefined, [['b', 0.45], ['a', 0.2]]),
  ];
  const sweep = farFrrSweep(genuine, imposters);
  const op = operatingPoint(sweep, 0.15);
  assert.ok(op !== null);
  assert.equal(op.far, 0);
  assert.equal(op.frr, 0);
  assert.ok(op.tau > 0.45 && op.tau <= 0.85);
});

test('operatingPoint is null when imposters always outscore the FRR constraint', () => {
  const genuine = [q('genuine', 'a', [['a', 0.9], ['b', 0.3]])];
  const imposters = [q('imposter', undefined, [['a', 0.95], ['b', 0.9]])];
  const op = operatingPoint(farFrrSweep(genuine, imposters), 0.15);
  // Any τ accepting the genuine query also accepts the imposter → FAR 1.
  assert.ok(op === null || op.far === 1);
});

test('gates fail without imposter queries', () => {
  const gates = evaluateGates({
    top1: 1,
    top3: 1,
    mrr: 1,
    separationMargin: 0.5,
    operatingPoint: null,
    imposterCount: 0,
  });
  const farGate = gates.find((g) => g.name.startsWith('FAR'));
  assert.ok(farGate);
  assert.equal(farGate.pass, false);
  assert.equal(farGate.actual, 'no imposter queries');
});
