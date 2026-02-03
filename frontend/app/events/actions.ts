'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { eventSchema } from '@/lib/schemas/event';

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

  const { data, error: insertError } = await (supabase
    .from('event_items') as ReturnType<typeof supabase.from>)
    .insert({
      event_id: eventId,
      song_id: songId,
      sequence_order: sequenceOrder,
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, id: (data as { id: string } | null)?.id };
}

export async function removeSongFromEvent(eventId: string, eventItemId: string): Promise<ActionResult> {
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

  const updates = orderedItemIds.map((itemId, index) =>
    (supabase.from('event_items') as ReturnType<typeof supabase.from>)
      .update({ sequence_order: index + 1 } as Record<string, unknown>)
      .eq('id', itemId)
      .eq('event_id', eventId)
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    return { success: false, error: failed.error.message };
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
