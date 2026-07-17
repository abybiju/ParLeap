/**
 * The harness self-test as assertions: a discriminating matcher passes the
 * gates; a matcher with v2's no-discrimination signature fails them. If this
 * test ever breaks, the harness cannot be trusted to judge real matchers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEvaluation } from '../src/harness.ts';
import { buildSyntheticManifest } from '../src/syntheticManifest.ts';
import {
  createPerfectMatcher,
  createV2LikeMatcher,
} from '../src/matchers/synthetic.ts';

const manifest = buildSyntheticManifest();
const songIds = manifest.songs.map((s) => s.id);

test('discriminating matcher passes all gates', async () => {
  const report = await runEvaluation(createPerfectMatcher(songIds), manifest);
  assert.equal(report.counts.genuine, 40);
  assert.equal(report.counts.imposter, 10);
  assert.ok(report.top1 >= 0.8, `top1 was ${report.top1}`);
  assert.ok(report.mrr >= 0.85, `mrr was ${report.mrr}`);
  assert.ok(report.separationMargin > 0);
  assert.ok(report.operatingPoint !== null);
  assert.equal(report.allGatesPass, true, JSON.stringify(report.gates, null, 2));
  // transposed/stretched probes must still match their source song
  for (const p of report.probes) {
    assert.equal(p.pass, true, `probe ${p.probeKind} failed`);
  }
});

test('v2-like no-discrimination matcher fails the gates', async () => {
  const report = await runEvaluation(createV2LikeMatcher(songIds), manifest);
  assert.equal(report.allGatesPass, false);
  // Its exact published symptom: separation margin must be non-positive.
  assert.ok(
    report.separationMargin <= 0,
    `expected non-positive margin, got ${report.separationMargin}`
  );
  // With 20 songs and random ordering, top-1 must be far below the gate.
  assert.ok(report.top1 < 0.5, `top1 was ${report.top1}`);
});

test('probe outcomes are reported for noise and monotone probes', async () => {
  const report = await runEvaluation(createPerfectMatcher(songIds), manifest);
  const kinds = report.probes.map((p) => p.probeKind).sort();
  assert.deepEqual(kinds, ['monotone', 'noise', 'stretched', 'transposed']);
});
