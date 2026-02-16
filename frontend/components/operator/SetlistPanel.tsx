'use client';

import { useEffect, useState } from 'react';
import { Play, Music, BookOpen, Image as ImageIcon, Megaphone } from 'lucide-react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useSlideCache } from '@/lib/stores/slideCache';
import { isDisplayUpdateMessage, isSessionStartedMessage, type DisplayUpdateMessage } from '@/lib/websocket/types';
import { cn } from '@/lib/utils';

/** Polymorphic setlist item for pre-session display */
type InitialSetlistItem =
  | { kind: 'SONG'; id: string; songId: string; title: string; artist: string | null; sequenceOrder: number }
  | { kind: 'BIBLE'; id: string; bibleRef: string; sequenceOrder: number }
  | { kind: 'MEDIA'; id: string; mediaTitle: string; mediaUrl: string; sequenceOrder: number }
  | { kind: 'ANNOUNCEMENT'; id: string; slideCount: number; sequenceOrder: number };

interface SetlistPanelProps {
  initialSetlist?: InitialSetlistItem[];
  /** Called when the operator clicks a setlist item. Provides index and item kind for Smart Listen gate. */
  onItemActivated?: (index: number, kind: 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT') => void;
}

/** Display item for the setlist (unified from setlistItems + songs or legacy songs-only) */
type DisplayItem =
  | { kind: 'SONG'; id: string; title: string; artist: string | null; sequenceOrder: number; songId: string }
  | { kind: 'BIBLE'; id: string; bibleRef: string; sequenceOrder: number }
  | { kind: 'MEDIA'; id: string; mediaTitle: string; mediaUrl: string; sequenceOrder: number }
  | { kind: 'ANNOUNCEMENT'; id: string; slideCount: number; sequenceOrder: number };

/**
 * Setlist Panel Component
 *
 * Displays the full setlist (songs, Bible, media) with current item/slide highlighted.
 * Uses setlistItems when available (polymorphic), otherwise falls back to songs-only.
 */
export function SetlistPanel({ initialSetlist = [], onItemActivated }: SetlistPanelProps) {
  const { lastMessage, goToItem } = useWebSocket(false);
  const slideCache = useSlideCache();
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [hasSessionStarted, setHasSessionStarted] = useState(false);
  /** When true, main display is showing a Bible verse (reference-driven); do not highlight a song as Current. */
  const [displayIsBible, setDisplayIsBible] = useState(false);

  const handleItemClick = (index: number, item: DisplayItem) => {
    goToItem(index);
    onItemActivated?.(index, item.kind);
    const label = item.kind === 'SONG' ? item.title : item.kind === 'BIBLE' ? item.bibleRef : item.kind === 'MEDIA' ? item.mediaTitle : 'Announcement';
    console.log(`[SetlistPanel] Manual override: Jumping to item ${index} (${item.kind}) "${label}"`);
  };

  useEffect(() => {
    if (!lastMessage) return;

    if (isSessionStartedMessage(lastMessage)) {
      const payloadSetlistItems = lastMessage.payload.setlistItems;
      const cachedSetlistItems = slideCache.setlist?.setlistItems;
      console.log(`[SetlistPanel] SESSION_STARTED: ${lastMessage.payload.totalSongs} songs, cached setlist songs:`, slideCache.setlist?.songs.length ?? 0);
      console.log('[SetlistPanel] payload.setlistItems:', payloadSetlistItems?.length ?? 0, payloadSetlistItems ?? 'undefined');
      console.log('[SetlistPanel] slideCache.setlist.setlistItems:', cachedSetlistItems?.length ?? 0, cachedSetlistItems ?? 'undefined');
      if (!payloadSetlistItems || payloadSetlistItems.length === 0) {
        console.log('[SetlistPanel] setlistItems is undefined or empty in SESSION_STARTED payload');
      }
      setHasSessionStarted(true);
      setCurrentSlideIndex(lastMessage.payload.currentSlideIndex);
      setCurrentItemIndex(lastMessage.payload.currentItemIndex ?? lastMessage.payload.currentSongIndex ?? 0);
      if (slideCache.setlist && slideCache.setlist.songs.length > 0) {
        setCurrentSongId(slideCache.setlist.songs[lastMessage.payload.currentSongIndex]?.id ?? null);
      }
    }

    if (isDisplayUpdateMessage(lastMessage)) {
      const displayMsg = lastMessage as DisplayUpdateMessage;
      const songId = displayMsg.payload.songId;
      setDisplayIsBible(songId?.startsWith('bible:') ?? false);
      setCurrentSongId(songId);
      setCurrentSlideIndex(displayMsg.payload.slideIndex);
      // Prefer currentItemIndex from payload when set; else infer from songId
      const payloadItemIndex = displayMsg.payload.currentItemIndex;
      if (payloadItemIndex !== undefined && payloadItemIndex >= 0) {
        setCurrentItemIndex(payloadItemIndex);
      } else if (slideCache.setlist?.setlistItems && slideCache.setlist.setlistItems.length > 0) {
        const idx = slideCache.setlist.setlistItems.findIndex(
          (item) =>
            (item.type === 'SONG' && item.songId === songId) ||
            (songId.startsWith('bible:') && item.type === 'BIBLE') ||
            (songId.startsWith('media:') && item.type === 'MEDIA') ||
            (songId.startsWith('announcement:') && item.type === 'ANNOUNCEMENT')
        );
        if (idx >= 0) setCurrentItemIndex(idx);
      } else if (slideCache.setlist?.songs) {
        const idx = slideCache.setlist.songs.findIndex((s) => s.id === songId);
        if (idx >= 0) setCurrentItemIndex(idx);
      }
    }
  }, [lastMessage, slideCache.setlist]);

  // Convert an InitialSetlistItem to a DisplayItem
  const toDisplayItem = (item: InitialSetlistItem): DisplayItem => {
    if (item.kind === 'SONG') {
      return { kind: 'SONG' as const, id: item.id, songId: item.songId, title: item.title, artist: item.artist, sequenceOrder: item.sequenceOrder };
    }
    if (item.kind === 'BIBLE') {
      return { kind: 'BIBLE' as const, id: item.id, bibleRef: item.bibleRef, sequenceOrder: item.sequenceOrder };
    }
    if (item.kind === 'MEDIA') {
      return { kind: 'MEDIA' as const, id: item.id, mediaTitle: item.mediaTitle, mediaUrl: item.mediaUrl, sequenceOrder: item.sequenceOrder };
    }
    return { kind: 'ANNOUNCEMENT' as const, id: item.id, slideCount: item.slideCount, sequenceOrder: item.sequenceOrder };
  };

  // Build display list: merge cached setlistItems with initialSetlist to ensure Bible/Media always appear
  const displayItems: DisplayItem[] = (() => {
    if (hasSessionStarted && slideCache.setlist) {
      const items = slideCache.setlist.setlistItems;
      const songs = slideCache.setlist.songs;
      if (items && items.length > 0) {
        // Build from cached items
        const result: DisplayItem[] = [];
        const cachedIds = new Set<string>();
        for (const item of items) {
          cachedIds.add(item.id);
          if (item.type === 'SONG' && item.songId) {
            const song = songs.find((s) => s.id === item.songId);
            result.push({
              kind: 'SONG',
              id: item.id,
              songId: item.songId,
              title: song?.title ?? 'Unknown',
              artist: song?.artist ?? null,
              sequenceOrder: item.sequenceOrder,
            });
          } else if (item.type === 'BIBLE' && item.bibleRef) {
            result.push({ kind: 'BIBLE', id: item.id, bibleRef: item.bibleRef, sequenceOrder: item.sequenceOrder });
          } else if (item.type === 'MEDIA' && item.mediaUrl) {
            result.push({
              kind: 'MEDIA',
              id: item.id,
              mediaTitle: item.mediaTitle ?? 'Media',
              mediaUrl: item.mediaUrl,
              sequenceOrder: item.sequenceOrder,
            });
          } else if (item.type === 'ANNOUNCEMENT' && item.announcementSlides && item.announcementSlides.length > 0) {
            result.push({
              kind: 'ANNOUNCEMENT',
              id: item.id,
              slideCount: item.announcementSlides.length,
              sequenceOrder: item.sequenceOrder,
            });
          }
        }
        // Merge any items from initialSetlist that we didn't get a valid display item for
        // (backend may send wrong types or omit Bible/Media/Announcement when using fallback query)
        const resultIds = new Set(result.map((r) => r.id));
        const missingItems: DisplayItem[] = [];
        for (const init of initialSetlist) {
          if (!resultIds.has(init.id)) {
            missingItems.push(toDisplayItem(init));
            resultIds.add(init.id);
          }
        }
        if (missingItems.length > 0) {
          console.log(`[SetlistPanel] Merging ${missingItems.length} missing items from initialSetlist (Bible/Media/Announcement or backend type mismatch)`);
          result.push(...missingItems);
          result.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        }
        return result;
      }
      // Backend may not send setlistItems (e.g. DB mismatch). Fall back to initialSetlist from live page.
      if (initialSetlist.length > 0) {
        return initialSetlist.map(toDisplayItem);
      }
      return songs.map((song, idx) => ({
        kind: 'SONG' as const,
        id: song.id,
        songId: song.id,
        title: song.title,
        artist: song.artist ?? null,
        sequenceOrder: idx + 1,
      }));
    }
    // Pre-session: use polymorphic initialSetlist
    return initialSetlist.map(toDisplayItem);
  })();

  const isUsingCachedSetlist = hasSessionStarted && slideCache.setlist && (slideCache.setlist.songs.length > 0 || (slideCache.setlist.setlistItems?.length ?? 0) > 0);

  if (displayItems.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Setlist</h3>
        <p className="text-sm text-slate-500">No items in setlist</p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-slate-600 mt-2">
            Debug: hasSessionStarted={hasSessionStarted ? 'yes' : 'no'}, cached={slideCache.setlist ? 'exists' : 'null'}, initial={initialSetlist.length}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4 px-4 pt-4">
        Setlist ({displayItems.length} items)
      </h3>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {displayItems.map((item, index) => {
          const isCurrent =
            displayIsBible && item.kind === 'SONG'
              ? false
              : isUsingCachedSetlist
                ? index === currentItemIndex
                : item.kind === 'SONG' && item.songId === currentSongId;
          const isSong = item.kind === 'SONG';
          const cachedSong = isSong && isUsingCachedSetlist && slideCache.setlist
            ? slideCache.setlist.songs.find((s) => s.id === item.songId)
            : null;
          const songLines = cachedSong?.lines ?? [];
          const songSlides = cachedSong?.slides;

          const borderColor = isCurrent
            ? 'border-indigo-500/50 bg-indigo-500/10'
            : item.kind === 'SONG'
              ? 'border-white/10 bg-white/5'
              : item.kind === 'BIBLE'
                ? 'border-purple-400/30 bg-purple-500/5'
                : item.kind === 'MEDIA'
                  ? 'border-green-400/30 bg-green-500/5'
                  : 'border-amber-400/30 bg-amber-500/5';

          const content = (
            <>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 flex items-start gap-2">
                  {isSong && !isCurrent && hasSessionStarted && (
                    <Play className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-shrink-0 text-slate-400 mt-0.5">
                    {item.kind === 'SONG' && <Music className="h-4 w-4" />}
                    {item.kind === 'BIBLE' && <BookOpen className="h-4 w-4" />}
                    {item.kind === 'MEDIA' && <ImageIcon className="h-4 w-4" aria-label="Media" />}
                    {item.kind === 'ANNOUNCEMENT' && <Megaphone className="h-4 w-4" aria-label="Announcement" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.kind === 'SONG' && (
                      <>
                        <p className={cn('text-sm font-medium', isCurrent ? 'text-indigo-300' : 'text-slate-300')}>
                          {item.sequenceOrder}. {item.title}
                        </p>
                        {item.artist && <p className="text-xs text-slate-500 mt-0.5">{item.artist}</p>}
                      </>
                    )}
                    {item.kind === 'BIBLE' && (
                      <>
                        <p className={cn('text-sm font-medium', isCurrent ? 'text-indigo-300' : 'text-slate-300')}>
                          {item.sequenceOrder}. {item.bibleRef}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Scripture</p>
                      </>
                    )}
                    {item.kind === 'MEDIA' && (
                      <>
                        <p className={cn('text-sm font-medium', isCurrent ? 'text-indigo-300' : 'text-slate-300')}>
                          {item.sequenceOrder}. {item.mediaTitle}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{item.mediaUrl}</p>
                      </>
                    )}
                    {item.kind === 'ANNOUNCEMENT' && (
                      <>
                        <p className={cn('text-sm font-medium', isCurrent ? 'text-indigo-300' : 'text-slate-300')}>
                          {item.sequenceOrder}. Announcement
                        </p>
                        <p className="text-xs text-slate-500">{item.slideCount} slide{item.slideCount !== 1 ? 's' : ''}</p>
                      </>
                    )}
                  </div>
                </div>
                {isCurrent && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium">
                    Current
                  </span>
                )}
              </div>

              {isSong && isCurrent && hasSessionStarted && songLines.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap gap-1">
                    {songSlides
                      ? songSlides.map((_, slideIndex) => (
                          <div
                            key={slideIndex}
                            className={cn(
                              'w-2 h-2 rounded-full transition-all',
                              slideIndex === currentSlideIndex ? 'bg-indigo-400' : slideIndex < currentSlideIndex ? 'bg-indigo-500/30' : 'bg-slate-600/30'
                            )}
                            title={`Slide ${slideIndex + 1}`}
                          />
                        ))
                      : songLines.map((_, lineIndex) => (
                          <div
                            key={lineIndex}
                            className={cn(
                              'w-2 h-2 rounded-full transition-all',
                              lineIndex === currentSlideIndex ? 'bg-indigo-400' : lineIndex < currentSlideIndex ? 'bg-indigo-500/30' : 'bg-slate-600/30'
                            )}
                            title={`Line ${lineIndex + 1}`}
                          />
                        ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {songSlides ? `Slide ${currentSlideIndex + 1} of ${songSlides.length}` : `Line ${currentSlideIndex + 1} of ${songLines.length}`}
                  </p>
                </div>
              )}
            </>
          );

          if (hasSessionStarted) {
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(index, item)}
                disabled={isCurrent}
                className={cn(
                  'w-full rounded-lg border p-3 transition-all text-left',
                  'hover:border-indigo-400/50 hover:bg-indigo-500/5',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                  'disabled:cursor-default disabled:hover:border-indigo-500/50 disabled:hover:bg-indigo-500/10',
                  borderColor,
                  'opacity-90'
                )}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={item.id}
              className={cn('w-full rounded-lg border p-3 transition-all text-left cursor-default opacity-75', borderColor)}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
