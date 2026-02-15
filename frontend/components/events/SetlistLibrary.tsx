'use client';

import { useState, useCallback } from 'react';
import { Music, Image as ImageIcon, BookOpen, Plus, Megaphone, Trash2, Link2, Upload, Cloud, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AnnouncementSlideInput } from '@/lib/types/setlist';

type TabType = 'songs' | 'bible' | 'media' | 'announcement';
type AnnouncementSourceType = 'url' | 'device' | 'drive' | 'ideogram';

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
  const [announcementSource, setAnnouncementSource] = useState<AnnouncementSourceType>('url');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [driveLink, setDriveLink] = useState('');
  const [ideogramPrompt, setIdeogramPrompt] = useState('');

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

  const handleAnnouncementAddToSetlist = () => {
    const valid = announcementSlides.filter((s) => s.url.trim());
    if (valid.length > 0) {
      onAddAnnouncement(
        valid.map((s) => ({ url: s.url.trim(), type: s.type, title: s.title.trim() || undefined }))
      );
      setAnnouncementSlides([{ url: '', type: 'image', title: '' }]);
    }
  };

  const hasUrlSlides = announcementSlides.some((s) => s.url.trim());
  const canAddAnnouncementToSetlist = hasUrlSlides;

  const addDriveLinkAsSlide = () => {
    if (driveLink.trim()) {
      setAnnouncementSlides((prev) => [...prev, { url: driveLink.trim(), type: 'image', title: '' }]);
      setDriveLink('');
    }
  };

  const handleDeviceDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (files.length) setPendingFiles((prev) => [...prev, ...files]);
  }, []);

  const handleDeviceDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDeviceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const valid = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (valid.length) setPendingFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
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
              Add an announcement with one or more slides. Choose how to add slides below.
            </p>
            {/* Source selector */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 self-center">Add slide from:</span>
              <Button
                type="button"
                variant={announcementSource === 'url' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  announcementSource === 'url' && 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                )}
                onClick={() => setAnnouncementSource('url')}
              >
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                URL
              </Button>
              <Button
                type="button"
                variant={announcementSource === 'device' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  announcementSource === 'device' && 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                )}
                onClick={() => setAnnouncementSource('device')}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Device / Drop
              </Button>
              <Button
                type="button"
                variant={announcementSource === 'drive' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  announcementSource === 'drive' && 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                )}
                onClick={() => setAnnouncementSource('drive')}
              >
                <Cloud className="h-3.5 w-3.5 mr-1.5" />
                Google Drive
              </Button>
              <Button
                type="button"
                variant={announcementSource === 'ideogram' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  announcementSource === 'ideogram' && 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                )}
                onClick={() => setAnnouncementSource('ideogram')}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Ideogram
              </Button>
            </div>

            {/* URL source: multi-slide form */}
            {announcementSource === 'url' && (
              <div className="space-y-3">
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
              </div>
            )}

            {/* Device / Drop: file input + drop zone */}
            {announcementSource === 'device' && (
              <div className="space-y-3">
                <div
                  onDrop={handleDeviceDrop}
                  onDragOver={handleDeviceDragOver}
                  className="rounded-lg border-2 border-dashed border-white/20 bg-slate-900/40 p-6 text-center hover:border-amber-500/40 transition-colors"
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleDeviceFileSelect}
                    className="hidden"
                    id="announcement-file-input"
                  />
                  <label
                    htmlFor="announcement-file-input"
                    className="cursor-pointer block text-slate-400 text-sm"
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                    Drop files here or click to browse
                  </label>
                  <p className="text-xs text-slate-500 mt-1">Images and video files</p>
                </div>
                {pendingFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-slate-400">{pendingFiles.length} file(s) selected</span>
                    <ul className="space-y-1 max-h-24 overflow-y-auto">
                      {pendingFiles.map((f, i) => (
                        <li key={i} className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 rounded px-2 py-1">
                          <span className="truncate">{f.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-300"
                            onClick={() => removePendingFile(i)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-amber-200/90">
                  Upload will be available when connected. For now, use URL or Google Drive to add slides.
                </p>
              </div>
            )}

            {/* Google Drive: link input, use as URL */}
            {announcementSource === 'drive' && (
              <div className="space-y-3">
                <label className="text-sm text-slate-300 block">Paste Google Drive link</label>
                <Input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDriveLinkAsSlide()}
                  className="bg-slate-900/60 border-white/10 text-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-white/20 text-slate-300"
                  onClick={addDriveLinkAsSlide}
                  disabled={!driveLink.trim()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add link as slide
                </Button>
                {announcementSlides.filter((s) => s.url.trim()).length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-xs text-slate-400">Slides added: {announcementSlides.filter((s) => s.url.trim()).length}</span>
                  </div>
                )}
              </div>
            )}

            {/* Ideogram: prompt + disabled Generate */}
            {announcementSource === 'ideogram' && (
              <div className="space-y-3">
                <label className="text-sm text-slate-300 block">Describe your image</label>
                <Input
                  type="text"
                  placeholder="e.g., Welcome slide with church logo"
                  value={ideogramPrompt}
                  onChange={(e) => setIdeogramPrompt(e.target.value)}
                  className="bg-slate-900/60 border-white/10 text-white"
                />
                <Button
                  type="button"
                  disabled
                  className="w-full opacity-70 cursor-not-allowed"
                  title="Coming soon – API will be connected later"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with Ideogram
                </Button>
                <p className="text-xs text-slate-500">Coming soon – API will be connected later.</p>
              </div>
            )}

            {/* Add announcement to setlist: enabled for URL and Drive when we have URL slides */}
            <Button
              onClick={handleAnnouncementAddToSetlist}
              disabled={!canAddAnnouncementToSetlist}
              title={announcementSource === 'device' && pendingFiles.length > 0 ? 'Upload will be available when connected' : undefined}
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
