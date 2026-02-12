export type ParsedImport = {
  title?: string;
  ccli?: string;
  artist?: string;
  lyrics: string;
};

function trimVal(value?: string | null): string | undefined {
  if (!value) return undefined;
  const t = value.trim();
  return t.length ? t : undefined;
}

// Parse USR (SongSelect) format
export function parseUsr(content: string): ParsedImport | null {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const meta: Record<string, string> = {};
  const body: string[] = [];
  let inLyrics = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!inLyrics && line.includes('=')) {
      const [k, ...rest] = line.split('=');
      meta[k.trim().toLowerCase()] = rest.join('=').trim();
      continue;
    }
    if (!inLyrics && line.toLowerCase().startsWith('[verse')) {
      inLyrics = true;
    }
    if (inLyrics) {
      if (line.startsWith('[')) continue; // skip section headers
      if (line.length === 0) {
        body.push('');
      } else {
        body.push(line);
      }
    }
  }

  const title = trimVal(meta['title']);
  const ccli = trimVal(meta['ccli']) || trimVal(meta['ccli key']);
  const author = trimVal(meta['author']);
  const lyrics = body.join('\n').trim();
  if (!lyrics) return null;
  return { title, ccli, artist: author, lyrics };
}

// Parse plain text; try to extract CCLI from header lines
export function parseTxt(content: string): ParsedImport | null {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const header = lines.slice(0, 5).join(' ');
  const ccliMatch = header.match(/ccli\s*[#:]*\s*(\d+)/i);
  const titleCandidate = lines[0]?.trim();
  const bodyStart = 0;
  const body = lines.slice(bodyStart).join('\n').trim();
  if (!body) return null;
  return { title: trimVal(titleCandidate), ccli: ccliMatch?.[1], lyrics: body };
}

export async function parseSongSelectFile(file: File): Promise<ParsedImport | null> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (!['usr', 'txt'].includes(ext)) {
    throw new Error('Unsupported file type. Use .usr or .txt');
  }
  const text = await file.text();
  if (ext === 'usr') {
    const parsed = parseUsr(text);
    if (parsed) return parsed;
    throw new Error('Could not parse .usr file');
  }
  const parsed = parseTxt(text);
  if (parsed) return parsed;
  throw new Error('Could not parse .txt file');
}
