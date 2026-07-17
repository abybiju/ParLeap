/** Manifest loading + validation (hand-rolled, zero dependencies). */

import fs from 'node:fs';
import type { Manifest, QueryMeta } from './types.ts';

const QUERY_TYPES = new Set(['genuine', 'imposter', 'probe']);
const PROBE_KINDS = new Set(['noise', 'monotone', 'transposed', 'stretched']);

export function validateManifest(data: unknown): Manifest {
  const errors: string[] = [];
  const m = data as Partial<Manifest>;

  if (m?.version !== 1) errors.push('version must be 1');
  if (!Array.isArray(m?.songs) || m.songs.length === 0) {
    errors.push('songs must be a non-empty array');
  } else {
    const ids = new Set<string>();
    m.songs.forEach((s, i) => {
      if (!s?.id || typeof s.id !== 'string') errors.push(`songs[${i}].id missing`);
      else if (ids.has(s.id)) errors.push(`songs[${i}].id duplicated: ${s.id}`);
      else ids.add(s.id);
      if (!s?.title) errors.push(`songs[${i}].title missing`);
    });

    if (Array.isArray(m.queries)) {
      m.queries.forEach((q: QueryMeta, i: number) => {
        if (!q?.file) errors.push(`queries[${i}].file missing`);
        if (!QUERY_TYPES.has(q?.type as string)) {
          errors.push(`queries[${i}].type invalid: ${String(q?.type)}`);
        }
        if (q?.type === 'genuine') {
          if (!q.songId) errors.push(`queries[${i}] genuine query needs songId`);
          else if (!ids.has(q.songId)) {
            errors.push(`queries[${i}].songId not in songs: ${q.songId}`);
          }
        }
        if (q?.type === 'probe') {
          if (!PROBE_KINDS.has(q.probeKind as string)) {
            errors.push(`queries[${i}].probeKind invalid: ${String(q.probeKind)}`);
          }
          if (
            (q.probeKind === 'transposed' || q.probeKind === 'stretched') &&
            (!q.sourceSongId || !ids.has(q.sourceSongId))
          ) {
            errors.push(`queries[${i}] ${q.probeKind} probe needs a valid sourceSongId`);
          }
        }
      });
    }
  }
  if (!Array.isArray(m?.queries) || m.queries.length === 0) {
    errors.push('queries must be a non-empty array');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid manifest:\n  - ${errors.join('\n  - ')}`);
  }
  return m as Manifest;
}

export function loadManifest(filePath: string): Manifest {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return validateManifest(JSON.parse(raw));
}
