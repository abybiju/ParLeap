/**
 * Evaluate a matcher against a recorded test-set manifest.
 *
 * Usage:
 *   node cli/evaluate.ts --manifest testset/manifest.json --matcher v2dtw \
 *     --catalog testset/v2-fingerprints.json [--extract-url http://localhost:8000/extract-pitch] \
 *     [--out reports/v2-baseline.json] [--verbose]
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadManifest } from '../src/manifest.ts';
import { runEvaluation } from '../src/harness.ts';
import { renderReport } from '../src/report.ts';
import { createV2DtwMatcher, loadV2References } from '../src/matchers/v2Dtw.ts';
import type { Matcher } from '../src/types.ts';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' },
    matcher: { type: 'string', default: 'v2dtw' },
    catalog: { type: 'string' },
    'extract-url': { type: 'string' },
    out: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
});

if (!values.manifest) {
  console.error('Missing --manifest <path to manifest.json>');
  process.exit(2);
}

const manifest = loadManifest(values.manifest);
const baseDir = path.dirname(path.resolve(values.manifest));

let matcher: Matcher;
switch (values.matcher) {
  case 'v2dtw': {
    if (!values.catalog) {
      console.error('v2dtw needs --catalog <v2-fingerprints.json> (run: npm run export:v2-fingerprints)');
      process.exit(2);
    }
    matcher = createV2DtwMatcher(loadV2References(values.catalog), {
      extractUrl: values['extract-url'],
    });
    break;
  }
  default:
    console.error(`Unknown matcher: ${values.matcher} (available: v2dtw)`);
    process.exit(2);
}

const report = await runEvaluation(matcher, manifest, {
  baseDir,
  onProgress: (done, total, file) =>
    process.stderr.write(`\r[${done}/${total}] ${file.slice(0, 60).padEnd(60)}`),
});
process.stderr.write('\n');

console.log(renderReport(report, values.verbose));

if (values.out) {
  fs.mkdirSync(path.dirname(path.resolve(values.out)), { recursive: true });
  fs.writeFileSync(values.out, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${values.out}`);
}

process.exit(report.allGatesPass ? 0 : 1);
