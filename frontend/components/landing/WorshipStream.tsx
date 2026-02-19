'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

const ITUNES_WORSHIP_URL =
  'https://itunes.apple.com/search?term=modern+worship&entity=album&limit=20'
const APPLE_TOP_ALBUMS_URL =
  'https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/albums.json'

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours – album art stays fresh

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

function highResArtwork(url: string): string {
  return url.replace(/100x100bb/, '600x600bb').replace(/100x100/, '600x600')
}

function normalizeRssAlbum(a: AppleRssAlbum): Album {
  return {
    collectionId: Number(a.id),
    collectionName: a.name,
    artistName: a.artistName,
    artworkUrl100: a.artworkUrl100,
  }
}

async function fetchWorshipAlbums(): Promise<Album[]> {
  const res = await fetch(ITUNES_WORSHIP_URL)
  const data: { results?: Album[] } = await res.json()
  return data.results ?? []
}

async function fetchTopAlbums(): Promise<Album[]> {
  const res = await fetch(APPLE_TOP_ALBUMS_URL)
  const data: { feed?: { results?: AppleRssAlbum[] } } = await res.json()
  const results = data.feed?.results ?? []
  return results.map(normalizeRssAlbum)
}

const MAX_ALBUMS = 40 // enough for two scrolling rows, worship-first then top charts

async function fetchAllAlbums(): Promise<Album[]> {
  // Fetch both independently so one failure (e.g. CORS on RSS) doesn't hide the other
  const [worshipResult, topResult] = await Promise.allSettled([
    fetchWorshipAlbums(),
    fetchTopAlbums(),
  ])
  const worship =
    worshipResult.status === 'fulfilled' ? worshipResult.value : []
  const top = topResult.status === 'fulfilled' ? topResult.value : []
  const byId = new Map<number, Album>()
  worship.forEach((a) => byId.set(a.collectionId, a))
  top.forEach((a) => {
    if (!byId.has(a.collectionId)) byId.set(a.collectionId, a)
  })
  const merged = [...byId.values()]
  return merged.slice(0, MAX_ALBUMS)
}

export function WorshipStream() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    fetchAllAlbums()
      .then((list) => {
        if (list.length > 0) setAlbums(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  if (loading) {
    return (
      <section className="py-16 px-4 overflow-hidden">
        <div className="container mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-white text-center mb-12">
            Every song, One flow
          </h2>
          <div className="flex justify-center">
            <div className="h-40 w-40 rounded-xl bg-white/5 animate-pulse" />
          </div>
        </div>
      </section>
    )
  }

  if (albums.length === 0) {
    return (
      <section className="py-16 px-4 overflow-hidden">
        <div className="container mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-white text-center mb-12">
            Every song, One flow
          </h2>
          <p className="text-center text-white/50 text-sm mb-4">
            Album art from iTunes will appear here when available.
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                refresh()
              }}
              className="text-sm text-orange-400 hover:text-orange-300 underline"
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    )
  }

  const albumWidth = 160
  const gap = 24
  const rowWidth = albums.length * (albumWidth + gap) - gap
  const duplicated = [...albums, ...albums]

  return (
    <section className="py-16 px-4 overflow-hidden relative">
      <div className="container mx-auto relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl lg:text-4xl font-bold text-white text-center mb-12"
        >
          Every song, One flow
        </motion.h2>
      </div>

      {/* Fade masks - left and right */}
      <div
        className="absolute left-0 top-0 bottom-0 w-24 lg:w-32 z-20 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, transparent 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-24 lg:w-32 z-20 pointer-events-none"
        style={{
          background: 'linear-gradient(to left, rgba(0,0,0,0.9) 0%, transparent 100%)',
        }}
        aria-hidden
      />

      {/* Row 1: Right -> Left */}
      <div className="relative z-10 mb-6">
        <motion.div
          className="flex gap-6"
          style={{ width: rowWidth * 2 + gap }}
          animate={{ x: [0, -rowWidth - gap] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 55,
              ease: 'linear',
            },
          }}
        >
          {duplicated.map((album) => (
            <AlbumCard key={`r1-${album.collectionId}-${album.collectionName}`} album={album} />
          ))}
        </motion.div>
      </div>

      {/* Row 2: Left -> Right */}
      <div className="relative z-10">
        <motion.div
          className="flex gap-6"
          style={{ width: rowWidth * 2 + gap }}
          animate={{ x: [-rowWidth - gap, 0] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 65,
              ease: 'linear',
            },
          }}
        >
          {duplicated.map((album) => (
            <AlbumCard key={`r2-${album.collectionId}-${album.collectionName}`} album={album} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function AlbumCard({ album }: { album: Album }) {
  const src = highResArtwork(album.artworkUrl100)
  return (
    <a
      href={`https://music.apple.com/album/${album.collectionId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 h-40 w-40 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:scale-110 hover:grayscale-0 hover:opacity-100 grayscale opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
      aria-label={`${album.collectionName} by ${album.artistName}`}
    >
      <Image
        src={src}
        alt=""
        width={160}
        height={160}
        className="h-full w-full object-cover"
        unoptimized
      />
    </a>
  )
}
