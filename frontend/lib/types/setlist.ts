/**
 * Setlist Type Definitions
 * 
 * Defines polymorphic setlist items that can be Songs, Bible references, or Media items
 */

export type SetlistItemType = 'SONG' | 'BIBLE' | 'MEDIA';

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

export type SetlistItem = SongSetlistItem | BibleSetlistItem | MediaSetlistItem;

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
