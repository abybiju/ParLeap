/**
 * Song metadata lookup via iTunes Search API (free, no API key).
 * Used to auto-fill artist (and optionally title) in the song editor.
 */

export interface SongMetadata {
  title: string;
  artist: string;
  album?: string;
}

export async function findSongMetadata(query: string): Promise<SongMetadata | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&media=music&entity=song&limit=1`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as { results?: Array<{ trackName?: string; artistName?: string; collectionName?: string }> };

    if (data.results && data.results.length > 0) {
      const song = data.results[0];
      const title = song.trackName?.trim();
      const artist = song.artistName?.trim();
      if (title && artist) {
        return {
          title,
          artist,
          album: song.collectionName?.trim(),
        };
      }
    }
    return null;
  } catch (e) {
    console.error('Metadata lookup failed', e);
    return null;
  }
}
