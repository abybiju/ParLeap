import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventCard } from '@/components/dashboard/EventCard';
import type { Database } from '@/lib/supabase/types';

export default async function EventsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  type EventRow = Database['public']['Tables']['events']['Row'];
  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date, status, created_at')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true, nullsFirst: false })
    .returns<EventRow[]>();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Events & Setlists</h1>
              <p className="text-sm text-slate-300">
                Create events, schedule services, and build live setlists.
              </p>
            </div>
            <Link
              href="/events/new"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
            >
              New Event
            </Link>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              Error loading events: {error.message}
            </div>
          ) : events && events.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-slate-400">No events yet. Create your first event to get started.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
