import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SongEditorModal } from '../SongEditorModal';
import type { Database } from '@/lib/supabase/types';

type Song = Database['public']['Tables']['songs']['Row'];

// Mock the server actions
vi.mock('@/app/songs/actions', () => ({
  createSong: vi.fn(),
  updateSong: vi.fn(),
}));

// Mock the toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Import the mocked actions
import { createSong, updateSong } from '@/app/songs/actions';
import { toast } from 'sonner';

describe('SongEditorModal', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render in create mode when no song is provided', () => {
      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('New Song')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create song/i })).toBeInTheDocument();
    });

    it('should render in edit mode when song is provided', () => {
      const mockSong: Song = {
        id: '123',
        user_id: 'user-1',
        title: 'Amazing Grace',
        artist: 'John Newton',
        ccli_number: '1234567',
        lyrics: 'Amazing grace how sweet the sound',
        created_at: new Date().toISOString(),
      };

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          song={mockSong}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Edit Song')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('Amazing Grace')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Newton')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1234567')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(
        <SongEditorModal
          open={false}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('New Song')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when title is empty', async () => {
      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });
    });

    it('should show error when lyrics are empty', async () => {
      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test Song');

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/lyrics are required/i)).toBeInTheDocument();
      });
    });

    it('should allow submission with only title and lyrics (artist and CCLI optional)', async () => {
      vi.mocked(createSong).mockResolvedValue({ success: true, id: 'new-song-id' });

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      const lyricsInput = screen.getByPlaceholderText(/paste or type your lyrics/i);

      await user.type(titleInput, 'Test Song');
      await user.type(lyricsInput, 'Test lyrics here');

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(createSong).toHaveBeenCalledTimes(1);
      });

      const formData = vi.mocked(createSong).mock.calls[0][0] as FormData;
      expect(formData.get('title')).toBe('Test Song');
      expect(formData.get('lyrics')).toBe('Test lyrics here');
      expect(formData.get('artist')).toBe('');
      expect(formData.get('ccli_number')).toBe('');
    });

    it('should include all fields when provided', async () => {
      vi.mocked(createSong).mockResolvedValue({ success: true, id: 'new-song-id' });

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      const artistInput = screen.getByLabelText(/artist/i);
      const ccliInput = screen.getByLabelText(/ccli #/i);
      const lyricsInput = screen.getByPlaceholderText(/paste or type your lyrics/i);

      await user.type(titleInput, 'Amazing Grace');
      await user.type(artistInput, 'John Newton');
      await user.type(ccliInput, '1234567');
      await user.type(lyricsInput, 'Amazing grace how sweet the sound');

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(createSong).toHaveBeenCalledTimes(1);
      });

      const formData = vi.mocked(createSong).mock.calls[0][0] as FormData;
      expect(formData.get('title')).toBe('Amazing Grace');
      expect(formData.get('artist')).toBe('John Newton');
      expect(formData.get('ccli_number')).toBe('1234567');
      expect(formData.get('lyrics')).toBe('Amazing grace how sweet the sound');
    });
  });

  describe('Form Submission', () => {
    it('should call createSong with correct data', async () => {
      vi.mocked(createSong).mockResolvedValue({ success: true, id: 'new-song-id' });

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      const lyricsInput = screen.getByPlaceholderText(/paste or type your lyrics/i);

      await user.type(titleInput, 'Test Song');
      await user.type(lyricsInput, 'Test lyrics');

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(createSong).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledWith('Song created!');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should call updateSong when editing existing song', async () => {
      const mockSong: Song = {
        id: '123',
        user_id: 'user-1',
        title: 'Original Title',
        artist: null,
        ccli_number: null,
        lyrics: 'Original lyrics',
        created_at: new Date().toISOString(),
      };

      vi.mocked(updateSong).mockResolvedValue({ success: true, id: '123' });

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          song={mockSong}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByDisplayValue('Original Title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      const submitButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(updateSong).toHaveBeenCalledWith('123', expect.any(FormData));
        expect(toast.success).toHaveBeenCalledWith('Song updated!');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error toast on submission failure', async () => {
      vi.mocked(createSong).mockResolvedValue({ 
        success: false, 
        error: 'Database error' 
      });

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      const lyricsInput = screen.getByPlaceholderText(/paste or type your lyrics/i);

      await user.type(titleInput, 'Test Song');
      await user.type(lyricsInput, 'Test lyrics');

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Database error');
        expect(mockOnOpenChange).not.toHaveBeenCalled();
        expect(mockOnSuccess).not.toHaveBeenCalled();
      });
    });

    it('should handle async submission correctly', async () => {
      // Create a promise that we can control
      let resolveCreate: ((value: any) => void) | undefined;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      vi.mocked(createSong).mockReturnValue(createPromise as any);

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      const lyricsInput = screen.getByPlaceholderText(/paste or type your lyrics/i);

      await user.type(titleInput, 'Test Song');
      await user.type(lyricsInput, 'Test lyrics');

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      // CreateSong should be called
      await waitFor(() => {
        expect(createSong).toHaveBeenCalledTimes(1);
      });

      // Success callback shouldn't be called yet
      expect(mockOnSuccess).not.toHaveBeenCalled();

      // Resolve the promise
      resolveCreate!({ success: true, id: 'new-song-id' });

      // Wait for submission to complete
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Draft Functionality', () => {
    it('should auto-save draft when form changes', async () => {
      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Draft Title');

      // Wait for debounced save (2 seconds + buffer)
      await waitFor(() => {
        const draft = localStorage.getItem('parleap_song_draft_new');
        expect(draft).toBeTruthy();
      }, { timeout: 3000 });

      const draft = JSON.parse(localStorage.getItem('parleap_song_draft_new')!);
      expect(draft.data.title).toBe('Draft Title');
    });

    it('should show draft prompt when opening with existing draft', async () => {
      // Pre-populate localStorage with a draft
      const draftData = {
        data: {
          title: 'Draft Title',
          artist: 'Draft Artist',
          lyrics: 'Draft lyrics',
        },
        timestamp: Date.now(),
      };
      localStorage.setItem('parleap_song_draft_new', JSON.stringify(draftData));

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/you have an unsaved draft/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    });

    it('should restore draft when restore button is clicked', async () => {
      const draftData = {
        data: {
          title: 'Draft Title',
          artist: 'Draft Artist',
          lyrics: 'Draft lyrics',
          ccli_number: '999',
        },
        timestamp: Date.now(),
      };
      localStorage.setItem('parleap_song_draft_new', JSON.stringify(draftData));

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const restoreButton = screen.getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Draft Title')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Draft Artist')).toBeInTheDocument();
        expect(screen.getByDisplayValue('999')).toBeInTheDocument();
        expect(screen.queryByText(/you have an unsaved draft/i)).not.toBeInTheDocument();
      });
    });

    it('should discard draft when discard button is clicked', async () => {
      const draftData = {
        data: {
          title: 'Draft Title',
          lyrics: 'Draft lyrics',
        },
        timestamp: Date.now(),
      };
      localStorage.setItem('parleap_song_draft_new', JSON.stringify(draftData));

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const discardButton = screen.getByRole('button', { name: /discard/i });
      await user.click(discardButton);

      await waitFor(() => {
        expect(screen.queryByText(/you have an unsaved draft/i)).not.toBeInTheDocument();
        expect(localStorage.getItem('parleap_song_draft_new')).toBeNull();
      });
    });

    it('should clear draft on successful submission', async () => {
      vi.mocked(createSong).mockResolvedValue({ success: true, id: 'new-song-id' });

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      const lyricsInput = screen.getByPlaceholderText(/paste or type your lyrics/i);

      await user.type(titleInput, 'Test Song');
      await user.type(lyricsInput, 'Test lyrics');

      // Wait for draft to be saved
      await waitFor(() => {
        expect(localStorage.getItem('parleap_song_draft_new')).toBeTruthy();
      }, { timeout: 3000 });

      const submitButton = screen.getByRole('button', { name: /create song/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(localStorage.getItem('parleap_song_draft_new')).toBeNull();
      });
    });

    it('should show "Draft auto-saved" indicator when form is dirty', async () => {
      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'T');

      await waitFor(() => {
        expect(screen.getByText(/draft auto-saved/i)).toBeInTheDocument();
      });
    });

    it('should not show draft prompt for expired drafts', async () => {
      const draftData = {
        data: {
          title: 'Old Draft',
          lyrics: 'Old lyrics',
        },
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };
      localStorage.setItem('parleap_song_draft_new', JSON.stringify(draftData));

      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      // Should not show draft prompt
      expect(screen.queryByText(/you have an unsaved draft/i)).not.toBeInTheDocument();
      
      // Draft should be removed from localStorage
      await waitFor(() => {
        expect(localStorage.getItem('parleap_song_draft_new')).toBeNull();
      });
    });

    it('should use separate draft keys for new vs editing song', async () => {
      const mockSong: Song = {
        id: 'song-123',
        user_id: 'user-1',
        title: 'Existing Song',
        artist: null,
        ccli_number: null,
        lyrics: 'Existing lyrics',
        created_at: new Date().toISOString(),
      };

      const { rerender } = render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'New Song Draft');

      // Wait for draft save
      await waitFor(() => {
        expect(localStorage.getItem('parleap_song_draft_new')).toBeTruthy();
      }, { timeout: 3000 });

      // Close and reopen with song for editing
      rerender(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          song={mockSong}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInputEdit = screen.getByDisplayValue('Existing Song');
      await user.type(titleInputEdit, ' Edited');

      // Wait for draft save with song-specific key
      await waitFor(() => {
        expect(localStorage.getItem('parleap_song_draft_song-123')).toBeTruthy();
      }, { timeout: 3000 });

      // Both drafts should exist
      expect(localStorage.getItem('parleap_song_draft_new')).toBeTruthy();
      expect(localStorage.getItem('parleap_song_draft_song-123')).toBeTruthy();
    });
  });

  describe('Cancel Behavior', () => {
    it('should close modal when cancel button is clicked', async () => {
      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should keep draft when canceling', async () => {
      render(
        <SongEditorModal
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test Draft');

      // Wait for draft save
      await waitFor(() => {
        expect(localStorage.getItem('parleap_song_draft_new')).toBeTruthy();
      }, { timeout: 3000 });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Draft should still exist
      expect(localStorage.getItem('parleap_song_draft_new')).toBeTruthy();
    });
  });
});
