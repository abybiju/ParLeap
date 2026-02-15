import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventEditWorkspace } from '@/components/events/EventEditWorkspace';
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

  // Fetch event items with polymorphic support (including announcement_slides for ANNOUNCEMENT)
  let items: any[] = [];
  const { data: eventItems, error: itemsError } = await supabase
    .from('event_items')
    .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title, announcement_slides, songs(id, title, artist)')
    .eq('event_id', params.id)
    .order('sequence_order', { ascending: true });

  if (itemsError && itemsError.code === '42703') {
    // Column (e.g. announcement_slides) may not exist yet; retry without it
    const { data: fallbackItems } = await supabase
      .from('event_items')
      .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title, songs(id, title, artist)')
      .eq('event_id', params.id)
      .order('sequence_order', { ascending: true });
    items = fallbackItems || [];
  } else if (itemsError) {
    items = [];
  } else {
    items = eventItems || [];
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist')
    .eq('user_id', user.id)
    .order('title', { ascending: true });

  // Convert to SetlistItem format
  const setlist = items
    .map((item: any) => {
      const itemType =
        item.item_type ||
        (item.song_id ? 'SONG' : null) ||
        (item.bible_ref ? 'BIBLE' : null) ||
        (item.media_url ? 'MEDIA' : null) ||
        (item.announcement_slides && Array.isArray(item.announcement_slides) && item.announcement_slides.length > 0 ? 'ANNOUNCEMENT' : null) ||
        'SONG';
      
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

      if (itemType === 'ANNOUNCEMENT' && item.announcement_slides && Array.isArray(item.announcement_slides) && item.announcement_slides.length > 0) {
        return {
          id: item.id,
          eventId: params.id,
          itemType: 'ANNOUNCEMENT' as const,
          announcementSlides: item.announcement_slides as Array<{ url: string; type: 'image' | 'video'; title?: string }>,
          sequenceOrder: item.sequence_order,
        };
      }

      return null;
    })
    .filter((item: any): item is NonNullable<typeof item> => item !== null);

  return (
    <AppPageWrapper className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto w-full max-w-[1920px] px-6 py-10">
        <EventEditWorkspace
          event={event}
          initialSetlist={setlist}
          songs={songs ?? []}
        />
      </main>
    </AppPageWrapper>
  );
}
