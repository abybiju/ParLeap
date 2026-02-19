import { NextResponse } from 'next/server'

const ITUNES_WORSHIP_URL =
  'https://itunes.apple.com/search?term=modern+worship&entity=album&limit=20'
const APPLE_TOP_ALBUMS_URL =
  'https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/albums.json'
const MAX_ALBUMS = 40

interface Album {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100: string
}

interface AppleRssAlbum {
  id: string
  name: string
  artistName: string
  artworkUrl100: string
}

function normalizeRssAlbum(a: AppleRssAlbum): Album {
  return {
    collectionId: Number(a.id),
    collectionName: a.name,
    artistName: a.artistName,
    artworkUrl100: a.artworkUrl100,
  }
}

export async function GET() {
  const [worshipResult, topResult] = await Promise.allSettled([
    fetch(ITUNES_WORSHIP_URL).then(async (res) => {
      const data: { results?: Album[] } = await res.json()
      return data.results ?? []
    }),
    fetch(APPLE_TOP_ALBUMS_URL).then(async (res) => {
      const data: { feed?: { results?: AppleRssAlbum[] } } = await res.json()
      const results = data.feed?.results ?? []
      return results.map(normalizeRssAlbum)
    }),
  ])

  const worship = worshipResult.status === 'fulfilled' ? worshipResult.value : []
  const top = topResult.status === 'fulfilled' ? topResult.value : []
  const byId = new Map<number, Album>()
  worship.forEach((a) => byId.set(a.collectionId, a))
  top.forEach((a) => {
    if (!byId.has(a.collectionId)) byId.set(a.collectionId, a)
  })
  const albums = [...byId.values()].slice(0, MAX_ALBUMS)

  return NextResponse.json({ albums })
}
