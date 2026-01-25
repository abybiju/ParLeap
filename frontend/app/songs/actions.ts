'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { songSchema } from '@/lib/schemas/song';

export interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

export async function createSong(formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const rawData = {
    title: formData.get('title') as string,
    artist: formData.get('artist') as string,
    ccli_number: formData.get('ccli_number') as string,
    lyrics: formData.get('lyrics') as string,
  };

  const result = songSchema.safeParse(rawData);
  if (!result.success) {
    return { 
      success: false, 
      error: result.error.issues[0]?.message || 'Validation failed' 
    };
  }

  const insertData = {
    title: result.data.title,
    artist: result.data.artist || null,
    ccli_number: result.data.ccli_number || null,
    lyrics: result.data.lyrics,
    user_id: user.id,
  };

  // Using type assertion to work around Supabase type inference issues
  const { data, error } = await (supabase
    .from('songs') as ReturnType<typeof supabase.from>)
    .insert(insertData as Record<string, unknown>)
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/songs');
  return { success: true, id: (data as { id: string } | null)?.id };
}

export async function updateSong(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const rawData = {
    title: formData.get('title') as string,
    artist: formData.get('artist') as string,
    ccli_number: formData.get('ccli_number') as string,
    lyrics: formData.get('lyrics') as string,
  };

  const result = songSchema.safeParse(rawData);
  if (!result.success) {
    return { 
      success: false, 
      error: result.error.issues[0]?.message || 'Validation failed' 
    };
  }

  const updateData = {
    title: result.data.title,
    artist: result.data.artist || null,
    ccli_number: result.data.ccli_number || null,
    lyrics: result.data.lyrics,
  };

  // Using type assertion to work around Supabase type inference issues
  const { error } = await (supabase
    .from('songs') as ReturnType<typeof supabase.from>)
    .update(updateData as Record<string, unknown>)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/songs');
  return { success: true, id };
}

export async function deleteSong(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // First, remove any event_items referencing this song
  await supabase
    .from('event_items')
    .delete()
    .eq('song_id', id);

  // Then delete the song
  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // Ensure user owns the song

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/songs');
  return { success: true };
}
