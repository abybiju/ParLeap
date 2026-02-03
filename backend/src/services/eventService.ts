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

// Types for Supabase query results (with/without slide_config)
type EventItemWithSlideConfig = {
  sequence_order: number;
  slide_config_override: SlideConfig | null;
  songs: {
    id: string;
    title: string;
    artist: string | null;
    lyrics: string;
    slide_config?: SlideConfig;
  } | null;
};

type EventItemWithoutSlideConfig = {
  sequence_order: number;
  slide_config_override: SlideConfig | null;
  songs: {
    id: string;
    title: string;
    artist: string | null;
    lyrics: string;
  } | null;
};

type EventItem = EventItemWithSlideConfig | EventItemWithoutSlideConfig;

interface SongWithSlideConfig {
  id: string;
  title: string;
  lyrics: string;
  slide_config?: SlideConfig;
}

interface SongWithoutSlideConfig {
  id: string;
  title: string;
  lyrics: string;
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
    // Try with slide_config first (if migration 006 has been run)
    let eventItems: EventItem[] | null = null;
    let itemsError: { code?: string; message?: string } | null = null;
    
    // First attempt: try with slide_config and slide_config_override (new schema)
    const { data: itemsWithConfig, error: errorWithConfig } = await supabase
      .from('event_items')
      .select('sequence_order, slide_config_override, songs(id, title, artist, lyrics, slide_config)')
      .eq('event_id', eventId)
      .order('sequence_order', { ascending: true });

    // If column doesn't exist (migration not run), fall back to query without slide_config columns
    if (errorWithConfig && errorWithConfig.code === '42703' && 
        (errorWithConfig.message?.includes('slide_config') || errorWithConfig.message?.includes('slide_config_override'))) {
      console.warn('[EventService] slide_config columns not found - migration 006 may not be applied. Using fallback query.');
      const { data: itemsWithoutConfig, error: errorWithoutConfig } = await supabase
        .from('event_items')
        .select('sequence_order, songs(id, title, artist, lyrics)')
        .eq('event_id', eventId)
        .order('sequence_order', { ascending: true });
      
      eventItems = itemsWithoutConfig as EventItem[] | null;
      itemsError = errorWithoutConfig;
    } else {
      eventItems = itemsWithConfig as EventItem[] | null;
      itemsError = errorWithConfig;
    }

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
        // slide_config and slide_config_override may not exist if migration 006 hasn't been run
        const songSlideConfig = 'slide_config' in songInfo ? songInfo.slide_config : undefined;
        const eventOverride = 'slide_config_override' in item && item.slide_config_override 
          ? (item.slide_config_override as SlideConfig | null) ?? undefined
          : undefined;
        const mergedConfig = mergeSlideConfig(songSlideConfig, eventOverride);

        // Compile slides
        const compilation = compileSlides(songInfo.lyrics, mergedConfig);
        console.log(`[EventService] Compiled song "${songInfo.title}": ${compilation.slides.length} slides from ${compilation.lines.length} lines (config: ${mergedConfig.linesPerSlide} lines/slide)`);

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
 * Fetch a single song by ID
 */
export async function fetchSongById(songId: string): Promise<SongData | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[EventService] Cannot fetch song - Supabase not configured');
    return null;
  }

  try {
    // Try with slide_config first (if migration 006 has been run)
    let songData: SongWithSlideConfig | SongWithoutSlideConfig | null = null;
    let fetchError: { code?: string; message?: string } | null = null;
    
    const { data: dataWithConfig, error: errorWithConfig } = await supabase
      .from('songs')
      .select('id, title, lyrics, slide_config')
      .eq('id', songId)
      .single();

    // If column doesn't exist (migration not run), fall back to query without slide_config
    if (errorWithConfig && errorWithConfig.code === '42703' && errorWithConfig.message?.includes('slide_config')) {
      console.warn('[EventService] slide_config column not found - migration 006 may not be applied. Using fallback query.');
      const { data: dataWithoutConfig, error: errorWithoutConfig } = await supabase
        .from('songs')
        .select('id, title, lyrics')
        .eq('id', songId)
        .single();
      
      songData = dataWithoutConfig as SongWithoutSlideConfig | null;
      fetchError = errorWithoutConfig;
    } else {
      songData = dataWithConfig as SongWithSlideConfig | null;
      fetchError = errorWithConfig;
    }

    if (fetchError || !songData) {
      console.error(`[EventService] Failed to fetch song ${songId}:`, fetchError);
      return null;
    }

    // Compile slides with default config (slide_config may not exist if migration not run)
    const songSlideConfig = 'slide_config' in songData ? songData.slide_config : undefined;
    const defaultConfig = mergeSlideConfig(songSlideConfig, undefined);
    const compilation = compileSlides(songData.lyrics, defaultConfig);

    return {
      id: songData.id,
      title: songData.title,
      lyrics: songData.lyrics,
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

