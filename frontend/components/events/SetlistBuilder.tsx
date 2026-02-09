'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SetlistItemCard } from './SetlistItemCard';
import { SetlistLibrary } from './SetlistLibrary';
import {
  addSongToEvent,
  addBibleToEvent,
  addMediaToEvent,
  removeSetlistItem,
  reorderEventItems,
} from '@/app/events/actions';
import type { SetlistItem, SongSetlistItem, BibleSetlistItem, MediaSetlistItem } from '@/lib/types/setlist';
import { isSongItem } from '@/lib/types/setlist';

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

function SortableSetlistItem({
  item,
  onRemove,
}: {
  item: SetlistItem;
  onRemove: (item: SetlistItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SetlistItemCard
        item={item}
        onRemove={onRemove}
        isDragging={isDragging}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
}

export function SetlistBuilder({ eventId, initialSetlist, songs }: SetlistBuilderProps) {
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>(initialSetlist);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = setlistItems.findIndex((item) => item.id === active.id);
    const newIndex = setlistItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(setlistItems, oldIndex, newIndex);
    const resequenced = reordered.map((item, index) => ({
      ...item,
      sequenceOrder: index + 1,
    }));

    setSetlistItems(resequenced);

    // Persist order to database
    startTransition(async () => {
      const result = await reorderEventItems(
        eventId,
        resequenced.map((item) => item.id)
      );
      if (!result.success) {
        toast.error(result.error || 'Failed to save order');
        // Revert on error
        setSetlistItems(setlistItems);
      } else {
        toast.success('Setlist order saved');
      }
    });
  };

  const handleAddSong = (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addSongToEvent(eventId, songId, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add song');
        return;
      }

      const newItem: SongSetlistItem = {
        id: result.id as string,
        eventId,
        itemType: 'SONG',
        songId: song.id,
        title: song.title,
        artist: song.artist,
        sequenceOrder: nextOrder,
      };

      setSetlistItems((prev) => [...prev, newItem]);
      toast.success('Song added to setlist');
    });
  };

  const handleAddBible = (bibleRef: string) => {
    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addBibleToEvent(eventId, bibleRef, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add Bible reference');
        return;
      }

      const newItem: BibleSetlistItem = {
        id: result.id as string,
        eventId,
        itemType: 'BIBLE',
        bibleRef,
        sequenceOrder: nextOrder,
      };

      setSetlistItems((prev) => [...prev, newItem]);
      toast.success('Bible reference added to setlist');
    });
  };

  const handleAddMedia = (mediaUrl: string, mediaTitle: string) => {
    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addMediaToEvent(eventId, mediaUrl, mediaTitle, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add media');
        return;
      }

      const newItem: MediaSetlistItem = {
        id: result.id as string,
        eventId,
        itemType: 'MEDIA',
        mediaUrl,
        mediaTitle,
        sequenceOrder: nextOrder,
      };

      setSetlistItems((prev) => [...prev, newItem]);
      toast.success('Media added to setlist');
    });
  };

  const handleRemove = (item: SetlistItem) => {
    startTransition(async () => {
      const result = await removeSetlistItem(eventId, item.id);
      if (!result.success) {
        toast.error(result.error || 'Failed to remove item');
        return;
      }

      const remaining = setlistItems.filter((entry) => entry.id !== item.id);
      const resequenced = remaining.map((entry, index) => ({
        ...entry,
        sequenceOrder: index + 1,
      }));

      setSetlistItems(resequenced);

      // Update order in database
      const reorderResult = await reorderEventItems(
        eventId,
        resequenced.map((item) => item.id)
      );
      if (!reorderResult.success) {
        toast.error('Item removed but order update failed');
      }

      toast.success('Item removed');
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/40 backdrop-blur">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Setlist Builder</h2>
        <p className="text-sm text-slate-300">
          Drag items to reorder. Add songs, Bible references, or media from the library.
        </p>
      </div>

      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
        {/* Left: Setlist */}
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Setlist</h3>
          <div className="flex-1 rounded-lg border border-white/10 bg-slate-900/40 p-4 overflow-y-auto">
            {setlistItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-slate-400 py-8">
                <div>
                  <p className="text-sm">No items in setlist yet.</p>
                  <p className="text-xs mt-1">Drag items from the library to add them.</p>
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={setlistItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {setlistItems.map((item) => (
                      <SortableSetlistItem
                        key={item.id}
                        item={item}
                        onRemove={handleRemove}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Right: Library */}
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Library</h3>
          <div className="flex-1 rounded-lg border border-white/10 bg-slate-900/40 p-4">
            <SetlistLibrary
              songs={songs}
              setlistItems={setlistItems.map((item) => ({
                songId: isSongItem(item) ? item.songId : undefined,
                bibleRef: item.itemType === 'BIBLE' ? item.bibleRef : undefined,
                mediaUrl: item.itemType === 'MEDIA' ? item.mediaUrl : undefined,
              }))}
              onAddSong={handleAddSong}
              onAddBible={handleAddBible}
              onAddMedia={handleAddMedia}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
