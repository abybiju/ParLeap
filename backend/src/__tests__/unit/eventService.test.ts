/**
 * Event Service Unit Tests
 * 
 * Tests for event and song CRUD operations
 */

// Mock Supabase before imports
const mockFrom = jest.fn();
const mockSupabaseClient = {
  from: mockFrom,
} as any;

jest.mock('../../config/supabase', () => ({
  supabase: mockSupabaseClient,
  isSupabaseConfigured: true,
}));

import {
  fetchEventData,
  fetchSongById,
  createSong,
  createEvent,
  addSongToEvent,
  type EventData,
  type SongData,
} from '../../services/eventService';

describe('Event Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockClear();
    // Reset environment
    delete process.env.SUPABASE_FALLBACK_TO_MOCK;
  });

  describe('fetchEventData', () => {
    const mockEventId = 'test-event-id';
    const mockEvent = {
      id: mockEventId,
      name: 'Test Event',
    };

    const mockEventItems = [
      {
        sequence_order: 1,
        songs: {
          id: 'song-1',
          title: 'Amazing Grace',
          artist: 'John Newton',
          lyrics: 'Amazing grace how sweet the sound\nThat saved a wretch like me',
        },
      },
      {
        sequence_order: 2,
        songs: {
          id: 'song-2',
          title: 'How Great Thou Art',
          artist: 'Carl Boberg',
          lyrics: 'O Lord my God when I in awesome wonder\nConsider all the worlds thy hands have made',
        },
      },
    ];

    it('should fetch event data with setlist successfully', async () => {
      // Mock event fetch
      const mockSelect1 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockEvent,
            error: null,
          }),
        }),
      });

      // Mock event items fetch
      const mockSelect2 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockEventItems,
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'events') {
          return { select: mockSelect1 };
        }
        if (table === 'event_items') {
          return { select: mockSelect2 };
        }
        return {};
      });

      const result = await fetchEventData(mockEventId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockEventId);
      expect(result?.name).toBe('Test Event');
      expect(result?.songs).toHaveLength(2);
      expect(result?.songs[0].title).toBe('Amazing Grace');
      expect(result?.songs[0].lines).toHaveLength(2);
      expect(result?.songs[0].lines[0]).toBe('Amazing grace how sweet the sound');
    });

    it('should return null when event not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Event not found' },
          }),
        }),
      });

      mockFrom.mockReturnValue({ select: mockSelect } as any);

      const result = await fetchEventData('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle empty setlist', async () => {
      const mockSelect1 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockEvent,
            error: null,
          }),
        }),
      });

      const mockSelect2 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'events') {
          return { select: mockSelect1 };
        }
        if (table === 'event_items') {
          return { select: mockSelect2 };
        }
        return {};
      });

      const result = await fetchEventData(mockEventId);

      expect(result).not.toBeNull();
      expect(result?.songs).toHaveLength(0);
    });

    it('should parse lyrics into lines correctly', async () => {
      const mockSelect1 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockEvent,
            error: null,
          }),
        }),
      });

      const mockSelect2 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                sequence_order: 1,
                songs: {
                  id: 'song-1',
                  title: 'Test Song',
                  artist: 'Test Artist',
                  lyrics: 'Line 1\n\nLine 2\n  \nLine 3',
                },
              },
            ],
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'events') {
          return { select: mockSelect1 };
        }
        if (table === 'event_items') {
          return { select: mockSelect2 };
        }
        return {};
      });

      const result = await fetchEventData(mockEventId);

      expect(result?.songs[0].lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should filter out null song data', async () => {
      const mockSelect1 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockEvent,
            error: null,
          }),
        }),
      });

      const mockSelect2 = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                sequence_order: 1,
                songs: null, // Null song data
              },
              {
                sequence_order: 2,
                songs: {
                  id: 'song-2',
                  title: 'Valid Song',
                  artist: 'Artist',
                  lyrics: 'Lyrics',
                },
              },
            ],
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'events') {
          return { select: mockSelect1 };
        }
        if (table === 'event_items') {
          return { select: mockSelect2 };
        }
        return {};
      });

      const result = await fetchEventData(mockEventId);

      expect(result?.songs).toHaveLength(1);
      expect(result?.songs[0].title).toBe('Valid Song');
    });
  });

  describe('fetchSongById', () => {
    const mockSongId = 'test-song-id';
    const mockSong = {
      id: mockSongId,
      title: 'Test Song',
      lyrics: 'Line 1\nLine 2\nLine 3',
    };

    it('should fetch song successfully', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockSong,
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValue({ select: mockSelect } as any);

      const result = await fetchSongById(mockSongId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockSongId);
      expect(result?.title).toBe('Test Song');
      expect(result?.lines).toHaveLength(3);
    });

    it('should return null when song not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Song not found' },
          }),
        }),
      });

      mockFrom.mockReturnValue({ select: mockSelect } as any);

      const result = await fetchSongById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('createSong', () => {
    const mockUserId = 'user-123';
    const mockSongData = {
      title: 'New Song',
      artist: 'New Artist',
      lyrics: 'Song lyrics here',
    };

    it('should create song successfully', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'new-song-id' },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await createSong(
        mockUserId,
        mockSongData.title,
        mockSongData.artist,
        mockSongData.lyrics
      );

      expect(result).toBe('new-song-id');
      expect(mockInsert).toHaveBeenCalledWith([
        {
          user_id: mockUserId,
          title: mockSongData.title,
          artist: mockSongData.artist,
          lyrics: mockSongData.lyrics,
        },
      ]);
    });

    it('should handle null artist', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'new-song-id' },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await createSong(mockUserId, 'Song Title', null, 'Lyrics');

      expect(result).toBe('new-song-id');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          artist: null,
        }),
      ]);
    });

    it('should return null on error', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await createSong(mockUserId, 'Title', 'Artist', 'Lyrics');

      expect(result).toBeNull();
    });
  });

  describe('createEvent', () => {
    const mockUserId = 'user-123';
    const mockEventName = 'New Event';

    it('should create event successfully', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'new-event-id' },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await createEvent(mockUserId, mockEventName);

      expect(result).toBe('new-event-id');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: mockUserId,
          name: mockEventName,
          status: 'draft',
        }),
      ]);
    });

    it('should handle event date', async () => {
      const eventDate = new Date('2026-01-26T10:00:00Z');
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'new-event-id' },
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await createEvent(mockUserId, mockEventName, eventDate);

      expect(result).toBe('new-event-id');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_date: eventDate.toISOString(),
        }),
      ]);
    });

    it('should return null on error', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await createEvent(mockUserId, mockEventName);

      expect(result).toBeNull();
    });
  });

  describe('addSongToEvent', () => {
    const mockEventId = 'event-123';
    const mockSongId = 'song-456';
    const mockSequenceOrder = 1;

    it('should add song to event successfully', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        error: null,
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await addSongToEvent(mockEventId, mockSongId, mockSequenceOrder);

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith([
        {
          event_id: mockEventId,
          song_id: mockSongId,
          sequence_order: mockSequenceOrder,
        },
      ]);
    });

    it('should return false on error', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });

      mockFrom.mockReturnValue({ insert: mockInsert } as any);

      const result = await addSongToEvent(mockEventId, mockSongId, mockSequenceOrder);

      expect(result).toBe(false);
    });
  });
});
