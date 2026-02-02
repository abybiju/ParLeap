import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventCard } from '@/components/dashboard/EventCard';
import type { Database } from '@/lib/supabase/types';
import { AppPageWrapper } from '@/components/layout/AppPageWrapper';
import { MissionControlBackground } from '@/components/layout/MissionControlBackground';

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
    <AppPageWrapper className="relative text-white">
      <MissionControlBackground />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 shadow-xl backdrop-blur-xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Mission Control</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Events & Setlists</h1>
              <p className="text-sm text-slate-400">
                Create events, schedule services, and build live setlists.
              </p>
            </div>
            <Link
              href="/events/new"
              className="rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90"
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
            <div className="mission-card p-8 text-center">
              <p className="text-slate-400">No events yet. Create your first event to get started.</p>
              <Link
                href="/events/new"
                className="mt-4 inline-block rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-6 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90"
              >
                Create Event
              </Link>
            </div>
          )}
        </div>
      </main>
    </AppPageWrapper>
  );
}
