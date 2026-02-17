import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LivePageClient } from './LivePageClient'

interface LivePageProps {
  params: {
    id: string
  }
}

/**
 * Get backend HTTP URL from environment variables
 * Prefers NEXT_PUBLIC_BACKEND_URL, otherwise derives from NEXT_PUBLIC_WS_URL
 */
function getBackendHttpUrl(): string {
  // Prefer explicit backend URL
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL
  }

  // Derive from WebSocket URL (wss:// -> https://, ws:// -> http://)
  if (process.env.NEXT_PUBLIC_WS_URL) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL
    return wsUrl.startsWith('wss://') ? wsUrl.replace(/^wss:\/\//, 'https://') : wsUrl.replace(/^ws:\/\//, 'http://')
  }

  // Fallback: production or localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'www.parleap.com') {
    return 'https://parleapbackend-production.up.railway.app'
  }
  return 'http://localhost:3001'
}

/**
 * Extract Supabase project reference from URL
 * e.g., "https://xxxx.supabase.co" -> "xxxx"
 */
function getFrontendSupabaseProjectRef(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return null
  }
  try {
    const url = new URL(supabaseUrl)
    const hostname = url.hostname
    const match = hostname.match(/^([^.]+)\.supabase\.co$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export default async function LivePage({ params }: LivePageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch event details
  const { data: event, error } = await supabase
    .from('events')
    .select('id, name, event_date, status, projector_font, bible_mode, bible_version_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !event) {
    notFound()
  }

  // Fetch event_items for pre-session setlist (with polymorphic support, including announcement_slides)
  let items: any[] = []
  const { data: eventItems, error: itemsError } = await supabase
    .from('event_items')
    .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title, announcement_slides, songs(id, title, artist)')
    .eq('event_id', params.id)
    .order('sequence_order', { ascending: true })

  if (itemsError && itemsError.code === '42703') {
    const { data: fallbackItems } = await supabase
      .from('event_items')
      .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title, songs(id, title, artist)')
      .eq('event_id', params.id)
      .order('sequence_order', { ascending: true })
    items = fallbackItems ?? []
  } else {
    items = eventItems ?? []
  }

  // Build initial setlist (polymorphic: songs, Bible, media, announcement) for display before session starts
  type SetlistItemRow = {
    id: string
    sequence_order: number
    item_type?: string | null
    song_id?: string | null
    bible_ref?: string | null
    media_url?: string | null
    media_title?: string | null
    announcement_slides?: Array<{ url: string; type: string; title?: string }> | null
    songs: { id: string; title: string; artist: string | null } | null
  }
  const initialSetlist = (items ?? [])
    .map((item: SetlistItemRow) => {
      const itemType =
        item.item_type ||
        (item.song_id ? 'SONG' : null) ||
        (item.bible_ref ? 'BIBLE' : null) ||
        (item.media_url ? 'MEDIA' : null) ||
        (item.announcement_slides && Array.isArray(item.announcement_slides) && item.announcement_slides.length > 0 ? 'ANNOUNCEMENT' : null) ||
        'SONG'
      if (itemType === 'SONG') {
        const song = item.songs
        if (!song) return null
        return { kind: 'SONG' as const, id: item.id, songId: song.id, title: song.title, artist: song.artist, sequenceOrder: item.sequence_order }
      }
      if (itemType === 'BIBLE' && item.bible_ref) {
        return { kind: 'BIBLE' as const, id: item.id, bibleRef: item.bible_ref, sequenceOrder: item.sequence_order }
      }
      if (itemType === 'MEDIA' && item.media_url) {
        return { kind: 'MEDIA' as const, id: item.id, mediaTitle: item.media_title ?? 'Media', mediaUrl: item.media_url, sequenceOrder: item.sequence_order }
      }
      if (itemType === 'ANNOUNCEMENT' && item.announcement_slides && item.announcement_slides.length > 0) {
        return { kind: 'ANNOUNCEMENT' as const, id: item.id, slideCount: item.announcement_slides.length, sequenceOrder: item.sequence_order }
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // Fetch backend health to check for Supabase mismatch
  let backendHealth: {
    supabaseConfigured?: boolean
    supabaseProjectRef?: string | null
  } | null = null
  let healthError: Error | null = null

  try {
    const backendUrl = getBackendHttpUrl()
    const healthResponse = await fetch(`${backendUrl}/health`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    })
    if (healthResponse.ok) {
      backendHealth = await healthResponse.json()
    }
  } catch (error) {
    healthError = error instanceof Error ? error : new Error('Failed to fetch backend health')
  }

  // Check for Supabase project mismatch
  const frontendProjectRef = getFrontendSupabaseProjectRef()
  const backendProjectRef = backendHealth?.supabaseProjectRef ?? null
  const backendConfigured = backendHealth?.supabaseConfigured ?? false
  
  // Mismatch if:
  // 1. Both refs exist and differ, OR
  // 2. Frontend has ref but backend doesn't (backend not configured or health check failed)
  const hasMismatch = Boolean(
    (frontendProjectRef && backendProjectRef && frontendProjectRef !== backendProjectRef) ||
    (frontendProjectRef && !backendConfigured) ||
    (frontendProjectRef && !backendProjectRef && !healthError) // Backend configured but no ref (suspicious)
  )

  return (
    <LivePageClient
      eventId={params.id}
      eventName={(event as any).name || 'Untitled Event'}
      projectorFont={(event as any).projector_font ?? null}
      bibleMode={(event as any).bible_mode ?? false}
      bibleVersionId={(event as any).bible_version_id ?? null}
      initialSetlist={initialSetlist}
      hasSupabaseMismatch={hasMismatch}
      frontendProjectRef={frontendProjectRef}
      backendProjectRef={backendProjectRef}
      backendConfigured={backendConfigured}
      backendHealthError={healthError?.message ?? null}
    />
  )
}
