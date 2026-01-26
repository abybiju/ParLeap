import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetlistBuilder } from '../SetlistBuilder';

// Mock the server actions
vi.mock('@/app/events/actions', () => ({
  addSongToEvent: vi.fn(),
  removeSongFromEvent: vi.fn(),
  reorderEventItems: vi.fn(),
}));

// Mock the toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

// Import the mocked actions and toast
import { addSongToEvent, removeSongFromEvent, reorderEventItems } from '@/app/events/actions';
import { toast } from 'sonner';

describe('SetlistBuilder', () => {
  const mockEventId = 'event-123';
  const user = userEvent.setup();

  const mockSongs = [
    { id: 'song-1', title: 'Amazing Grace', artist: 'John Newton' },
    { id: 'song-2', title: 'How Great Thou Art', artist: null },
    { id: 'song-3', title: 'It Is Well', artist: 'Horatio Spafford' },
    { id: 'song-4', title: 'Blessed Assurance', artist: 'Fanny Crosby' },
  ];

  const mockInitialSetlist = [
    {
      id: 'item-1',
      songId: 'song-1',
      title: 'Amazing Grace',
      artist: 'John Newton',
      sequenceOrder: 1,
    },
    {
      id: 'item-2',
      songId: 'song-2',
      title: 'How Great Thou Art',
      artist: null,
      sequenceOrder: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render setlist builder with title and instructions', () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={[]}
          songs={mockSongs}
        />
      );

      expect(screen.getByText('Setlist Builder')).toBeInTheDocument();
      expect(screen.getByText(/drag songs to reorder/i)).toBeInTheDocument();
    });

    it('should render empty state when setlist is empty', () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={[]}
          songs={mockSongs}
        />
      );

      expect(screen.getByText(/no songs in the setlist yet/i)).toBeInTheDocument();
    });

    it('should render initial setlist items', () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      expect(screen.getByText(/1\. Amazing Grace/)).toBeInTheDocument();
      expect(screen.getByText('John Newton')).toBeInTheDocument();
      expect(screen.getByText(/2\. How Great Thou Art/)).toBeInTheDocument();
    });

    it('should show only available songs in dropdown (excluding songs already in setlist)', () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option'));
      
      // Should have "Select a song" + 2 available songs (song-3, song-4)
      expect(options).toHaveLength(3);
      expect(options.some(opt => opt.textContent?.includes('It Is Well'))).toBe(true);
      expect(options.some(opt => opt.textContent?.includes('Blessed Assurance'))).toBe(true);
      
      // Should NOT include songs already in setlist
      expect(options.some(opt => opt.textContent?.includes('Amazing Grace'))).toBe(false);
      expect(options.some(opt => opt.textContent?.includes('How Great Thou Art'))).toBe(false);
    });

    it('should disable add button when no song is selected', () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      expect(addButton).toBeDisabled();
    });

    it('should enable add button when a song is selected', async () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'song-3');

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      expect(addButton).not.toBeDisabled();
    });
  });

  describe('Adding Songs', () => {
    it('should call addSongToEvent with correct parameters', async () => {
      vi.mocked(addSongToEvent).mockResolvedValue({ 
        success: true, 
        id: 'item-3' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'song-3');

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(addSongToEvent).toHaveBeenCalledWith('event-123', 'song-3', 3);
      });
    });

    it('should add song to setlist UI after successful add', async () => {
      vi.mocked(addSongToEvent).mockResolvedValue({ 
        success: true, 
        id: 'item-3' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'song-3');

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/3\. It Is Well/)).toBeInTheDocument();
        expect(screen.getByText('Horatio Spafford')).toBeInTheDocument();
      });
    });

    it('should show success toast after adding song', async () => {
      vi.mocked(addSongToEvent).mockResolvedValue({ 
        success: true, 
        id: 'item-3' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'song-3');

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Song added to setlist');
      });
    });

    it('should clear selection after adding song', async () => {
      vi.mocked(addSongToEvent).mockResolvedValue({ 
        success: true, 
        id: 'item-3' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(select, 'song-3');
      expect(select.value).toBe('song-3');

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(select.value).toBe('');
      });
    });

    it('should show error toast on add failure', async () => {
      vi.mocked(addSongToEvent).mockResolvedValue({ 
        success: false, 
        error: 'Database error' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'song-3');

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Database error');
      });

      // Song should NOT be added to UI
      expect(screen.queryByText(/3\. It Is Well/)).not.toBeInTheDocument();
    });

    it('should show info message when no item ID is returned', async () => {
      vi.mocked(addSongToEvent).mockResolvedValue({ 
        success: true,
        // No id returned
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'song-3');

      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(toast.message).toHaveBeenCalledWith('Setlist updated', { 
          description: 'Refresh to see the latest changes.' 
        });
      });
    });

    it('should update available songs after adding', async () => {
      vi.mocked(addSongToEvent).mockResolvedValue({ 
        success: true, 
        id: 'item-3' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      
      // Initially should have song-3 and song-4
      let options = Array.from(select.querySelectorAll('option'));
      expect(options.some(opt => opt.textContent?.includes('It Is Well'))).toBe(true);

      await user.selectOptions(select, 'song-3');
      const addButton = screen.getByRole('button', { name: /add to setlist/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/3\. It Is Well/)).toBeInTheDocument();
      });

      // After adding, song-3 should no longer be in dropdown
      options = Array.from(select.querySelectorAll('option'));
      expect(options.some(opt => opt.textContent?.includes('It Is Well'))).toBe(false);
      expect(options.some(opt => opt.textContent?.includes('Blessed Assurance'))).toBe(true);
    });
  });

  describe('Removing Songs', () => {
    it('should call removeSongFromEvent with correct parameters', async () => {
      vi.mocked(removeSongFromEvent).mockResolvedValue({ success: true });
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const removeButtons = screen.getAllByRole('button', { name: '' }); // Trash buttons
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(removeSongFromEvent).toHaveBeenCalledWith('event-123', 'item-1');
      });
    });

    it('should remove song from setlist UI after successful removal', async () => {
      vi.mocked(removeSongFromEvent).mockResolvedValue({ success: true });
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      expect(screen.getByText(/1\. Amazing Grace/)).toBeInTheDocument();

      const removeButtons = screen.getAllByRole('button', { name: '' }); // Trash buttons
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText(/1\. Amazing Grace/)).not.toBeInTheDocument();
      });
    });

    it('should resequence remaining items after removal', async () => {
      vi.mocked(removeSongFromEvent).mockResolvedValue({ success: true });
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      // Initially: "1. Amazing Grace", "2. How Great Thou Art"
      expect(screen.getByText(/1\. Amazing Grace/)).toBeInTheDocument();
      expect(screen.getByText(/2\. How Great Thou Art/)).toBeInTheDocument();

      // Remove first item
      const removeButtons = screen.getAllByRole('button', { name: '' }); // Trash buttons
      await user.click(removeButtons[0]);

      await waitFor(() => {
        // "How Great Thou Art" should now be #1
        expect(screen.getByText(/1\. How Great Thou Art/)).toBeInTheDocument();
      });

      // Reorder should be called
      expect(reorderEventItems).toHaveBeenCalledWith('event-123', ['item-2']);
    });

    it('should show success toast after removing song', async () => {
      vi.mocked(removeSongFromEvent).mockResolvedValue({ success: true });
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const removeButtons = screen.getAllByRole('button', { name: '' }); // Trash buttons
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Song removed');
      });
    });

    it('should show error toast on removal failure', async () => {
      vi.mocked(removeSongFromEvent).mockResolvedValue({ 
        success: false, 
        error: 'Database error' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const removeButtons = screen.getAllByRole('button', { name: '' }); // Trash buttons
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Database error');
      });

      // Song should still be in UI
      expect(screen.getByText(/1\. Amazing Grace/)).toBeInTheDocument();
    });

    it('should make removed song available in dropdown again', async () => {
      vi.mocked(removeSongFromEvent).mockResolvedValue({ success: true });
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      
      // Initially, Amazing Grace should NOT be in dropdown (it's in setlist)
      let options = Array.from(select.querySelectorAll('option'));
      expect(options.some(opt => opt.textContent?.includes('Amazing Grace'))).toBe(false);

      // Remove Amazing Grace from setlist
      const removeButtons = screen.getAllByRole('button', { name: '' }); // Trash buttons
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText(/1\. Amazing Grace/)).not.toBeInTheDocument();
      });

      // Now Amazing Grace should be available in dropdown
      options = Array.from(select.querySelectorAll('option'));
      expect(options.some(opt => opt.textContent?.includes('Amazing Grace'))).toBe(true);
    });
  });

  describe('Drag and Drop Reordering', () => {
    it('should reorder items on drag and drop', async () => {
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      // Initially: "1. Amazing Grace", "2. How Great Thou Art"
      expect(screen.getByText(/1\. Amazing Grace/)).toBeInTheDocument();
      expect(screen.getByText(/2\. How Great Thou Art/)).toBeInTheDocument();

      // Simulate drag and drop (item-1 dragged to item-2's position)
      const items = screen.getAllByText(/\d\. \w+/);
      const firstItem = items[0].closest('[draggable="true"]') as HTMLElement;
      const secondItem = items[1].closest('[draggable="true"]') as HTMLElement;

      // Trigger drag start on first item
      firstItem.dispatchEvent(new Event('dragstart', { bubbles: true }));

      // Trigger drop on second item
      secondItem.dispatchEvent(new Event('drop', { bubbles: true }));

      await waitFor(() => {
        // Order should be reversed
        expect(screen.getByText(/1\. How Great Thou Art/)).toBeInTheDocument();
        expect(screen.getByText(/2\. Amazing Grace/)).toBeInTheDocument();
      });
    });

    it('should call reorderEventItems with correct order', async () => {
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const items = screen.getAllByText(/\d\. \w+/);
      const firstItem = items[0].closest('[draggable="true"]') as HTMLElement;
      const secondItem = items[1].closest('[draggable="true"]') as HTMLElement;

      firstItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
      secondItem.dispatchEvent(new Event('drop', { bubbles: true }));

      await waitFor(() => {
        expect(reorderEventItems).toHaveBeenCalledWith('event-123', ['item-2', 'item-1']);
      });
    });

    it('should show success toast after reordering', async () => {
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const items = screen.getAllByText(/\d\. \w+/);
      const firstItem = items[0].closest('[draggable="true"]') as HTMLElement;
      const secondItem = items[1].closest('[draggable="true"]') as HTMLElement;

      firstItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
      secondItem.dispatchEvent(new Event('drop', { bubbles: true }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Setlist order saved');
      });
    });

    it('should show error toast on reorder failure', async () => {
      vi.mocked(reorderEventItems).mockResolvedValue({ 
        success: false, 
        error: 'Database error' 
      });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const items = screen.getAllByText(/\d\. \w+/);
      const firstItem = items[0].closest('[draggable="true"]') as HTMLElement;
      const secondItem = items[1].closest('[draggable="true"]') as HTMLElement;

      firstItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
      secondItem.dispatchEvent(new Event('drop', { bubbles: true }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Database error');
      });
    });

    it('should not reorder when dropping on same item', async () => {
      vi.mocked(reorderEventItems).mockResolvedValue({ success: true });

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      const items = screen.getAllByText(/\d\. \w+/);
      const firstItem = items[0].closest('[draggable="true"]') as HTMLElement;

      firstItem.dispatchEvent(new Event('dragstart', { bubbles: true }));
      firstItem.dispatchEvent(new Event('drop', { bubbles: true }));

      // reorderEventItems should not be called
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(reorderEventItems).not.toHaveBeenCalled();
    });
  });

  describe('Artist Display', () => {
    it('should display artist when present', () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={mockInitialSetlist}
          songs={mockSongs}
        />
      );

      expect(screen.getByText('John Newton')).toBeInTheDocument();
    });

    it('should not display artist section when artist is null', () => {
      const setlistWithNoArtist = [
        {
          id: 'item-2',
          songId: 'song-2',
          title: 'How Great Thou Art',
          artist: null,
          sequenceOrder: 1,
        },
      ];

      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={setlistWithNoArtist}
          songs={mockSongs}
        />
      );

      // Should show song title
      expect(screen.getByText(/1\. How Great Thou Art/)).toBeInTheDocument();
      
      // Artist text should not be rendered (checking the specific artist element doesn't exist)
      const songContainer = screen.getByText(/1\. How Great Thou Art/).parentElement?.parentElement;
      const artistElements = songContainer?.querySelectorAll('.text-xs.text-slate-400');
      expect(artistElements?.length).toBe(0);
    });

    it('should display artist in dropdown options', () => {
      render(
        <SetlistBuilder
          eventId={mockEventId}
          initialSetlist={[]}
          songs={mockSongs}
        />
      );

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option'));
      
      // Find the "It Is Well" option
      const itIsWellOption = options.find(opt => opt.textContent?.includes('It Is Well'));
      expect(itIsWellOption?.textContent).toContain('Horatio Spafford');

      // Find the "How Great Thou Art" option (no artist)
      const howGreatOption = options.find(opt => opt.textContent?.includes('How Great Thou Art'));
      expect(howGreatOption?.textContent).not.toContain(' — ');
    });
  });
});
