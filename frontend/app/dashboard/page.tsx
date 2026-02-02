import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventCard } from '@/components/dashboard/EventCard'
import { redirect } from 'next/navigation'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'
import { MissionControlBackground } from '@/components/layout/MissionControlBackground'

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

  return (
    <AppPageWrapper className="relative text-white">
      <MissionControlBackground />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-8">
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

          {/* Events Grid */}
          {error ? (
            <div className="mt-8 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400">Error loading events: {error.message}</p>
            </div>
          ) : events && events.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event as any} />
              ))}
            </div>
          ) : (
            <div className="mission-card mt-8 p-8 text-center">
              <p className="mb-4 text-slate-400">No events yet. Create your first event to get started.</p>
              <Link
                href="/events/new"
                className="inline-block rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-6 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90"
              >
                Create Your First Event
              </Link>
            </div>
          )}

          {/* Quick Links - Linear-style list */}
          <div className="mt-10 pt-8 border-t border-white/[0.06]">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Quick Links</h2>
            <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <Link
                href="/songs"
                className="mission-list-row flex items-center justify-between px-4 py-3"
              >
                <div>
                  <h3 className="text-sm font-medium text-white">Songs Library</h3>
                  <p className="text-xs text-slate-500">Manage lyrics and content</p>
                </div>
                <span className="text-slate-600">→</span>
              </Link>
              <Link
                href="/events"
                className="mission-list-row flex items-center justify-between px-4 py-3"
              >
                <div>
                  <h3 className="text-sm font-medium text-white">Events & Setlists</h3>
                  <p className="text-xs text-slate-500">Create events and arrange songs</p>
                </div>
                <span className="text-slate-600">→</span>
              </Link>
              <Link
                href="/profile"
                className="mission-list-row flex items-center justify-between px-4 py-3"
              >
                <div>
                  <h3 className="text-sm font-medium text-white">Profile</h3>
                  <p className="text-xs text-slate-500">Manage your account settings</p>
                </div>
                <span className="text-slate-600">→</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AppPageWrapper>
  )
}
