'use client';

import { GripVertical, Music, BookOpen, Image as ImageIcon, Megaphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SetlistItem } from '@/lib/types/setlist';
import { isSongItem, isBibleItem, isMediaItem, isAnnouncementItem } from '@/lib/types/setlist';

interface SetlistItemCardProps {
  item: SetlistItem;
  onRemove?: (item: SetlistItem) => void;
  isDragging?: boolean;
  className?: string;
  dragListeners?: {
    onPointerDown?: (event: React.PointerEvent) => void;
  };
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
}

export function SetlistItemCard({ item, onRemove, isDragging, className, dragListeners, dragAttributes }: SetlistItemCardProps) {
  const getItemIcon = () => {
    if (isSongItem(item)) return <Music className="h-4 w-4" />;
    if (isBibleItem(item)) return <BookOpen className="h-4 w-4" />;
    if (isMediaItem(item)) return <ImageIcon className="h-4 w-4" aria-label="Media" />;
    if (isAnnouncementItem(item)) return <Megaphone className="h-4 w-4" aria-label="Announcement" />;
    return null;
  };

  const getItemColor = () => {
    if (isSongItem(item)) return 'border-blue-400/50 bg-blue-500/10';
    if (isBibleItem(item)) return 'border-purple-400/50 bg-purple-500/10';
    if (isMediaItem(item)) return 'border-green-400/50 bg-green-500/10';
    if (isAnnouncementItem(item)) return 'border-amber-400/50 bg-amber-500/10';
    return 'border-white/10 bg-slate-900/40';
  };

  const renderContent = () => {
    if (isSongItem(item)) {
      return (
        <>
          <div>
            <p className="text-sm font-medium text-white">
              {item.sequenceOrder}. {item.title}
            </p>
            {item.artist && <p className="text-xs text-slate-400">{item.artist}</p>}
          </div>
        </>
      );
    }

    if (isBibleItem(item)) {
      return (
        <>
          <div>
            <p className="text-sm font-medium text-white">
              {item.sequenceOrder}. {item.bibleRef}
            </p>
            <p className="text-xs text-slate-400">Scripture</p>
          </div>
        </>
      );
    }

    if (isMediaItem(item)) {
      return (
        <>
          <div>
            <p className="text-sm font-medium text-white">
              {item.sequenceOrder}. {item.mediaTitle}
            </p>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{item.mediaUrl}</p>
          </div>
        </>
      );
    }

    if (isAnnouncementItem(item)) {
      const count = item.announcementSlides?.length ?? 0;
      return (
        <>
          <div>
            <p className="text-sm font-medium text-white">
              {item.sequenceOrder}. Announcement
            </p>
            <p className="text-xs text-slate-400">{count} slide{count !== 1 ? 's' : ''}</p>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border px-4 py-3 transition',
        getItemColor(),
        isDragging && 'opacity-50',
        className
      )}
    >
      <div className="flex items-center gap-3" {...dragAttributes} {...dragListeners}>
        <GripVertical className="h-4 w-4 text-slate-500 cursor-grab active:cursor-grabbing" />
        <div className="text-slate-300">{getItemIcon()}</div>
        {renderContent()}
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-red-300"
          onClick={() => onRemove(item)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
