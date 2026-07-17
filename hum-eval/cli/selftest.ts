/**
 * Harness self-validation, runnable any time:
 *   node cli/selftest.ts
 *
 * Proves the harness can tell a real matcher from a broken one:
 *   - synthetic-perfect must PASS all gates
 *   - synthetic-v2-like (v2's "everything scores 87–97%" signature) must FAIL
 * Exits non-zero if either expectation is violated.
 */

import { runEvaluation } from '../src/harness.ts';
import { renderReport } from '../src/report.ts';
import {
  createPerfectMatcher,
  createV2LikeMatcher,
} from '../src/matchers/synthetic.ts';
import { buildSyntheticManifest } from '../src/syntheticManifest.ts';

const manifest = buildSyntheticManifest();
const songIds = manifest.songs.map((s) => s.id);

const perfect = await runEvaluation(createPerfectMatcher(songIds), manifest);
console.log(renderReport(perfect));
console.log();
const v2like = await runEvaluation(createV2LikeMatcher(songIds), manifest);
console.log(renderReport(v2like));
console.log();

let ok = true;
if (!perfect.allGatesPass) {
  console.error('SELF-TEST FAILED: the discriminating matcher should pass all gates.');
  ok = false;
}
if (v2like.allGatesPass) {
  console.error('SELF-TEST FAILED: the v2-like matcher must NOT pass the gates.');
  ok = false;
}
if (v2like.gates.some((g) => g.name === 'Separation margin' && g.pass)) {
  console.error('SELF-TEST FAILED: v2-like matcher must have non-positive separation margin.');
  ok = false;
}

console.log(
  ok
    ? 'Self-test OK: harness discriminates a working matcher from a v2-like one.'
    : 'Self-test FAILED — do not trust evaluation results until this is fixed.'
);
process.exit(ok ? 0 : 1);
