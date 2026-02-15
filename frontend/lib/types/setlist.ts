/**
 * Setlist Type Definitions
 *
 * Defines polymorphic setlist items that can be Songs, Bible references, Media, or Announcements
 */

export type SetlistItemType = 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT';

export interface AnnouncementSlideInput {
  url: string;
  type: 'image' | 'video';
  title?: string;
}

export interface BaseSetlistItem {
  id: string;
  eventId: string;
  sequenceOrder: number;
  itemType: SetlistItemType;
}

export interface SongSetlistItem extends BaseSetlistItem {
  itemType: 'SONG';
  songId: string;
  title: string;
  artist: string | null;
}

export interface BibleSetlistItem extends BaseSetlistItem {
  itemType: 'BIBLE';
  bibleRef: string; // "John 3:16-18"
}

export interface MediaSetlistItem extends BaseSetlistItem {
  itemType: 'MEDIA';
  mediaUrl: string;
  mediaTitle: string;
}

export interface AnnouncementSetlistItem extends BaseSetlistItem {
  itemType: 'ANNOUNCEMENT';
  announcementSlides: AnnouncementSlideInput[];
}

export type SetlistItem = SongSetlistItem | BibleSetlistItem | MediaSetlistItem | AnnouncementSetlistItem;

/**
 * Type guard functions
 */
export function isSongItem(item: SetlistItem): item is SongSetlistItem {
  return item.itemType === 'SONG';
}

export function isBibleItem(item: SetlistItem): item is BibleSetlistItem {
  return item.itemType === 'BIBLE';
}

export function isMediaItem(item: SetlistItem): item is MediaSetlistItem {
  return item.itemType === 'MEDIA';
}

export function isAnnouncementItem(item: SetlistItem): item is AnnouncementSetlistItem {
  return item.itemType === 'ANNOUNCEMENT';
}
