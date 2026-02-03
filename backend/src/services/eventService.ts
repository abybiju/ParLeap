/**
 * Event Service
 * 
 * Fetches event data from Supabase including songs and setlist
 * Falls back to mock data when Supabase isn't configured
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  compileSlides,
  mergeSlideConfig,
  type SlideConfig,
  type SlideCompilationResult,
} from './slideService';

export interface SongData {
  id: string;
  title: string;
  artist?: string;
  lyrics?: string; // Full lyrics (for display)
  lines: string[]; // Pre-split lines for matching
  slides?: SlideCompilationResult['slides']; // Compiled slides (multi-line)
  lineToSlideIndex?: number[]; // Mapping: lineIndex -> slideIndex
  slideConfig?: SlideConfig; // Applied config (for reference)
}

export interface EventData {
  id: string;
  name: string;
  songs: SongData[];
}

// Mock data for development without Supabase
function getMockEventData(eventId: string): EventData {
  const song1Lyrics = 'Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see';
  const song2Lyrics = 'O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made\nI see the stars, I hear the rolling thunder\nThy power throughout the universe displayed';
  
  // Compile slides for mock songs
  const defaultConfig = mergeSlideConfig(undefined, undefined);
  const song1Compilation = compileSlides(song1Lyrics, defaultConfig);
  const song2Compilation = compileSlides(song2Lyrics, defaultConfig);

  return {
    id: eventId,
    name: 'Demo Event',
    songs: [
      {
        id: 'song_1',
        title: 'Amazing Grace',
        artist: 'John Newton',
        lyrics: song1Lyrics,
        lines: song1Compilation.lines,
        slides: song1Compilation.slides,
        lineToSlideIndex: song1Compilation.lineToSlideIndex,
        slideConfig: defaultConfig,
      },
      {
        id: 'song_2',
        title: 'How Great Thou Art',
        artist: 'Carl Boberg',
        lyrics: song2Lyrics,
        lines: song2Compilation.lines,
        slides: song2Compilation.slides,
        lineToSlideIndex: song2Compilation.lineToSlideIndex,
        slideConfig: defaultConfig,
      },
    ],
  };
}

const fallbackToMockData = process.env.SUPABASE_FALLBACK_TO_MOCK === 'true';

/**
 * Fetch event data from Supabase
 * This includes the event name and all songs in the setlist
 * Falls back to mock data when Supabase isn't configured
 */
export async function fetchEventData(eventId: string): Promise<EventData | null> {
  // Use mock data if Supabase isn't configured
  if (!isSupabaseConfigured || !supabase) {
    console.log('[EventService] Using mock data (Supabase not configured)');
    return getMockEventData(eventId);
  }

  try {
    // 1. Fetch event details
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      console.error(`[EventService] Failed to fetch event ${eventId}:`, eventError);
      if (fallbackToMockData) {
        console.warn('[EventService] Falling back to mock data (SUPABASE_FALLBACK_TO_MOCK=true)');
        return getMockEventData(eventId);
      }
      return null;
    }

    // 2. Fetch event items (setlist) with song details and slide configs
    const { data: eventItems, error: itemsError } = await supabase
      .from('event_items')
      .select('sequence_order, slide_config_override, songs(id, title, artist, lyrics, slide_config)')
      .eq('event_id', eventId)
      .order('sequence_order', { ascending: true });

    if (itemsError) {
      console.error(`[EventService] Failed to fetch event items for ${eventId}:`, itemsError);
      if (fallbackToMockData) {
        console.warn('[EventService] Falling back to mock data (SUPABASE_FALLBACK_TO_MOCK=true)');
        return getMockEventData(eventId);
      }
      return null;
    }

    if (!eventItems || eventItems.length === 0) {
      console.warn(`[EventService] No songs found in setlist for event ${eventId}`);
      if (fallbackToMockData) {
        console.warn('[EventService] Falling back to mock data (SUPABASE_FALLBACK_TO_MOCK=true)');
        return getMockEventData(eventId);
      }
      return {
        id: eventData.id,
        name: eventData.name,
        songs: [],
      };
    }

    // 3. Parse lyrics into lines and compile slides for each song
    const songs = eventItems
      .map((item) => {
        const songInfo = item.songs as unknown as (SongData & { lyrics: string; slide_config?: SlideConfig }) | null;
        if (!songInfo) {
          console.warn(`[EventService] Song data is null for event item`);
          return null;
        }

        // Merge song default config with event override
        const eventOverride = (item.slide_config_override as SlideConfig | null) ?? undefined;
        const mergedConfig = mergeSlideConfig(songInfo.slide_config, eventOverride);

        // Compile slides
        const compilation = compileSlides(songInfo.lyrics, mergedConfig);

        const songData: SongData = {
          id: songInfo.id,
          title: songInfo.title,
          artist: songInfo.artist || undefined,
          lyrics: songInfo.lyrics, // Keep full lyrics for reference
          lines: compilation.lines, // Non-empty lines for matching
          slides: compilation.slides, // Compiled multi-line slides
          lineToSlideIndex: compilation.lineToSlideIndex, // Mapping for slide lookups
          slideConfig: mergedConfig, // Applied config
        };
        return songData;
      })
      .filter((song): song is SongData => song !== null);

    return {
      id: eventData.id,
      name: eventData.name,
      songs,
    };
  } catch (error) {
    console.error('[EventService] Error fetching event data:', error);
    if (fallbackToMockData) {
      console.warn('[EventService] Falling back to mock data (SUPABASE_FALLBACK_TO_MOCK=true)');
      return getMockEventData(eventId);
    }
    return null;
  }
}

/**
 * Parse lyrics into lines
 * Splits by newline and filters empty lines
 * @deprecated Use slideService.parseLyricLines instead
 */
function parseLyrics(lyrics: string): string[] {
  return lyrics
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Fetch a single song by ID
 */
export async function fetchSongById(songId: string): Promise<SongData | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[EventService] Cannot fetch song - Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, lyrics, slide_config')
      .eq('id', songId)
      .single();

    if (error || !data) {
      console.error(`[EventService] Failed to fetch song ${songId}:`, error);
      return null;
    }

    // Compile slides with default config (no event override)
    const defaultConfig = mergeSlideConfig(data.slide_config as SlideConfig | undefined, undefined);
    const compilation = compileSlides(data.lyrics, defaultConfig);

    return {
      id: data.id,
      title: data.title,
      lyrics: data.lyrics,
      lines: compilation.lines,
      slides: compilation.slides,
      lineToSlideIndex: compilation.lineToSlideIndex,
      slideConfig: defaultConfig,
    };
  } catch (error) {
    console.error('[EventService] Error fetching song:', error);
    return null;
  }
}

/**
 * Create a new song
 */
export async function createSong(
  userId: string,
  title: string,
  artist: string | null,
  lyrics: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[EventService] Cannot create song - Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('songs')
      .insert([
        {
          user_id: userId,
          title,
          artist,
          lyrics,
        },
      ])
      .select('id')
      .single();

    if (error || !data) {
      console.error('[EventService] Failed to create song:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[EventService] Error creating song:', error);
    return null;
  }
}

/**
 * Create a new event
 */
export async function createEvent(
  userId: string,
  name: string,
  eventDate?: Date
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[EventService] Cannot create event - Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          user_id: userId,
          name,
          event_date: eventDate?.toISOString() || null,
          status: 'draft',
        },
      ])
      .select('id')
      .single();

    if (error || !data) {
      console.error('[EventService] Failed to create event:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[EventService] Error creating event:', error);
    return null;
  }
}

/**
 * Add a song to an event's setlist
 */
export async function addSongToEvent(
  eventId: string,
  songId: string,
  sequenceOrder: number
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[EventService] Cannot add song to event - Supabase not configured');
    return false;
  }

  try {
    const { error } = await supabase
      .from('event_items')
      .insert([
        {
          event_id: eventId,
          song_id: songId,
          sequence_order: sequenceOrder,
        },
      ]);

    if (error) {
      console.error('[EventService] Failed to add song to event:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[EventService] Error adding song to event:', error);
    return false;
  }
}

