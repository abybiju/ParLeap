import { NextRequest, NextResponse } from 'next/server';

const UNSPLASH_API = 'https://api.unsplash.com';
const MAX_QUERY_LENGTH = 100;
const PER_PAGE = 20;

export interface UnsplashSearchResult {
  id: string;
  urls: { regular: string; full: string };
  user: { name: string; links?: { html?: string } };
  links?: { html?: string };
}

export async function GET(request: NextRequest) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'Unsplash is not configured' },
      { status: 503 }
    );
  }

  const q = request.nextUrl.searchParams.get('q');
  const query = typeof q === 'string' ? q.trim() : '';
  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query must be at most ${MAX_QUERY_LENGTH} characters` },
      { status: 400 }
    );
  }

  const url = new URL(`${UNSPLASH_API}/search/photos`);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(PER_PAGE));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${key}`,
      'Accept-Version': 'v1',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('[Unsplash API]', res.status, text.slice(0, 200));
    return NextResponse.json(
      { error: 'Search failed' },
      { status: res.status >= 500 ? 502 : 400 }
    );
  }

  const data = (await res.json()) as {
    results?: Array<{
      id: string;
      urls?: { regular?: string; full?: string };
      user?: { name?: string; links?: { html?: string } };
      links?: { html?: string };
    }>;
  };

  const results: UnsplashSearchResult[] = (data.results ?? [])
    .filter(
      (r) =>
        r.id &&
        r.urls?.regular
    )
    .map((r) => ({
      id: r.id,
      urls: {
        regular: r.urls!.regular!,
        full: r.urls!.full ?? r.urls!.regular!,
      },
      user: {
        name: r.user?.name ?? 'Unknown',
        links: r.user?.links,
      },
      links: r.links,
    }));

  return NextResponse.json({ results });
}
