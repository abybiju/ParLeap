/** Console rendering for harness reports. Zero dependencies. */

import type { Report } from './types.ts';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function renderReport(report: Report, verbose = false): string {
  const lines: string[] = [];
  const rule = '─'.repeat(64);

  lines.push(rule);
  lines.push(`Matcher: ${report.matcher}`);
  lines.push(
    `Catalog: ${report.catalogSize} songs | queries: ` +
      `${report.counts.genuine} genuine, ${report.counts.imposter} imposter, ${report.counts.probe} probe`
  );
  lines.push(rule);
  lines.push(`MRR    ${report.mrr.toFixed(3)}`);
  lines.push(`Top-1  ${pct(report.top1)}   Top-3  ${pct(report.top3)}   Top-10 ${pct(report.top10)}`);
  lines.push(`Separation margin  ${report.separationMargin.toFixed(4)}`);
  if (report.operatingPoint) {
    const op = report.operatingPoint;
    lines.push(
      `Operating point    τ=${op.tau.toFixed(4)}  FAR=${pct(op.far)}  FRR=${pct(op.frr)}`
    );
  } else {
    lines.push('Operating point    none (no threshold meets the FRR constraint)');
  }
  lines.push(rule);
  lines.push('GATES');
  for (const g of report.gates) {
    const mark = g.pass ? 'PASS' : 'FAIL';
    lines.push(`  [${mark}] ${g.name.padEnd(24)} target ${g.target.padEnd(9)} actual ${g.actual}`);
  }
  lines.push(rule);
  lines.push(
    report.allGatesPass
      ? 'ALL GATES PASS'
      : 'GATES FAILED — matcher is not shippable against this test set'
  );

  if (report.probes.length > 0) {
    lines.push(rule);
    lines.push('PROBES');
    for (const p of report.probes) {
      const mark = p.pass ? 'ok  ' : 'FAIL';
      const detail =
        p.sourceRank !== null
          ? `source rank ${p.sourceRank}`
          : `top-1 score ${p.top1Score.toFixed(3)}`;
      lines.push(`  [${mark}] ${p.probeKind.padEnd(10)} ${p.file} (${detail})`);
    }
  }

  if (verbose) {
    lines.push(rule);
    lines.push('PER QUERY');
    for (const q of report.perQuery) {
      const rank = q.correctRank === null ? '-' : String(q.correctRank);
      lines.push(
        `  ${q.type.padEnd(8)} ${q.file}  expected=${q.expected ?? '-'}  ` +
          `top1=${q.top1 ?? '-'} (${q.top1Score.toFixed(3)})  rank=${rank}`
      );
    }
  }

  lines.push(rule);
  return lines.join('\n');
}
