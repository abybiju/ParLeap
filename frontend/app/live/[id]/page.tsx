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

  // Derive from WebSocket URL (wss://... -> https://...)
  if (process.env.NEXT_PUBLIC_WS_URL) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL
    // Convert wss:// to https:// or ws:// to http://
    return wsUrl.replace(/^wss?:\/\//, 'https://')
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

  // Fetch event_items for pre-session setlist (with polymorphic support)
  // Try new schema first, fallback to old schema for backward compatibility
  const { data: eventItems, error: itemsError } = await supabase
    .from('event_items')
    .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title, songs(id, title, artist)')
    .eq('event_id', params.id)
    .order('sequence_order', { ascending: true })

  // If new columns don't exist, fallback to old query
  let items: any[] = eventItems || [];
  if (itemsError && itemsError.code === '42703') {
    const { data: oldItems } = await supabase
      .from('event_items')
      .select('id, sequence_order, song_id, songs(id, title, artist)')
      .eq('event_id', params.id)
      .order('sequence_order', { ascending: true });
    items = oldItems || [];
  }

  // Build initial setlist (only songs for display - BIBLE/MEDIA items are handled separately)
  const initialSetlist = (items ?? [])
    .map((item: {
      id: string
      sequence_order: number
      item_type?: string | null
      song_id?: string | null
      songs: { id: string; title: string; artist: string | null } | null
    }) => {
      // Only include SONG items in the setlist display
      const itemType = item.item_type || (item.song_id ? 'SONG' : null) || 'SONG';
      if (itemType !== 'SONG') {
        return null; // Skip BIBLE and MEDIA items from initial setlist (they're handled in session)
      }
      const song = item.songs
      if (!song) {
        return null
      }
      return {
        id: song.id,
        title: song.title,
        artist: song.artist,
        sequenceOrder: item.sequence_order,
      }
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
      backendHealthError={healthError}
    />
  )
}
