import { NextResponse } from 'next/server'

const ITUNES_WORSHIP_URL =
  'https://itunes.apple.com/search?term=modern+worship&entity=album&limit=30'

interface Album {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100: string
}

export async function GET() {
  const res = await fetch(ITUNES_WORSHIP_URL)
  const data: { results?: Album[] } = await res.json()
  const albums = data.results ?? []

  return NextResponse.json({ albums })
}
