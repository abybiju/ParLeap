/**
 * Event Service
 * 
 * Fetches event data from Supabase including songs and setlist
 * Falls back to mock data when Supabase isn't configured
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';

export interface SongData {
  id: string;
  title: string;
  artist?: string;
  lyrics?: string; // Full lyrics (for display)
  lines: string[]; // Pre-split lines for matching
}

export interface EventData {
  id: string;
  name: string;
  songs: SongData[];
}

// Mock data for development without Supabase
const mockEventData: EventData = {
  id: 'demo-event',
  name: 'Demo Event',
  songs: [
    {
      id: 'song_1',
      title: 'Amazing Grace',
      artist: 'John Newton',
      lyrics: 'Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see',
      lines: [
        'Amazing grace how sweet the sound',
        'That saved a wretch like me',
        'I once was lost but now am found',
        'Was blind but now I see',
      ],
    },
    {
      id: 'song_2',
      title: 'How Great Thou Art',
      artist: 'Carl Boberg',
      lyrics: 'O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made\nI see the stars, I hear the rolling thunder\nThy power throughout the universe displayed',
      lines: [
        'O Lord my God when I in awesome wonder',
        'Consider all the worlds thy hands have made',
        'I see the stars I hear the rolling thunder',
        'Thy power throughout the universe displayed',
      ],
    },
  ],
};

const fallbackToMockData = process.env.SUPABASE_FALLBACK_TO_MOCK === 'true';

function getMockEventData(eventId: string): EventData {
  return { ...mockEventData, id: eventId };
}

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

    // 2. Fetch event items (setlist) with song details
    const { data: eventItems, error: itemsError } = await supabase
      .from('event_items')
      .select('sequence_order, songs(id, title, lyrics)')
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

    // 3. Parse lyrics into lines for each song
    const songs: SongData[] = eventItems
      .map((item) => {
        const songInfo = item.songs as unknown as (SongData & { lyrics: string }) | null;
        if (!songInfo) {
          console.warn(`[EventService] Song data is null for event item`);
          return null;
        }

        return {
          id: songInfo.id,
          title: songInfo.title,
          lines: parseLyrics(songInfo.lyrics),
        };
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
      .select('id, title, lyrics')
      .eq('id', songId)
      .single();

    if (error || !data) {
      console.error(`[EventService] Failed to fetch song ${songId}:`, error);
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      lines: parseLyrics(data.lyrics),
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

