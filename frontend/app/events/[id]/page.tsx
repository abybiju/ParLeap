import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventForm } from '@/components/events/EventForm';
import { SetlistBuilder } from '@/components/events/SetlistBuilder';
import type { Database } from '@/lib/supabase/types';

interface EventDetailPageProps {
  params: {
    id: string;
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  type EventRow = Database['public']['Tables']['events']['Row'];
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, event_date, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()
    .returns<EventRow>();

  if (eventError || !event) {
    notFound();
  }

  const { data: eventItems } = await supabase
    .from('event_items')
    .select('id, sequence_order, songs(id, title, artist)')
    .eq('event_id', params.id)
    .order('sequence_order', { ascending: true });

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist')
    .eq('user_id', user.id)
    .order('title', { ascending: true });

  const setlist = (eventItems ?? [])
    .map((item) => {
      const song = item.songs as { id: string; title: string; artist: string | null } | null;
      if (!song) {
        return null;
      }
      return {
        id: item.id,
        songId: song.id,
        title: song.title,
        artist: song.artist,
        sequenceOrder: item.sequence_order,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <EventForm mode="edit" event={event} />
        <SetlistBuilder eventId={params.id} initialSetlist={setlist} songs={songs ?? []} />
      </div>
    </main>
  );
}
