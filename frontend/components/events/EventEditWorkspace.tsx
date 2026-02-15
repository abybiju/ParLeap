'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EventEditSidebar } from './EventEditSidebar';
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
import type {
  SetlistItem,
  SongSetlistItem,
  BibleSetlistItem,
  MediaSetlistItem,
  AnnouncementSetlistItem,
} from '@/lib/types/setlist';
import type { AnnouncementSlideInput } from '@/lib/types/setlist';
import { isSongItem } from '@/lib/types/setlist';

interface SongOption {
  id: string;
  title: string;
  artist: string | null;
}

interface EventEditWorkspaceProps {
  event: {
    id: string;
    name: string;
    event_date: string | null;
    status: 'draft' | 'live' | 'ended';
  };
  initialSetlist: SetlistItem[];
  songs: SongOption[];
}

type WorkspaceView = 'setlist' | 'library';

export function EventEditWorkspace({ event, initialSetlist, songs }: EventEditWorkspaceProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>('setlist');
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>(initialSetlist);
  const [, startTransition] = useTransition();
  const eventId = event.id;

  const handleReorder = (orderedIds: string[]) => {
    const orderMap = new Map(orderedIds.map((id, i) => [id, i + 1]));
    const reordered = [...setlistItems].sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
    );
    const resequenced = reordered.map((item, index) => ({
      ...item,
      sequenceOrder: index + 1,
    }));

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
      const resequenced = remaining.map((entry, index) => ({
        ...entry,
        sequenceOrder: index + 1,
      }));
      setSetlistItems(resequenced);

      const reorderResult = await reorderEventItems(
        eventId,
        resequenced.map((i) => i.id)
      );
      if (!reorderResult.success) {
        toast.error('Item removed but order update failed');
      }
      toast.success('Item removed');
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
        toast.error(result.error || 'Failed to add Bible segment');
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

  const handleAddAnnouncement = (slides: AnnouncementSlideInput[]) => {
    const nextOrder = setlistItems.length + 1;
    startTransition(async () => {
      const result = await addAnnouncementToEvent(eventId, slides, nextOrder);
      if (!result.success) {
        toast.error(result.error || 'Failed to add announcement');
        return;
      }

      const newItem: AnnouncementSetlistItem = {
        id: result.id as string,
        eventId,
        itemType: 'ANNOUNCEMENT',
        announcementSlides: slides,
        sequenceOrder: nextOrder,
      };
      setSetlistItems((prev) => [...prev, newItem]);
      toast.success('Announcement added to setlist');
    });
  };

  return (
    <div className="flex w-full min-h-[calc(100vh-8rem)] gap-6">
      <EventEditSidebar
        event={event}
        setlistItemCount={setlistItems.length}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {activeView === 'setlist' && (
          <SetlistView
            eventId={eventId}
            setlistItems={setlistItems}
            onRemove={handleRemove}
            onReorder={handleReorder}
          />
        )}
        {activeView === 'library' && (
          <div className="glass-card rounded-2xl p-6 shadow-xl shadow-slate-900/40">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Content Library</h2>
              <p className="text-sm text-slate-300">
                Add songs, Bible segments, media, or announcements to the setlist.
              </p>
            </div>
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
              onAddAnnouncement={handleAddAnnouncement}
            />
          </div>
        )}
      </main>
    </div>
  );
}
