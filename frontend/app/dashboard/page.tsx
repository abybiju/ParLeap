import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventCard } from '@/components/dashboard/EventCard'
import { redirect } from 'next/navigation'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'
import { MissionControlBackground } from '@/components/layout/MissionControlBackground'
import { Music, Calendar, User } from 'lucide-react'
import { DashboardHero } from '@/components/dashboard/DashboardHero'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch user's events
  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date, status, created_at')
    .eq('user_id', user.id)
    .order('event_date', { ascending: false, nullsFirst: false })
    .returns<Array<{
      id: string;
      name: string;
      event_date: string | null;
      status: 'draft' | 'live' | 'ended';
      created_at: string;
    }>>()

  // Helper: Check if event is within 48 hours
  function isWithin48Hours(dateString: string | null): boolean {
    if (!dateString) return false
    const eventDate = new Date(dateString)
    const now = new Date()
    const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntil > 0 && hoursUntil <= 48
  }

  // Find hero event: Live first, then upcoming within 48 hours
  let heroEvent: typeof events[0] | null = null
  if (events && events.length > 0) {
    // Priority 1: Live event
    heroEvent = events.find(e => e.status === 'live') || null
    
    // Priority 2: Upcoming event within 48 hours
    if (!heroEvent) {
      heroEvent = events.find(e => e.status === 'draft' && isWithin48Hours(e.event_date)) || null
    }
  }

  // Fetch song count for hero event
  let songCount = 0
  if (heroEvent) {
    const { count } = await supabase
      .from('event_items')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', heroEvent.id)
    songCount = count || 0
  }

  return (
    <AppPageWrapper className="relative text-white">
      <MissionControlBackground />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Mission Control</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
              <p className="text-sm text-slate-400">
                Select an event to launch, or create a new one.
              </p>
            </div>
            <Link
              href="/events/new"
              className="rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90"
            >
              Create New Event
            </Link>
          </div>

          {/* Smart HUD - Dashboard Hero */}
          <DashboardHero event={heroEvent} songCount={songCount} />

          {/* Events Grid */}
          {error ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400">Error loading events: {error.message}</p>
            </div>
          ) : events && events.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event as any} />
              ))}
            </div>
          ) : (
            <div className="mission-card p-8 text-center">
              <p className="mb-4 text-slate-400">No events yet. Create your first event to get started.</p>
              <Link
                href="/events/new"
                className="inline-block rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-6 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90"
              >
                Create Your First Event
              </Link>
            </div>
          )}

          {/* Quick Links - Glass Card Grid */}
          <div className="pt-8 border-t border-white/[0.06]">
            <h2 className="mb-6 text-xs font-medium uppercase tracking-wider text-slate-500">Quick Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link
                href="/songs"
                className="mission-card relative block p-6"
              >
                <h3 className="text-sm font-medium text-white mb-1">Songs Library</h3>
                <p className="text-xs text-slate-500">Manage lyrics and content</p>
                <Music className="absolute bottom-4 right-4 h-12 w-12 text-white/20" />
              </Link>
              <Link
                href="/events"
                className="mission-card relative block p-6"
              >
                <h3 className="text-sm font-medium text-white mb-1">Events & Setlists</h3>
                <p className="text-xs text-slate-500">Create events and arrange songs</p>
                <Calendar className="absolute bottom-4 right-4 h-12 w-12 text-white/20" />
              </Link>
              <Link
                href="/profile"
                className="mission-card relative block p-6"
              >
                <h3 className="text-sm font-medium text-white mb-1">Profile</h3>
                <p className="text-xs text-slate-500">Manage your account settings</p>
                <User className="absolute bottom-4 right-4 h-12 w-12 text-white/20" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AppPageWrapper>
  )
}
