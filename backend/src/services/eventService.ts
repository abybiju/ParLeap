/**
 * Event Service
 * 
 * Fetches event data from Supabase including songs and setlist
 * Falls back to mock data when Supabase isn't configured
 */

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import {
  compileSlides,
  mergeSlideConfig,
  type SlideConfig,
  type SlideCompilationResult,
} from './slideService';
import { fetchTemplates, applyTemplateToLines, incrementTemplateUsage } from './templateService';

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

export interface AnnouncementStructuredText {
  title?: string;
  subtitle?: string;
  date?: string;
  lines?: string[];
}

export interface AnnouncementSlideData {
  url?: string;
  type?: 'image' | 'video';
  title?: string;
  structuredText?: AnnouncementStructuredText;
}

export interface SetlistItemData {
  id: string;
  type: 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT';
  sequenceOrder: number;
  songId?: string;
  bibleRef?: string;
  mediaUrl?: string;
  mediaTitle?: string;
  announcementSlides?: AnnouncementSlideData[];
}

export interface EventData {
  id: string;
  name: string;
  songs: SongData[];
  setlistItems?: SetlistItemData[]; // Polymorphic setlist items
  projectorFont?: string | null;
  bibleMode?: boolean;
  bibleVersionId?: string | null;
  backgroundImageUrl?: string | null;
}


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
    projectorFont: 'inter',
    bibleMode: false,
    bibleVersionId: null,
    backgroundImageUrl: null,
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
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
    console.log('[EventService] Using mock data (Supabase not configured)');
    return getMockEventData(eventId);
  }

  try {
    // 1. Fetch event details
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, name, projector_font, bible_mode, bible_version_id, background_image_url')
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

    // 2. Fetch event items (setlist) with polymorphic support
    // Use TWO separate queries to avoid PostgREST INNER JOIN on songs() embed
    // which filters out Bible/Media items when song_id IS NULL.
    let setlistItems: SetlistItemData[] | null = null;
    let rawItems: Array<{
      id: string;
      sequence_order: number;
      item_type?: string | null;
      song_id?: string | null;
      slide_config_override?: SlideConfig | null;
      bible_ref?: string | null;
      media_url?: string | null;
      media_title?: string | null;
      announcement_slides?: AnnouncementSlideData[] | null;
    }> | null = null;
    const songsMap: Map<string, { id: string; title: string; artist: string | null; lyrics: string; slide_config?: SlideConfig; ccli_number?: string | null }> = new Map();

    // Query 1: Fetch ALL event_items WITHOUT the songs() embed (avoids INNER JOIN issue)
    const { data: allItems, error: itemsError } = await supabase
      .from('event_items')
      .select('id, sequence_order, item_type, song_id, slide_config_override, bible_ref, media_url, media_title, announcement_slides')
      .eq('event_id', eventId)
      .order('sequence_order', { ascending: true });

    // If new columns don't exist (42703), fall back to minimal query
    if (itemsError && itemsError.code === '42703') {
      console.warn('[EventService] New columns not found - migrations may not be applied. Using fallback query.');
      const { data: oldItems, error: oldError } = await supabase
        .from('event_items')
        .select('id, sequence_order, song_id')
        .eq('event_id', eventId)
        .order('sequence_order', { ascending: true });

      if (oldError) {
        console.error(`[EventService] Fallback query failed for ${eventId}:`, oldError);
        if (fallbackToMockData) {
          console.warn('[EventService] Falling back to mock data (SUPABASE_FALLBACK_TO_MOCK=true)');
          return getMockEventData(eventId);
        }
        return null;
      }
      rawItems = (oldItems ?? []).map((i: { id: string; sequence_order: number; song_id?: string | null }) => ({
        id: i.id,
        sequence_order: i.sequence_order,
        song_id: i.song_id ?? null,
      }));
    } else if (itemsError) {
      console.error(`[EventService] Failed to fetch event items for ${eventId}:`, itemsError);
      if (fallbackToMockData) {
        console.warn('[EventService] Falling back to mock data (SUPABASE_FALLBACK_TO_MOCK=true)');
        return getMockEventData(eventId);
      }
      return null;
    } else {
      rawItems = allItems;
    }

    if (!rawItems || rawItems.length === 0) {
      console.warn(`[EventService] No items found in setlist for event ${eventId}`);
      if (fallbackToMockData) {
        console.warn('[EventService] Falling back to mock data (SUPABASE_FALLBACK_TO_MOCK=true)');
        return getMockEventData(eventId);
      }
      return {
        id: eventData.id,
        name: eventData.name,
        projectorFont: eventData.projector_font ?? null,
        bibleMode: eventData.bible_mode ?? false,
        bibleVersionId: eventData.bible_version_id ?? null,
        backgroundImageUrl: eventData.background_image_url ?? null,
        songs: [],
        setlistItems: [],
      };
    }

    console.log(`[EventService] Fetched ${rawItems.length} event_items for event ${eventId}:`,
      rawItems.map((i) => `${i.id.slice(0, 8)} type=${i.item_type ?? 'null'} song_id=${i.song_id?.slice(0, 8) ?? 'null'} bible_ref=${i.bible_ref ?? 'null'}`));

    // Query 2: Fetch songs separately for all song_id references
    const songIds = rawItems.filter((i) => i.song_id).map((i) => i.song_id as string);
    if (songIds.length > 0) {
      // Try with slide_config first
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('id, title, artist, lyrics, slide_config, ccli_number')
        .in('id', songIds);

      if (songsError && songsError.code === '42703') {
        // slide_config column might not exist
        console.warn('[EventService] songs.slide_config not found, using fallback.');
        const { data: songsDataOld } = await supabase
          .from('songs')
          .select('id, title, artist, lyrics, ccli_number')
          .in('id', songIds);
        if (songsDataOld) {
          for (const s of songsDataOld as Array<{ id: string; title: string; artist: string | null; lyrics: string; ccli_number?: string | null }>) {
            songsMap.set(s.id, s);
          }
        }
      } else if (songsData) {
        for (const s of songsData as Array<{ id: string; title: string; artist: string | null; lyrics: string; slide_config?: SlideConfig; ccli_number?: string | null }>) {
          songsMap.set(s.id, s);
        }
      }
    }

    // Build polymorphic setlistItems
    setlistItems = rawItems.map((item) => {
      const itemType =
        item.item_type ||
        (item.song_id ? 'SONG' : null) ||
        (item.bible_ref ? 'BIBLE' : null) ||
        (item.media_url ? 'MEDIA' : null) ||
        (item.announcement_slides && Array.isArray(item.announcement_slides) && item.announcement_slides.length > 0 ? 'ANNOUNCEMENT' : null) ||
        'SONG';
      const slides = item.announcement_slides && Array.isArray(item.announcement_slides)
        ? (item.announcement_slides as AnnouncementSlideData[])
        : undefined;
      return {
        id: item.id,
        type: itemType as 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT',
        sequenceOrder: item.sequence_order,
        songId: itemType === 'SONG' ? (item.song_id || undefined) : undefined,
        bibleRef: itemType === 'BIBLE' ? (item.bible_ref || undefined) : undefined,
        mediaUrl: itemType === 'MEDIA' ? (item.media_url || undefined) : undefined,
        mediaTitle: itemType === 'MEDIA' ? (item.media_title || undefined) : undefined,
        announcementSlides: itemType === 'ANNOUNCEMENT' ? slides : undefined,
      };
    });

    console.log(`[EventService] Built ${setlistItems.length} setlistItems:`,
      setlistItems.map((i) => `${i.type} id=${i.id.slice(0, 8)} songId=${i.songId?.slice(0, 8) ?? '-'} bibleRef=${i.bibleRef ?? '-'}`));

    // 3. Parse lyrics into lines and compile slides for each song (only SONG items)
    const songs: SongData[] = [];
    for (const item of rawItems) {
      const itemType = item.item_type || (item.song_id ? 'SONG' : null);
      if (itemType && itemType !== 'SONG') continue;

      const songInfo = item.song_id ? songsMap.get(item.song_id) : null;
      if (!songInfo) {
        console.warn(`[EventService] Song data is null for event item ${item.id} (song_id: ${item.song_id})`);
        continue;
      }

      // Merge song default config with event override
      const songSlideConfig = songInfo.slide_config;
      const eventOverride = item.slide_config_override ?? undefined;
      const mergedConfig = mergeSlideConfig(songSlideConfig, eventOverride);

      // Compile slides
      const compilation = compileSlides(songInfo.lyrics, mergedConfig);
      console.log(
        `[EventService] Compiled song "${songInfo.title}": ${compilation.slides.length} slides from ${compilation.lines.length} lines (config: ${mergedConfig.linesPerSlide} lines/slide)`
      );

      let slides = compilation.slides;
      let lineToSlideIndex = compilation.lineToSlideIndex;

      // Try community template if CCLI present
      if (songInfo.ccli_number && compilation.lines.length > 0) {
        const templates = await fetchTemplates(songInfo.ccli_number, compilation.lines.length);
        const best = templates.find((t) => t.score >= -5) ?? templates[0];
        if (best) {
          const applied = applyTemplateToLines(compilation.lines, best.slides as Array<{ start_line: number; end_line: number }>);
          if (applied) {
            slides = applied.slides;
            lineToSlideIndex = applied.lineToSlideIndex;
            void incrementTemplateUsage(best.id);
            console.log(`[EventService] Applied community template ${best.id} for CCLI ${songInfo.ccli_number}`);
          }
        }
      }

      const songData: SongData = {
        id: songInfo.id,
        title: songInfo.title,
        artist: songInfo.artist || undefined,
        lyrics: songInfo.lyrics, // Keep full lyrics for reference
        lines: compilation.lines, // Non-empty lines for matching
        slides,
        lineToSlideIndex,
        slideConfig: mergedConfig, // Applied config
      };
      songs.push(songData);
    }

    return {
      id: eventData.id,
      name: eventData.name,
      projectorFont: eventData.projector_font ?? null,
      bibleMode: eventData.bible_mode ?? false,
      bibleVersionId: eventData.bible_version_id ?? null,
      backgroundImageUrl: eventData.background_image_url ?? null,
      songs,
      setlistItems: setlistItems || undefined, // Include polymorphic setlist items
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
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
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
 * Fetch a single event_item by id (for GO_TO_ITEM when backend setlist is shorter than frontend).
 * Returns SetlistItemData or null. Used when itemIndex is out of range but client sends itemId.
 */
export async function fetchEventItemById(
  eventId: string,
  itemId: string
): Promise<SetlistItemData | null> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('event_items')
      .select('id, sequence_order, item_type, song_id, bible_ref, media_url, media_title, announcement_slides')
      .eq('event_id', eventId)
      .eq('id', itemId)
      .single();

    if (error) {
      if (error.code === '42703') return null;
      console.error('[EventService] fetchEventItemById failed:', error);
      return null;
    }
    if (!data) return null;

    const item = data as {
      id: string;
      sequence_order: number;
      item_type?: string | null;
      song_id?: string | null;
      bible_ref?: string | null;
      media_url?: string | null;
      media_title?: string | null;
      announcement_slides?: AnnouncementSlideData[] | null;
    };
    const itemType =
      item.item_type ||
      (item.song_id ? 'SONG' : null) ||
      (item.bible_ref ? 'BIBLE' : null) ||
      (item.media_url ? 'MEDIA' : null) ||
      (item.announcement_slides && Array.isArray(item.announcement_slides) && item.announcement_slides.length > 0 ? 'ANNOUNCEMENT' : null) ||
      'SONG';
    const slides =
      item.announcement_slides && Array.isArray(item.announcement_slides)
        ? (item.announcement_slides as AnnouncementSlideData[])
        : undefined;
    return {
      id: item.id,
      type: itemType as SetlistItemData['type'],
      sequenceOrder: item.sequence_order,
      songId: itemType === 'SONG' ? (item.song_id || undefined) : undefined,
      bibleRef: itemType === 'BIBLE' ? (item.bible_ref || undefined) : undefined,
      mediaUrl: itemType === 'MEDIA' ? (item.media_url || undefined) : undefined,
      mediaTitle: itemType === 'MEDIA' ? (item.media_title || undefined) : undefined,
      announcementSlides: itemType === 'ANNOUNCEMENT' ? slides : undefined,
    };
  } catch (err) {
    console.error('[EventService] fetchEventItemById error:', err);
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
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
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
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
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
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
    console.log('[EventService] Cannot add song to event - Supabase not configured');
    return false;
  }

  try {
    // Use new schema with item_type if available, fallback to old schema
    const insertData: Record<string, unknown> = {
      event_id: eventId,
      song_id: songId,
      sequence_order: sequenceOrder,
    };
    
    // Try to add item_type if column exists (migration 011 applied)
    try {
      insertData.item_type = 'SONG';
    } catch {
      // Column doesn't exist, use old format
    }

    const { error } = await supabase
      .from('event_items')
      .insert([insertData]);

    if (error) {
      // If item_type column doesn't exist, try without it (backward compatibility)
      if (error.code === '42703' && error.message?.includes('item_type')) {
        const { error: fallbackError } = await supabase
          .from('event_items')
          .insert([
            {
              event_id: eventId,
              song_id: songId,
              sequence_order: sequenceOrder,
            },
          ]);
        
        if (fallbackError) {
          console.error('[EventService] Failed to add song to event:', fallbackError);
          return false;
        }
        return true;
      }
      
      console.error('[EventService] Failed to add song to event:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[EventService] Error adding song to event:', error);
    return false;
  }
}
