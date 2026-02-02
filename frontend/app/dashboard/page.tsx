import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventCard } from '@/components/dashboard/EventCard'
import { redirect } from 'next/navigation'

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
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pt-24">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-indigo-200">Welcome{user?.email ? `, ${user.email}` : ''}</p>
              <h1 className="text-3xl font-semibold">Dashboard</h1>
              <p className="text-slate-300">
                Select an event to launch a live session, or create a new event.
              </p>
            </div>
            <Link
              href="/events/new"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
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
            <div className="mt-8 p-8 rounded-lg border border-white/10 bg-white/5 text-center">
              <p className="text-slate-400 mb-4">No events yet. Create your first event to get started.</p>
              <Link
                href="/events/new"
                className="inline-block px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
              >
                Create Your First Event
              </Link>
            </div>
          )}

          {/* Quick Links */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Quick Links</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link
                href="/songs"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 hover:border-indigo-300/50 transition shadow-lg shadow-indigo-500/10"
              >
                <h3 className="text-lg font-semibold text-white">Songs Library</h3>
                <p className="text-sm text-slate-300 mt-1">Manage lyrics and content.</p>
              </Link>

              <Link
                href="/events"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 hover:border-indigo-300/50 transition shadow-lg shadow-indigo-500/10"
              >
                <h3 className="text-lg font-semibold text-white">Events & Setlists</h3>
                <p className="text-sm text-slate-300 mt-1">Create events and arrange songs.</p>
              </Link>

              <Link
                href="/profile"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 hover:border-indigo-300/50 transition shadow-lg shadow-indigo-500/10"
              >
                <h3 className="text-lg font-semibold text-white">Profile</h3>
                <p className="text-sm text-slate-300 mt-1">Manage your account settings.</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
