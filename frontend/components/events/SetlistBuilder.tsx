'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SetlistView } from './SetlistView';
import { SetlistLibrary } from './SetlistLibrary';
import {
  addSongToEvent,
  addBibleToEvent,
  addMediaToEvent,
  addAnnouncementToEvent,
  removeSetlistItem,
  reorderEventItems,
} from '@/app/events/actions';
import type { SetlistItem } from '@/lib/types/setlist';
import type { AnnouncementSlideInput } from '@/lib/types/setlist';
import { isSongItem } from '@/lib/types/setlist';

interface SetlistBuilderProps {
  eventId: string;
  initialSetlist: SetlistItem[];
}

/**
 * Two-column Setlist Builder (Setlist | Library).
 * For the event edit page, EventEditWorkspace is used instead (Spotify-style sidebar + full-width views).
 * This component is kept for reuse elsewhere if needed. Songs are loaded via server-side search in SetlistLibrary.
 */
export function SetlistBuilder({ eventId, initialSetlist }: SetlistBuilderProps) {
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>(initialSetlist);
  const [, startTransition] = useTransition();

  const handleReorder = (orderedIds: string[]) => {
    const orderMap = new Map(orderedIds.map((id, i) => [id, i + 1]));
    const reordered = [...setlistItems].sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
    );
    const resequenced = reordered.map((item, index) => ({ ...item, sequenceOrder: index + 1 }));

    setSetlistItems(resequenced);
    startTransition(async () => {
      const result = await reorderEventItems(eventId, orderedIds);
      if (!result.success) {
        toast.error(result.error || 'Failed to save order');
        setSetlistItems(setlistItems);
      } else {
        toast.success('Setlist order saved');
      }
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
      const resequenced = remaining.map((entry, index) => ({ ...entry, sequenceOrder: index + 1 }));
      setSetlistItems(resequenced);
      await reorderEventItems(eventId, resequenced.map((i) => i.id));
      toast.success('Item removed');
    });
  };

  const handleAddSong = (songId: string, song: { title: string; artist: string | null }) => {
    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addSongToEvent(eventId, songId, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add song');
        return;
      }
      setSetlistItems((prev) => [
        ...prev,
        {
          id: result.id as string,
          eventId,
          itemType: 'SONG' as const,
          songId,
          title: song.title,
          artist: song.artist,
          sequenceOrder: nextOrder,
        },
      ]);
      toast.success('Song added to setlist');
    });
  };

  const handleAddBible = (bibleRef: string) => {
    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addBibleToEvent(eventId, bibleRef, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add Bible segment');
        return;
      }
      setSetlistItems((prev) => [
        ...prev,
        { id: result.id as string, eventId, itemType: 'BIBLE' as const, bibleRef, sequenceOrder: nextOrder },
      ]);
      toast.success('Bible segment added to setlist');
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
      setSetlistItems((prev) => [
        ...prev,
        { id: result.id as string, eventId, itemType: 'MEDIA' as const, mediaUrl, mediaTitle, sequenceOrder: nextOrder },
      ]);
      toast.success('Media added to setlist');
    });
  };

  const handleAddAnnouncement = (slides: AnnouncementSlideInput[]) => {
    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addAnnouncementToEvent(eventId, slides, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add announcement');
        return;
      }
      setSetlistItems((prev) => [
        ...prev,
        { id: result.id as string, eventId, itemType: 'ANNOUNCEMENT' as const, announcementSlides: slides, sequenceOrder: nextOrder },
      ]);
      toast.success('Announcement added to setlist');
    });
  };

  return (
    <div className="glass-card rounded-2xl p-6 shadow-xl shadow-slate-900/40">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Setlist Builder</h2>
        <p className="text-sm text-slate-300">
          Drag items to reorder. Add songs, Bible, or media from the library.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px] max-h-[70vh]">
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Setlist</h3>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <SetlistView
              eventId={eventId}
              setlistItems={setlistItems}
              onRemove={handleRemove}
              onReorder={handleReorder}
              showHeader={false}
            />
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Library</h3>
          <div className="flex-1 min-h-0 rounded-lg border border-white/10 bg-slate-900/40 p-4 overflow-y-auto">
            <SetlistLibrary
              setlistItems={setlistItems.map((item) => ({
                songId: isSongItem(item) ? item.songId : undefined,
                bibleRef: item.itemType === 'BIBLE' ? item.bibleRef : undefined,
                mediaUrl: item.itemType === 'MEDIA' ? item.mediaUrl : undefined,
              }))}
              onAddSong={handleAddSong}
              onAddBible={handleAddBible}
              onAddMedia={handleAddMedia}
              onAddAnnouncement={handleAddAnnouncement}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
