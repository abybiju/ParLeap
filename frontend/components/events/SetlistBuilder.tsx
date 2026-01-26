'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { addSongToEvent, removeSongFromEvent, reorderEventItems } from '@/app/events/actions';
import { cn } from '@/lib/utils';

interface SetlistItem {
  id: string;
  songId: string;
  title: string;
  artist: string | null;
  sequenceOrder: number;
}

interface SongOption {
  id: string;
  title: string;
  artist: string | null;
}

interface SetlistBuilderProps {
  eventId: string;
  initialSetlist: SetlistItem[];
  songs: SongOption[];
}

export function SetlistBuilder({ eventId, initialSetlist, songs }: SetlistBuilderProps) {
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>(initialSetlist);
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const dragId = useRef<string | null>(null);

  const availableSongs = useMemo(() => {
    const inSetlist = new Set(setlistItems.map((item) => item.songId));
    return songs.filter((song) => !inSetlist.has(song.id));
  }, [setlistItems, songs]);

  const persistOrder = (orderedItems: SetlistItem[]) => {
    startTransition(async () => {
      const result = await reorderEventItems(eventId, orderedItems.map((item) => item.id));
      if (!result.success) {
        toast.error(result.error || 'Failed to save order');
      } else {
        toast.success('Setlist order saved');
      }
    });
  };

  const handleAddSong = () => {
    if (!selectedSongId) return;
    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addSongToEvent(eventId, selectedSongId, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add song');
        return;
      }
      toast.success('Song added to setlist');
      const song = songs.find((item) => item.id === selectedSongId);
      if (song && result.id) {
        setSetlistItems((prev) => [
          ...prev,
          {
            id: result.id as string,
            songId: song.id,
            title: song.title,
            artist: song.artist,
            sequenceOrder: nextOrder,
          },
        ]);
      } else {
        toast.message('Setlist updated', { description: 'Refresh to see the latest changes.' });
      }
      setSelectedSongId('');
    });
  };

  const handleRemove = (item: SetlistItem) => {
    startTransition(async () => {
      const result = await removeSongFromEvent(eventId, item.id);
      if (!result.success) {
        toast.error(result.error || 'Failed to remove song');
        return;
      }
      toast.success('Song removed');
      const remaining = setlistItems.filter((entry) => entry.id !== item.id);
      const resequenced = remaining.map((entry, index) => ({
        ...entry,
        sequenceOrder: index + 1,
      }));
      setSetlistItems(resequenced);
      persistOrder(resequenced);
    });
  };

  const handleDragStart = (itemId: string) => {
    dragId.current = itemId;
  };

  const handleDrop = (targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;

    const current = [...setlistItems];
    const sourceIndex = current.findIndex((item) => item.id === sourceId);
    const targetIndex = current.findIndex((item) => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [moved] = current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, moved);
    const resequenced = current.map((item, index) => ({
      ...item,
      sequenceOrder: index + 1,
    }));
    setSetlistItems(resequenced);
    persistOrder(resequenced);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/40 backdrop-blur">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Setlist Builder</h2>
        <p className="text-sm text-slate-300">Drag songs to reorder the live setlist.</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-sm text-slate-300">Add Song</label>
          <select
            value={selectedSongId}
            onChange={(event) => setSelectedSongId(event.target.value)}
            className="mt-2 w-full rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          >
            <option value="">Select a song</option>
            {availableSongs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}{song.artist ? ` — ${song.artist}` : ''}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={handleAddSong} disabled={!selectedSongId || isPending}>
          <Plus className="mr-2 h-4 w-4" />
          Add to Setlist
        </Button>
      </div>

      {setlistItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-slate-400">
          No songs in the setlist yet.
        </div>
      ) : (
        <div className="space-y-2">
          {setlistItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(item.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(item.id)}
              className={cn(
                'flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 transition',
                'hover:border-indigo-300/50'
              )}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {item.sequenceOrder}. {item.title}
                  </p>
                  {item.artist && <p className="text-xs text-slate-400">{item.artist}</p>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-red-300"
                onClick={() => handleRemove(item)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
