'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SongDataTable } from '@/components/songs/SongDataTable';
import { SongEditorModal } from '@/components/songs/SongEditorModal';
import { deleteSong } from './actions';
import type { Database } from '@/lib/supabase/types';

type Song = Database['public']['Tables']['songs']['Row'];

interface SongsPageClientProps {
  initialSongs: Song[];
}

export function SongsPageClient({ initialSongs }: SongsPageClientProps) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNewSong = useCallback(() => {
    setSelectedSong(null);
    setEditorOpen(true);
  }, []);

  const handleEditSong = useCallback((song: Song) => {
    setSelectedSong(song);
    setEditorOpen(true);
  }, []);

  const handleDeleteClick = useCallback((song: Song) => {
    setSongToDelete(song);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = async () => {
    if (!songToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteSong(songToDelete.id);
      if (result.success) {
        toast.success('Song deleted');
        setDeleteDialogOpen(false);
        setSongToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to delete song');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditorSuccess = () => {
    router.refresh();
  };

  return (
    <>
      {/* Floating New Song Button */}
      <div className="mb-6 flex justify-end">
        <Button onClick={handleNewSong} size="default">
          <Plus className="mr-2 h-4 w-4" />
          New Song
        </Button>
      </div>

      {/* Data Table */}
      <SongDataTable
        songs={initialSongs}
        onEdit={handleEditSong}
        onDelete={handleDeleteClick}
        onRowClick={handleEditSong}
      />

      {/* Song Editor Modal */}
      <SongEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        song={selectedSong}
        onSuccess={handleEditorSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Song</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{songToDelete?.title}&rdquo;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
