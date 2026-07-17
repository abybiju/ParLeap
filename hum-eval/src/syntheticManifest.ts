/** Synthetic manifest used by the harness self-test (no audio files needed). */

import type { Manifest, QueryMeta } from './types.ts';

export function buildSyntheticManifest(): Manifest {
  const songs = Array.from({ length: 20 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return { id: `song${n}`, title: `Synthetic Song ${n}` };
  });

  const queries: QueryMeta[] = [];
  for (const song of songs) {
    for (let take = 1; take <= 2; take++) {
      queries.push({
        file: `synthetic/${song.id}__take${take}.wav`,
        type: 'genuine',
        songId: song.id,
        section: take === 1 ? 'chorus' : 'verse',
        hummer: 'synthetic',
        take,
      });
    }
  }
  for (let i = 1; i <= 10; i++) {
    queries.push({
      file: `synthetic/imposter${String(i).padStart(2, '0')}.wav`,
      type: 'imposter',
      hummer: 'synthetic',
    });
  }
  queries.push(
    { file: 'synthetic/probe_noise.wav', type: 'probe', probeKind: 'noise' },
    { file: 'synthetic/probe_monotone.wav', type: 'probe', probeKind: 'monotone' },
    {
      file: 'synthetic/probe_transposed.wav',
      type: 'probe',
      probeKind: 'transposed',
      sourceSongId: 'song01',
    },
    {
      file: 'synthetic/probe_stretched.wav',
      type: 'probe',
      probeKind: 'stretched',
      sourceSongId: 'song02',
    }
  );

  return { version: 1, songs, queries };
}
