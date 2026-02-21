'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { eventSchema } from '@/lib/schemas/event';
import type { AnnouncementSlideInput } from '@/lib/types/setlist';

export interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

const EVENT_PATH = '/events';
const DASHBOARD_PATH = '/dashboard';

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, error: 'Not authenticated' };
  }
  return { supabase, user, error: null };
}

async function ensureEventOwnership(supabase: ReturnType<typeof createClient>, userId: string, eventId: string) {
  const { data: event, error } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('user_id', userId)
    .single();

  if (error || !event) {
    return { error: 'Event not found or access denied' };
  }

  return { error: null };
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const rawData = {
    name: formData.get('name') as string,
    event_date: formData.get('event_date') as string,
    status: formData.get('status') as string,
  };

  const result = eventSchema.safeParse(rawData);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message || 'Validation failed',
    };
  }

  const eventDate = toIsoOrNull(result.data.event_date ?? null);

  const { data, error: insertError } = await (supabase
    .from('events') as ReturnType<typeof supabase.from>)
    .insert({
      user_id: user.id,
      name: result.data.name,
      event_date: eventDate,
      status: result.data.status ?? 'draft',
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath(EVENT_PATH);
  revalidatePath(DASHBOARD_PATH);

  return { success: true, id: (data as { id: string } | null)?.id };
}

export async function updateEvent(id: string, formData: FormData): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const rawData = {
    name: formData.get('name') as string,
    event_date: formData.get('event_date') as string,
    status: formData.get('status') as string,
  };

  const result = eventSchema.safeParse(rawData);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message || 'Validation failed',
    };
  }

  const eventDate = toIsoOrNull(result.data.event_date ?? null);

  const { error: updateError } = await (supabase
    .from('events') as ReturnType<typeof supabase.from>)
    .update({
      name: result.data.name,
      event_date: eventDate,
      status: result.data.status ?? 'draft',
    } as Record<string, unknown>)
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(EVENT_PATH);
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(`/events/${id}`);

  return { success: true, id };
}

export async function updateEventBackground(
  eventId: string,
  backgroundImageUrl: string | null,
  backgroundMediaType?: string | null
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  const updates: Record<string, unknown> = { background_image_url: backgroundImageUrl };
  if (backgroundMediaType !== undefined) {
    updates.background_media_type = backgroundMediaType;
  } else if (backgroundImageUrl === null) {
    updates.background_media_type = null;
  }

  const { error: updateError } = await (supabase
    .from('events') as ReturnType<typeof supabase.from>)
    .update(updates)
    .eq('id', eventId)
    .eq('user_id', user.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(EVENT_PATH);
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(`/events/${eventId}`);

  return { success: true, id: eventId };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  // Remove setlist items first
  await supabase
    .from('event_items')
    .delete()
    .eq('event_id', id);

  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  revalidatePath(EVENT_PATH);
  revalidatePath(DASHBOARD_PATH);

  return { success: true };
}

export async function addSongToEvent(eventId: string, songId: string, sequenceOrder: number): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id')
    .eq('id', songId)
    .eq('user_id', user.id)
    .single();

  if (songError || !song) {
    return { success: false, error: 'Song not found or access denied' };
  }

  // Try new schema with item_type, fallback to old schema
  const insertData: Record<string, unknown> = {
    event_id: eventId,
    song_id: songId,
    sequence_order: sequenceOrder,
    item_type: 'SONG',
  };

  const { data, error: insertError } = await (supabase
    .from('event_items') as ReturnType<typeof supabase.from>)
    .insert(insertData)
    .select('id')
    .single();

  // If item_type column doesn't exist, try without it (backward compatibility)
  if (insertError && insertError.code === '42703' && insertError.message?.includes('item_type')) {
    const { data: fallbackData, error: fallbackError } = await (supabase
      .from('event_items') as ReturnType<typeof supabase.from>)
      .insert({
        event_id: eventId,
        song_id: songId,
        sequence_order: sequenceOrder,
      } as Record<string, unknown>)
      .select('id')
      .single();

    if (fallbackError) {
      return { success: false, error: fallbackError.message };
    }

    revalidatePath(`/events/${eventId}`);
    return { success: true, id: (fallbackData as { id: string } | null)?.id };
  }

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, id: (data as { id: string } | null)?.id };
}

export async function addBibleToEvent(eventId: string, bibleRef: string, sequenceOrder: number): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  const insertData: Record<string, unknown> = {
    event_id: eventId,
    item_type: 'BIBLE',
    bible_ref: bibleRef,
    sequence_order: sequenceOrder,
  };

  const { data, error: insertError } = await (supabase
    .from('event_items') as ReturnType<typeof supabase.from>)
    .insert(insertData)
    .select('id')
    .single();

  if (insertError) {
    // If columns don't exist, migration not run
    if (insertError.code === '42703') {
      return { success: false, error: 'Bible items require database migration 011. Please run the migration first.' };
    }
    return { success: false, error: insertError.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, id: (data as { id: string } | null)?.id };
}

export async function addMediaToEvent(eventId: string, mediaUrl: string, mediaTitle: string, sequenceOrder: number): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  const insertData: Record<string, unknown> = {
    event_id: eventId,
    item_type: 'MEDIA',
    media_url: mediaUrl,
    media_title: mediaTitle,
    sequence_order: sequenceOrder,
  };

  const { data, error: insertError } = await (supabase
    .from('event_items') as ReturnType<typeof supabase.from>)
    .insert(insertData)
    .select('id')
    .single();

  if (insertError) {
    // If columns don't exist, migration not run
    if (insertError.code === '42703') {
      return { success: false, error: 'Media items require database migration 011. Please run the migration first.' };
    }
    return { success: false, error: insertError.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, id: (data as { id: string } | null)?.id };
}

export async function addAnnouncementToEvent(
  eventId: string,
  slides: AnnouncementSlideInput[],
  sequenceOrder: number
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  if (!slides || slides.length === 0) {
    return { success: false, error: 'At least one slide is required' };
  }

  const hasStructuredText = (s: (typeof slides)[0]) => {
    const st = s.structuredText;
    if (!st) return false;
    if (st.title?.trim()) return true;
    if (st.subtitle?.trim()) return true;
    if (st.date?.trim()) return true;
    if (st.lines?.some((l: string) => (l ?? '').trim())) return true;
    return false;
  };
  const validSlides = slides
    .filter(
      (s) =>
        (s.url?.trim() && (s.type === 'image' || s.type === 'video')) || hasStructuredText(s)
    )
    .map((s) => {
      const out: { url?: string; type?: 'image' | 'video'; title?: string; structuredText?: { title?: string; subtitle?: string; date?: string; lines?: string[] } } = {};
      if (s.url?.trim() && (s.type === 'image' || s.type === 'video')) {
        out.url = s.url.trim();
        out.type = s.type as 'image' | 'video';
        if (s.title?.trim()) out.title = s.title.trim();
      }
      if (hasStructuredText(s) && s.structuredText) {
        out.structuredText = {
          title: s.structuredText.title?.trim() || undefined,
          subtitle: s.structuredText.subtitle?.trim() || undefined,
          date: s.structuredText.date?.trim() || undefined,
          lines: s.structuredText.lines?.map((l: string) => (l ?? '').trim()).filter(Boolean),
        };
        if (Array.isArray(out.structuredText.lines) && out.structuredText.lines.length === 0)
          delete out.structuredText.lines;
      }
      return out;
    });

  if (validSlides.length === 0) {
    return { success: false, error: 'Each slide must have a URL and type (image/video) or structured text (exact wording)' };
  }

  const insertData: Record<string, unknown> = {
    event_id: eventId,
    item_type: 'ANNOUNCEMENT',
    announcement_slides: validSlides,
    sequence_order: sequenceOrder,
  };

  const { data, error: insertError } = await (supabase
    .from('event_items') as ReturnType<typeof supabase.from>)
    .insert(insertData)
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '42703') {
      return { success: false, error: 'Announcement items require database migration 013. Please run the migration first.' };
    }
    return { success: false, error: insertError.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, id: (data as { id: string } | null)?.id };
}

export async function removeSongFromEvent(eventId: string, eventItemId: string): Promise<ActionResult> {
  return removeSetlistItem(eventId, eventItemId);
}

export async function removeSetlistItem(eventId: string, eventItemId: string): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  const { error: deleteError } = await supabase
    .from('event_items')
    .delete()
    .eq('id', eventItemId)
    .eq('event_id', eventId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function reorderEventItems(eventId: string, orderedItemIds: string[]): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  // Try using the PostgreSQL function for atomic reordering (if available)
  // Fallback to sequential updates if function doesn't exist
  const { error: rpcError } = await (supabase.rpc as any)('reorder_event_items', {
    p_event_id: eventId,
    p_item_ids: orderedItemIds,
  });

  if (rpcError) {
    // Fallback: Use sequential updates with unique temporary values
    // Use a large offset (10000) to ensure temporary values don't conflict
    for (let index = 0; index < orderedItemIds.length; index++) {
      const itemId = orderedItemIds[index];
      const { error: tempError } = await (supabase.from('event_items') as ReturnType<typeof supabase.from>)
        .update({ sequence_order: 10000 + index } as Record<string, unknown>)
        .eq('id', itemId)
        .eq('event_id', eventId);

      if (tempError) {
        return { success: false, error: tempError.message };
      }
    }

    // Phase 2: Update to final sequence_order values
    for (let index = 0; index < orderedItemIds.length; index++) {
      const itemId = orderedItemIds[index];
      const { error: updateError } = await (supabase.from('event_items') as ReturnType<typeof supabase.from>)
        .update({ sequence_order: index + 1 } as Record<string, unknown>)
        .eq('id', itemId)
        .eq('event_id', eventId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function updateEventItemSlideConfig(
  eventId: string,
  eventItemId: string,
  slideConfigOverride: { linesPerSlide?: number; respectStanzaBreaks?: boolean; manualBreaks?: number[] }
): Promise<ActionResult> {
  const { supabase, user, error } = await requireUser();
  if (!user) {
    return { success: false, error };
  }

  const ownership = await ensureEventOwnership(supabase, user.id, eventId);
  if (ownership.error) {
    return { success: false, error: ownership.error };
  }

  const { error: updateError } = await (supabase
    .from('event_items') as ReturnType<typeof supabase.from>)
    .update({ slide_config_override: slideConfigOverride as Record<string, unknown> })
    .eq('id', eventItemId)
    .eq('event_id', eventId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, id: eventItemId };
}

// --- Shared search for Content Library and Command palette ---

export interface SongOption {
  id: string;
  title: string;
  artist: string | null;
}

export interface GetSongsSearchResult {
  data: SongOption[];
  total: number;
}

export async function getSongsSearch(options: {
  query?: string;
  limit: number;
  offset: number;
  excludeSongIds?: string[];
}): Promise<GetSongsSearchResult> {
  const { supabase, user } = await requireUser();
  if (!user) {
    return { data: [], total: 0 };
  }

  const { query, limit, offset, excludeSongIds = [] } = options;
  const safeQuery = query?.trim().replace(/'/g, "''") ?? '';
  const excludeSet = new Set(excludeSongIds);

  let base = supabase
    .from('songs')
    .select('id, title, artist', { count: 'exact' })
    .eq('user_id', user.id)
    .order('title', { ascending: true });

  if (safeQuery.length > 0) {
    base = base.or(`title.ilike.%${safeQuery}%,artist.ilike.%${safeQuery}%`);
  }

  const fetchLimit = excludeSet.size > 0 ? offset + limit + excludeSet.size : offset + limit;
  const { data, error: fetchError, count } = await base.range(offset, fetchLimit - 1);

  if (fetchError) {
    return { data: [], total: 0 };
  }

  let rows = (data ?? []) as { id: string; title: string; artist: string | null }[];
  if (excludeSet.size > 0) {
    rows = rows.filter((r) => !excludeSet.has(r.id)).slice(0, limit);
    const totalFromCount = count ?? 0;
    return {
      data: rows.map((r) => ({ id: r.id, title: r.title, artist: r.artist ?? null })),
      total: Math.max(0, totalFromCount - excludeSet.size),
    };
  }

  return {
    data: rows.map((r) => ({ id: r.id, title: r.title, artist: r.artist ?? null })),
    total: count ?? rows.length,
  };
}

export interface EventSearchOption {
  id: string;
  name: string;
  event_date: string | null;
  status: string;
}

export interface GetEventsSearchResult {
  data: EventSearchOption[];
}

export async function getEventsSearch(options: { query?: string; limit: number }): Promise<GetEventsSearchResult> {
  const { supabase, user } = await requireUser();
  if (!user) {
    return { data: [] };
  }

  const { query, limit } = options;
  const safeQuery = query?.trim().replace(/'/g, "''") ?? '';

  let q = supabase
    .from('events')
    .select('id, name, event_date, status')
    .eq('user_id', user.id)
    .order('event_date', { ascending: false, nullsFirst: false });

  if (safeQuery.length > 0) {
    q = q.ilike('name', `%${safeQuery}%`);
  }

  const { data, error: fetchError } = await q.limit(limit);

  if (fetchError) {
    return { data: [] };
  }

  const rows = (data ?? []) as { id: string; name: string; event_date: string | null; status: string }[];
  return {
    data: rows.map((r) => ({ id: r.id, name: r.name, event_date: r.event_date, status: r.status })),
  };
}
