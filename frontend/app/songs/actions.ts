'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { songSchema } from '@/lib/schemas/song';
import { compileSlides, mergeSlideConfig, parseLyricLines } from '@/lib/slideServiceProxy';

export interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
  savedToCommunity?: boolean;
  communityLimitReached?: boolean;
}

function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (process.env.NEXT_PUBLIC_WS_URL) {
    const u = process.env.NEXT_PUBLIC_WS_URL;
    return u.startsWith('wss://') ? u.replace(/^wss:\/\//, 'https://') : u.replace(/^ws:\/\//, 'http://');
  }
  return 'http://localhost:3001';
}

export async function createSong(
  formData: FormData,
  options?: { saveToCommunity?: boolean }
): Promise<ActionResult> {
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
      error: result.error.issues[0]?.message || 'Validation failed',
    };
  }

  const insertData = {
    title: result.data.title,
    artist: result.data.artist || null,
    ccli_number: result.data.ccli_number || null,
    lyrics: result.data.lyrics,
    user_id: user.id,
  };

  const { data, error } = await (supabase
    .from('songs') as ReturnType<typeof supabase.from>)
    .insert(insertData as Record<string, unknown>)
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const songId = (data as { id: string } | null)?.id;
  let savedToCommunity = false;
  let communityLimitReached = false;

  if (options?.saveToCommunity && result.data.ccli_number && result.data.lyrics) {
    const lines = parseLyricLines(result.data.lyrics);
    if (lines.length > 0) {
      const compilation = compileSlides(result.data.lyrics, mergeSlideConfig(null, null));
      const slides = compilation.slides.map((s: { startLineIndex: number; endLineIndex: number }) => ({
        start_line: s.startLineIndex,
        end_line: s.endLineIndex,
      }));
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ccliNumber: result.data.ccli_number,
            lineCount: lines.length,
            linesPerSlide: 4,
            slides,
            sections: [],
            userId: user.id,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (json.limitReached) {
          communityLimitReached = true;
        } else if (res.ok && json.success && json.id) {
          savedToCommunity = true;
        }
      } catch {
        // Song is created; community save failed
      }
    }
  }

  revalidatePath('/songs');
  return {
    success: true,
    id: songId,
    savedToCommunity,
    communityLimitReached,
  };
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

export async function updateSongSlideConfig(
  songId: string,
  slideConfig: { linesPerSlide?: number; respectStanzaBreaks?: boolean; manualBreaks?: number[] }
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await (supabase
    .from('songs') as ReturnType<typeof supabase.from>)
    .update({ slide_config: slideConfig as Record<string, unknown> })
    .eq('id', songId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/songs');
  return { success: true, id: songId };
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
