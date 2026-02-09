import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { EventForm } from '@/components/events/EventForm';
import { SetlistBuilder } from '@/components/events/SetlistBuilder';
import type { Database } from '@/lib/supabase/types';
import { AppPageWrapper } from '@/components/layout/AppPageWrapper';

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

  // Fetch event items with polymorphic support
  // Try new schema first, fallback to old schema for backward compatibility
  const { data: eventItems, error: itemsError } = await supabase
    .from('event_items')
    .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title, songs(id, title, artist)')
    .eq('event_id', params.id)
    .order('sequence_order', { ascending: true });

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

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist')
    .eq('user_id', user.id)
    .order('title', { ascending: true });

  // Convert to SetlistItem format
  const setlist = items
    .map((item: any) => {
      const itemType = item.item_type || (item.song_id ? 'SONG' : null) || 'SONG';
      
      if (itemType === 'SONG') {
        const song = item.songs;
        if (!song) return null;
        return {
          id: item.id,
          eventId: params.id,
          itemType: 'SONG' as const,
          songId: song.id,
          title: song.title,
          artist: song.artist,
          sequenceOrder: item.sequence_order,
        };
      }
      
      if (itemType === 'BIBLE') {
        return {
          id: item.id,
          eventId: params.id,
          itemType: 'BIBLE' as const,
          bibleRef: item.bible_ref,
          sequenceOrder: item.sequence_order,
        };
      }
      
      if (itemType === 'MEDIA') {
        return {
          id: item.id,
          eventId: params.id,
          itemType: 'MEDIA' as const,
          mediaUrl: item.media_url,
          mediaTitle: item.media_title,
          sequenceOrder: item.sequence_order,
        };
      }
      
      return null;
    })
    .filter((item: any): item is NonNullable<typeof item> => item !== null);

  return (
    <AppPageWrapper className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        {/* Back to Dashboard Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <EventForm mode="edit" event={event} />
        <SetlistBuilder eventId={params.id} initialSetlist={setlist} songs={songs ?? []} />
      </main>
    </AppPageWrapper>
  );
}
