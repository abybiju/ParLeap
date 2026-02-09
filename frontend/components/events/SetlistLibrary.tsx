'use client';

import { useState } from 'react';
import { Music, BookOpen, Image as ImageIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SongSetlistItem, BibleSetlistItem, MediaSetlistItem } from '@/lib/types/setlist';

type TabType = 'songs' | 'bible' | 'media';

interface SongOption {
  id: string;
  title: string;
  artist: string | null;
}

interface SetlistLibraryProps {
  songs: SongOption[];
  setlistItems: Array<{ songId?: string; bibleRef?: string; mediaUrl?: string }>;
  onAddSong: (songId: string) => void;
  onAddBible: (bibleRef: string) => void;
  onAddMedia: (mediaUrl: string, mediaTitle: string) => void;
}

export function SetlistLibrary({
  songs,
  setlistItems,
  onAddSong,
  onAddBible,
  onAddMedia,
}: SetlistLibraryProps) {
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [bibleRef, setBibleRef] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');

  // Filter out songs already in setlist
  const availableSongs = songs.filter(
    (song) => !setlistItems.some((item) => item.songId === song.id)
  );

  const handleAddBible = () => {
    if (bibleRef.trim()) {
      onAddBible(bibleRef.trim());
      setBibleRef('');
    }
  };

  const handleAddMedia = () => {
    if (mediaUrl.trim() && mediaTitle.trim()) {
      onAddMedia(mediaUrl.trim(), mediaTitle.trim());
      setMediaUrl('');
      setMediaTitle('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 mb-4">
        <button
          onClick={() => setActiveTab('songs')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2',
            activeTab === 'songs'
              ? 'border-blue-400 text-blue-300'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          )}
        >
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Songs
          </div>
        </button>
        <button
          onClick={() => setActiveTab('bible')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2',
            activeTab === 'bible'
              ? 'border-purple-400 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          )}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Bible
          </div>
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2',
            activeTab === 'media'
              ? 'border-green-400 text-green-300'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          )}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" aria-label="Media" />
            Media
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'songs' && (
          <div className="space-y-2">
            {availableSongs.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-sm">
                All songs are already in the setlist
              </div>
            ) : (
              availableSongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 hover:border-blue-300/50 transition cursor-pointer"
                  onClick={() => onAddSong(song.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{song.title}</p>
                    {song.artist && <p className="text-xs text-slate-400">{song.artist}</p>}
                  </div>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bible' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Bible Reference</label>
              <Input
                type="text"
                placeholder="e.g., John 3:16-18"
                value={bibleRef}
                onChange={(e) => setBibleRef(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddBible();
                  }
                }}
                className="bg-slate-900/60 border-white/10 text-white"
              />
              <p className="text-xs text-slate-400 mt-1">
                Enter a Bible reference (book, chapter, verse)
              </p>
            </div>
            <Button
              onClick={handleAddBible}
              disabled={!bibleRef.trim()}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Bible Reference
            </Button>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Media Title</label>
              <Input
                type="text"
                placeholder="e.g., Welcome Video"
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                className="bg-slate-900/60 border-white/10 text-white mb-3"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Media URL</label>
              <Input
                type="url"
                placeholder="https://example.com/video.mp4"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddMedia();
                  }
                }}
                className="bg-slate-900/60 border-white/10 text-white"
              />
              <p className="text-xs text-slate-400 mt-1">
                Enter a URL to an image or video
              </p>
            </div>
            <Button
              onClick={handleAddMedia}
              disabled={!mediaUrl.trim() || !mediaTitle.trim()}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Media
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
