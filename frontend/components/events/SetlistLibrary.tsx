'use client';

import { useState } from 'react';
import { Music, Image as ImageIcon, BookOpen, Plus, Megaphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AnnouncementSlideInput } from '@/lib/types/setlist';

type TabType = 'songs' | 'bible' | 'media' | 'announcement';

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
  onAddAnnouncement: (slides: AnnouncementSlideInput[]) => void;
}

export function SetlistLibrary({
  songs,
  setlistItems,
  onAddSong,
  onAddBible,
  onAddMedia,
  onAddAnnouncement,
}: SetlistLibraryProps) {
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [announcementSlides, setAnnouncementSlides] = useState<Array<{ url: string; type: 'image' | 'video'; title: string }>>([{ url: '', type: 'image', title: '' }]);

  // Filter out songs already in setlist
  const availableSongs = songs.filter(
    (song) => !setlistItems.some((item) => item.songId === song.id)
  );

  const handleAddBible = () => {
    onAddBible('Bible'); // Generic slot – AI listens for any verse, not a pre-set reference
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
            <BookOpen className="h-4 w-4" aria-label="Bible" />
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
        <button
          onClick={() => setActiveTab('announcement')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2',
            activeTab === 'announcement'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          )}
        >
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" aria-label="Announcement" />
            Announcement
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
            <p className="text-sm text-slate-400">
              Add a Bible segment to your setlist. When this item is active, the AI will listen for any spoken verse reference and display it on the projector—no need to pre-specify passages.
            </p>
            <Button
              onClick={handleAddBible}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Bible
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

        {activeTab === 'announcement' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Add an announcement with one or more slides (images or videos). Each slide needs a URL and type.
            </p>
            <div className="space-y-3">
              {announcementSlides.map((slide, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Slide {index + 1}</span>
                    {announcementSlides.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-300 h-8 w-8 p-0"
                        onClick={() => setAnnouncementSlides((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    type="url"
                    placeholder="Image or video URL"
                    value={slide.url}
                    onChange={(e) =>
                      setAnnouncementSlides((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, url: e.target.value } : s))
                      )
                    }
                    className="bg-slate-900/60 border-white/10 text-white text-sm"
                  />
                  <select
                    value={slide.type}
                    onChange={(e) =>
                      setAnnouncementSlides((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, type: e.target.value as 'image' | 'video' } : s))
                      )
                    }
                    className="w-full rounded-md border border-white/10 bg-slate-900/60 text-white text-sm px-3 py-2"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                  <Input
                    type="text"
                    placeholder="Title (optional)"
                    value={slide.title}
                    onChange={(e) =>
                      setAnnouncementSlides((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, title: e.target.value } : s))
                      )
                    }
                    className="bg-slate-900/60 border-white/10 text-white text-sm"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-white/20 text-slate-300"
              onClick={() => setAnnouncementSlides((prev) => [...prev, { url: '', type: 'image', title: '' }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add slide
            </Button>
            <Button
              onClick={() => {
                const valid = announcementSlides.filter((s) => s.url.trim());
                if (valid.length > 0) {
                  onAddAnnouncement(
                    valid.map((s) => ({ url: s.url.trim(), type: s.type, title: s.title.trim() || undefined }))
                  );
                  setAnnouncementSlides([{ url: '', type: 'image', title: '' }]);
                }
              }}
              disabled={!announcementSlides.some((s) => s.url.trim())}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add announcement to setlist
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
