'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Music, Image as ImageIcon, BookOpen, Plus, Megaphone, Trash2, Link2, Upload, Cloud, Sparkles, Type, Eraser, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AnnouncementSlideInput, AnnouncementStructuredText } from '@/lib/types/setlist';
import { grabTextFromImage } from '@/lib/utils/grabTextOCR';
import { uploadAnnouncementAsset, validateAnnouncementFile } from '@/lib/utils/announcementUpload';
import { uploadMediaAsset, validateMediaFile } from '@/lib/utils/mediaUpload';
import { openGoogleDrivePicker, isGoogleDrivePickerAvailable } from '@/lib/utils/googleDrivePicker';
import { createClient } from '@/lib/supabase/client';
import { getSongsSearch } from '@/app/events/actions';
import dynamic from 'next/dynamic';

const PAGE_SIZE = 10;

const AnnouncementCanvasEditor = dynamic(
  () => import('./AnnouncementCanvasEditor').then((m) => m.AnnouncementCanvasEditor),
  { ssr: false }
);

type TabType = 'songs' | 'bible' | 'media' | 'announcement';
type AnnouncementSourceType = 'url' | 'device' | 'drive' | 'ideogram';

interface SetlistLibraryProps {
  setlistItems: Array<{ songId?: string; bibleRef?: string; mediaUrl?: string }>;
  onAddSong: (songId: string, song: { title: string; artist: string | null }) => void;
  onAddBible: (bibleRef: string) => void;
  onAddMedia: (mediaUrl: string, mediaTitle: string) => void;
  onAddAnnouncement: (slides: AnnouncementSlideInput[]) => void;
}

export function SetlistLibrary({
  setlistItems,
  onAddSong,
  onAddBible,
  onAddMedia,
  onAddAnnouncement,
}: SetlistLibraryProps) {
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [songsSearchQuery, setSongsSearchQuery] = useState('');
  const [songsDebouncedQuery, setSongsDebouncedQuery] = useState('');
  const [songsPage, setSongsPage] = useState(1);
  const [songsPageData, setSongsPageData] = useState<{ data: { id: string; title: string; artist: string | null }[]; total: number } | null>(null);
  const [songsLoading, setSongsLoading] = useState(false);
  const [mediaTitle, setMediaTitle] = useState('');
  type MediaSourceType = 'device' | 'drive';
  const [mediaSource, setMediaSource] = useState<MediaSourceType>('device');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaDriveLoading, setMediaDriveLoading] = useState(false);
  type AnnouncementSlideState = {
    url: string;
    type: 'image' | 'video';
    title: string;
    structuredText?: AnnouncementStructuredText;
    /** When source is device, file before upload */
    file?: File;
  };
  const defaultSlide = (): AnnouncementSlideState => ({ url: '', type: 'image', title: '' });
  const [announcementSlides, setAnnouncementSlides] = useState<AnnouncementSlideState[]>([defaultSlide()]);
  const [announcementSource, setAnnouncementSource] = useState<AnnouncementSourceType>('url');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [announcementDriveLoading, setAnnouncementDriveLoading] = useState(false);
  const [ideogramPrompt, setIdeogramPrompt] = useState('');
  const [grabTextSlideIndex, setGrabTextSlideIndex] = useState<number | null>(null);
  const [canvasEditorSlideIndex, setCanvasEditorSlideIndex] = useState<number | null>(null);
  const [canvasEditorObjectUrl, setCanvasEditorObjectUrl] = useState<string | null>(null);

  const excludeSongIds = setlistItems.map((i) => i.songId).filter((id): id is string => Boolean(id));
  const excludeSongIdsKey = excludeSongIds.join(',');

  // Debounce search query for Songs tab
  useEffect(() => {
    const t = setTimeout(() => setSongsDebouncedQuery(songsSearchQuery), 300);
    return () => clearTimeout(t);
  }, [songsSearchQuery]);

  // Fetch songs page when Songs tab is active
  useEffect(() => {
    if (activeTab !== 'songs') return;

    let cancelled = false;
    setSongsLoading(true);
    getSongsSearch({
      query: songsDebouncedQuery.trim() || undefined,
      limit: PAGE_SIZE,
      offset: (songsPage - 1) * PAGE_SIZE,
      excludeSongIds,
    })
      .then((result) => {
        if (!cancelled) {
          setSongsPageData({ data: result.data, total: result.total });
        }
      })
      .finally(() => {
        if (!cancelled) setSongsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // excludeSongIdsKey is the serialized exclude list so we refetch when setlist changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- excludeSongIds used inside via closure; key drives refetch
  }, [activeTab, songsDebouncedQuery, songsPage, excludeSongIdsKey]);

  const handleSongsSearchChange = (value: string) => {
    setSongsSearchQuery(value);
    setSongsPage(1);
  };

  const totalPages = songsPageData ? Math.max(1, Math.ceil(songsPageData.total / PAGE_SIZE)) : 1;
  const hasPrev = songsPage > 1;
  const hasNext = songsPage < totalPages;

  const handleAddBible = () => {
    onAddBible('Bible'); // Generic slot – AI listens for any verse, not a pre-set reference
  };

  const handleAddMedia = async () => {
    const title = mediaTitle.trim();
    if (!title) {
      toast.error('Enter a media title');
      return;
    }
    if (mediaSource === 'device' && mediaFile) {
      const validation = validateMediaFile(mediaFile);
      if (!validation.valid) {
        toast.error(validation.error ?? 'Invalid file');
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sign in to upload media.');
        return;
      }
      try {
        const url = await uploadMediaAsset(mediaFile, user.id);
        onAddMedia(url, title);
        setMediaTitle('');
        setMediaFile(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      }
      return;
    }
    if (mediaSource === 'drive') {
      toast.error('Click "Choose from Google Drive" to pick a file');
      return;
    }
    toast.error('Choose a file or drop one');
  };

  const handleMediaDrivePick = useCallback(async () => {
    const title = mediaTitle.trim();
    if (!title) {
      toast.error('Enter a media title first');
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sign in to add media from Google Drive.');
      return;
    }
    setMediaDriveLoading(true);
    try {
      await openGoogleDrivePicker(
        { multiple: false },
        async (files) => {
          if (files.length === 0) return;
          try {
            const f = files[0]!;
            const file = new File([f.blob], f.name, { type: f.mimeType });
            const url = await uploadMediaAsset(file, user.id);
            onAddMedia(url, title);
            setMediaTitle('');
            toast.success('Media added to setlist');
          } finally {
            setMediaDriveLoading(false);
          }
        },
        () => setMediaDriveLoading(false)
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google Drive failed');
    } finally {
      setMediaDriveLoading(false);
    }
  }, [mediaTitle, onAddMedia]);

  const handleMediaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setMediaFile(file);
    }
  }, []);

  const handleMediaDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleMediaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setMediaFile(file);
    }
    e.target.value = '';
  };

  const addPendingFilesAsSlides = useCallback(() => {
    if (pendingFiles.length === 0) return;
    const newSlides: AnnouncementSlideState[] = pendingFiles.map((f) => ({
      url: '',
      type: f.type.startsWith('video/') ? 'video' : 'image',
      title: '',
      file: f,
    }));
    setAnnouncementSlides((prev) => [...prev, ...newSlides]);
    setPendingFiles([]);
  }, [pendingFiles]);

  const hasStructuredText = (s: AnnouncementSlideState) => {
    const st = s.structuredText;
    if (!st) return false;
    if (st.title?.trim()) return true;
    if (st.subtitle?.trim()) return true;
    if (st.date?.trim()) return true;
    if (st.lines?.some((l) => (l ?? '').trim())) return true;
    return false;
  };
  const isValidSlide = (s: AnnouncementSlideState) =>
    ((s.url?.trim() || s.file) && (s.type === 'image' || s.type === 'video')) || hasStructuredText(s);
  const handleAnnouncementAddToSetlist = async () => {
    const slidesToSave = [...announcementSlides];
    const hasFiles = slidesToSave.some((s) => s.file);
    if (hasFiles) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sign in to upload slides.');
        return;
      }
      for (let i = 0; i < slidesToSave.length; i++) {
        const s = slidesToSave[i]!;
        if (s.file) {
          const validation = validateAnnouncementFile(s.file);
          if (!validation.valid) {
            toast.error(validation.error ?? 'Invalid file');
            return;
          }
          try {
            const url = await uploadAnnouncementAsset(s.file, user.id);
            slidesToSave[i] = { ...s, url, file: undefined };
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
            return;
          }
        }
      }
    }
    const valid = slidesToSave.filter((s) => (s.url?.trim() && (s.type === 'image' || s.type === 'video')) || hasStructuredText(s)).map((s) => {
      const out: AnnouncementSlideInput = {};
      if (s.url?.trim() && (s.type === 'image' || s.type === 'video')) {
        out.url = s.url.trim();
        out.type = s.type;
        if (s.title?.trim()) out.title = s.title.trim();
      }
      if (hasStructuredText(s) && s.structuredText) {
        out.structuredText = {
          title: s.structuredText.title?.trim() || undefined,
          subtitle: s.structuredText.subtitle?.trim() || undefined,
          date: s.structuredText.date?.trim() || undefined,
          lines: s.structuredText.lines?.map((l) => (l ?? '').trim()).filter(Boolean),
        };
        if (out.structuredText.lines?.length === 0) delete out.structuredText.lines;
      }
      return out;
    });
    if (valid.length > 0) {
      onAddAnnouncement(valid);
      setAnnouncementSlides([defaultSlide()]);
      setPendingFiles([]);
    }
  };

  const canAddAnnouncementToSetlist = announcementSlides.some(isValidSlide);
  const hasSlidesFromDevice = announcementSlides.some((s) => s.file);

  const handleAnnouncementDrivePick = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sign in to add slides from Google Drive.');
      return;
    }
    setAnnouncementDriveLoading(true);
    try {
      await openGoogleDrivePicker(
        { multiple: true },
        async (files) => {
        const newSlides: AnnouncementSlideState[] = [];
        for (const f of files) {
          const validation = validateAnnouncementFile(new File([f.blob], f.name, { type: f.mimeType }));
          if (!validation.valid) {
            toast.error(`${f.name}: ${validation.error ?? 'Invalid file'}`);
            continue;
          }
          try {
            const url = await uploadAnnouncementAsset(new File([f.blob], f.name, { type: f.mimeType }), user.id);
            newSlides.push({
              url,
              type: f.mimeType.startsWith('video/') ? 'video' : 'image',
              title: '',
            });
          } catch (err) {
            toast.error(`${f.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
          }
        }
        if (newSlides.length > 0) {
          setAnnouncementSlides((prev) => [...prev, ...newSlides]);
          toast.success(`${newSlides.length} slide(s) added from Google Drive`);
        }
        setAnnouncementDriveLoading(false);
      },
        () => setAnnouncementDriveLoading(false)
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google Drive failed');
      setAnnouncementDriveLoading(false);
    }
  }, []);

  const updateSlideStructuredText = (index: number, field: keyof AnnouncementStructuredText, value: string | string[]) => {
    setAnnouncementSlides((prev) =>
      prev.map((s, i) =>
        i !== index
          ? s
          : {
              ...s,
              structuredText: {
                ...s.structuredText,
                [field]: value,
              },
            }
      )
    );
  };

  const canGrabTextForSlide = useCallback((slide: AnnouncementSlideState): boolean => {
    if (slide.type !== 'image') return false;
    if (slide.file && slide.file.type.startsWith('image/')) return true;
    if (slide.url?.trim()) return true;
    return false;
  }, []);

  const openCanvasEditor = useCallback((index: number) => {
    const slide = announcementSlides[index];
    if (!slide || (slide.type !== 'image')) return;
    if (slide.file) {
      const url = URL.createObjectURL(slide.file);
      setCanvasEditorObjectUrl(url);
    } else {
      setCanvasEditorObjectUrl(null);
    }
    setCanvasEditorSlideIndex(index);
  }, [announcementSlides]);

  const closeCanvasEditor = useCallback(() => {
    setCanvasEditorSlideIndex(null);
    if (canvasEditorObjectUrl) {
      URL.revokeObjectURL(canvasEditorObjectUrl);
      setCanvasEditorObjectUrl(null);
    }
  }, [canvasEditorObjectUrl]);

  const handleCanvasEditorSave = useCallback(async (dataUrl: string) => {
    const index = canvasEditorSlideIndex;
    if (index == null) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'cleaned.png', { type: 'image/png' });
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sign in to save.');
        return;
      }
      const url = await uploadAnnouncementAsset(file, user.id);
      setAnnouncementSlides((prev) =>
        prev.map((s, i) => (i === index ? { ...s, url, file: undefined } : s))
      );
      toast.success('Cleaned image saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      return;
    }
    closeCanvasEditor();
  }, [canvasEditorSlideIndex, closeCanvasEditor]);

  const handleGrabText = useCallback(async (index: number) => {
    const slide = announcementSlides[index];
    if (!slide || !canGrabTextForSlide(slide)) return;
    setGrabTextSlideIndex(index);
    try {
      const source: File | string = slide.file ?? slide.url!.trim();
      const { structuredText } = await grabTextFromImage(source);
      setAnnouncementSlides((prev) =>
        prev.map((s, i) =>
          i !== index
            ? s
            : {
                ...s,
                structuredText: {
                  title: structuredText.title ?? s.structuredText?.title ?? '',
                  subtitle: structuredText.subtitle ?? s.structuredText?.subtitle ?? '',
                  date: structuredText.date ?? s.structuredText?.date ?? '',
                  lines: structuredText.lines?.length
                    ? structuredText.lines
                    : s.structuredText?.lines ?? [],
                },
              }
        )
      );
      toast.success('Text extracted. Review and edit below.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Grab Text failed';
      toast.error(msg + ' Try a clearer image or add text manually.');
    } finally {
      setGrabTextSlideIndex(null);
    }
  }, [announcementSlides, canGrabTextForSlide]);

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
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search by title or artist..."
                value={songsSearchQuery}
                onChange={(e) => handleSongsSearchChange(e.target.value)}
                className="pl-9 bg-slate-900/60 border-white/10 text-white placeholder:text-slate-500"
                aria-label="Search songs"
              />
            </div>
            {songsLoading ? (
              <div className="text-center text-slate-400 py-8 text-sm">Loading...</div>
            ) : !songsPageData ? (
              <div className="text-center text-slate-400 py-8 text-sm">Loading...</div>
            ) : songsPageData.data.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-sm">
                {songsSearchQuery.trim() ? 'No songs match your search' : 'All songs are already in the setlist or you have no songs yet'}
              </div>
            ) : (
              <>
                {songsPageData.data.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 hover:border-blue-300/50 transition cursor-pointer"
                    onClick={() => onAddSong(song.id, { title: song.title, artist: song.artist })}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{song.title}</p>
                      {song.artist && <p className="text-xs text-slate-400">{song.artist}</p>}
                    </div>
                    <Button variant="ghost" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-slate-500">
                    Page {songsPage} of {totalPages}
                    {songsPageData.total > 0 && ` (${songsPageData.total} total)`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-slate-300"
                      disabled={!hasPrev}
                      onClick={() => setSongsPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-slate-300"
                      disabled={!hasNext}
                      onClick={() => setSongsPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
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
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 self-center">Add from:</span>
              <Button
                type="button"
                variant={mediaSource === 'device' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  mediaSource === 'device' && 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                )}
                onClick={() => setMediaSource('device')}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Device / Drop
              </Button>
              <Button
                type="button"
                variant={mediaSource === 'drive' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  mediaSource === 'drive' && 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                )}
                onClick={() => setMediaSource('drive')}
              >
                <Cloud className="h-3.5 w-3.5 mr-1.5" />
                Google Drive
              </Button>
            </div>
            {mediaSource === 'device' && (
              <div
                onDrop={handleMediaDrop}
                onDragOver={handleMediaDragOver}
                className="rounded-lg border-2 border-dashed border-white/20 bg-slate-900/40 p-6 text-center hover:border-amber-500/40 transition-colors"
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaFileSelect}
                  className="hidden"
                  id="media-file-input"
                />
                <label
                  htmlFor="media-file-input"
                  className="cursor-pointer block text-slate-400 text-sm"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                  Drop a file here or click to browse
                </label>
                <p className="text-xs text-slate-500 mt-1">One image or video (max 50MB)</p>
                {mediaFile && (
                  <p className="text-xs text-amber-300 mt-2 truncate max-w-full px-2">
                    {mediaFile.name}
                  </p>
                )}
              </div>
            )}
            {mediaSource === 'drive' && (
              <div className="space-y-2">
                {isGoogleDrivePickerAvailable() ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-amber-500/40 text-amber-200"
                    onClick={() => void handleMediaDrivePick()}
                    disabled={!mediaTitle.trim() || mediaDriveLoading}
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    {mediaDriveLoading ? 'Opening Google Drive…' : 'Choose from Google Drive'}
                  </Button>
                ) : (
                  <p className="text-xs text-slate-400">
                    Google Drive is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable.
                  </p>
                )}
              </div>
            )}
            {mediaSource === 'device' && (
              <Button
                onClick={() => void handleAddMedia()}
                disabled={!mediaTitle.trim() || !mediaFile}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Media
              </Button>
            )}
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
                      {/* Exact wording – operator-typed text shown on projector to avoid AI/image typos */}
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs text-slate-400">Exact wording (recommended for names, dates)</p>
                          <div className="flex gap-1.5 shrink-0">
                            {canGrabTextForSlide(slide) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
                                disabled={grabTextSlideIndex === index}
                                onClick={() => handleGrabText(index)}
                              >
                                {grabTextSlideIndex === index ? (
                                  <>Extracting…</>
                                ) : (
                                  <>
                                    <Type className="h-3.5 w-3.5 mr-1.5" />
                                    Grab Text
                                  </>
                                )}
                              </Button>
                            )}
                            {slide.type === 'image' && (slide.url?.trim() || slide.file) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-slate-400/40 text-slate-300 hover:bg-slate-500/20"
                                onClick={() => openCanvasEditor(index)}
                                title="Draw over image to cover text (simple brush)"
                              >
                                <Eraser className="h-3.5 w-3.5 mr-1.5" />
                                Clean image
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-1.5">Best for straight, Latin text.</p>
                        <Input
                          type="text"
                          placeholder="Heading"
                          value={slide.structuredText?.title ?? ''}
                          onChange={(e) => updateSlideStructuredText(index, 'title', e.target.value)}
                          className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                        />
                        <Input
                          type="text"
                          placeholder="Subtitle (optional)"
                          value={slide.structuredText?.subtitle ?? ''}
                          onChange={(e) => updateSlideStructuredText(index, 'subtitle', e.target.value)}
                          className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                        />
                        <Input
                          type="text"
                          placeholder="Date (optional)"
                          value={slide.structuredText?.date ?? ''}
                          onChange={(e) => updateSlideStructuredText(index, 'date', e.target.value)}
                          className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                        />
                        {[0, 1, 2, 3].map((li) => {
                          const lines = slide.structuredText?.lines ?? [];
                          return (
                            <Input
                              key={li}
                              type="text"
                              placeholder={`Line ${li + 1} (optional)`}
                              value={lines[li] ?? ''}
                              onChange={(e) => {
                                const next = [...lines];
                                while (next.length <= li) next.push('');
                                next[li] = e.target.value;
                                updateSlideStructuredText(index, 'lines', next);
                              }}
                              className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-white/20 text-slate-300"
                  onClick={() => setAnnouncementSlides((prev) => [...prev, defaultSlide()])}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-amber-500/40 text-amber-200"
                      onClick={addPendingFilesAsSlides}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add files as slides
                    </Button>
                  </div>
                )}
                {/* Slide list for device: same cards so user can Grab Text then add to setlist */}
                {hasSlidesFromDevice && (
                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <p className="text-xs text-slate-400">Slides (upload when you add to setlist)</p>
                    {announcementSlides.map((slide, slideIndex) => {
                      if (!slide.file && !slide.url?.trim()) return null;
                      return (
                        <div key={slideIndex} className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">
                              {slide.file ? `File: ${slide.file.name}` : 'URL'}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-red-300 h-8 w-8 p-0"
                              onClick={() =>
                                setAnnouncementSlides((prev) => prev.filter((_, i) => i !== slideIndex))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {slide.file && (
                            <Input
                              type="text"
                              placeholder="Title (optional)"
                              value={slide.title}
                              onChange={(e) =>
                                setAnnouncementSlides((prev) =>
                                  prev.map((s, i) => (i === slideIndex ? { ...s, title: e.target.value } : s))
                                )
                              }
                              className="bg-slate-900/60 border-white/10 text-white text-sm"
                            />
                          )}
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-xs text-slate-400">Exact wording</p>
                              <div className="flex gap-1.5 shrink-0">
                                {canGrabTextForSlide(slide) && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
                                    disabled={grabTextSlideIndex === slideIndex}
                                    onClick={() => handleGrabText(slideIndex)}
                                  >
                                    {grabTextSlideIndex === slideIndex ? 'Extracting…' : (
                                      <><Type className="h-3.5 w-3.5 mr-1.5" /> Grab Text</>
                                    )}
                                  </Button>
                                )}
                                {slide.type === 'image' && (slide.url?.trim() || slide.file) && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-400/40 text-slate-300 hover:bg-slate-500/20"
                                    onClick={() => openCanvasEditor(slideIndex)}
                                    title="Draw over image to cover text"
                                  >
                                    <Eraser className="h-3.5 w-3.5 mr-1.5" />
                                    Clean image
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Input
                              type="text"
                              placeholder="Heading"
                              value={slide.structuredText?.title ?? ''}
                              onChange={(e) => updateSlideStructuredText(slideIndex, 'title', e.target.value)}
                              className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                            />
                            <Input
                              type="text"
                              placeholder="Subtitle"
                              value={slide.structuredText?.subtitle ?? ''}
                              onChange={(e) => updateSlideStructuredText(slideIndex, 'subtitle', e.target.value)}
                              className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                            />
                            <Input
                              type="text"
                              placeholder="Date"
                              value={slide.structuredText?.date ?? ''}
                              onChange={(e) => updateSlideStructuredText(slideIndex, 'date', e.target.value)}
                              className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                            />
                            {[0, 1, 2, 3].map((li) => {
                              const lines = slide.structuredText?.lines ?? [];
                              return (
                                <Input
                                  key={li}
                                  type="text"
                                  placeholder={`Line ${li + 1}`}
                                  value={lines[li] ?? ''}
                                  onChange={(e) => {
                                    const next = [...lines];
                                    while (next.length <= li) next.push('');
                                    next[li] = e.target.value;
                                    updateSlideStructuredText(slideIndex, 'lines', next);
                                  }}
                                  className="bg-slate-900/60 border-white/10 text-white text-sm mb-1.5"
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Google Drive: open Picker, upload to our storage, add as slides */}
            {announcementSource === 'drive' && (
              <div className="space-y-3">
                {isGoogleDrivePickerAvailable() ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-amber-500/40 text-amber-200"
                      onClick={() => void handleAnnouncementDrivePick()}
                      disabled={announcementDriveLoading}
                    >
                      <Cloud className="h-4 w-4 mr-2" />
                      {announcementDriveLoading ? 'Opening Google Drive…' : 'Choose from Google Drive'}
                    </Button>
                    <p className="text-xs text-slate-400">Pick one or more images or videos from your Drive. They will be uploaded and added as slides.</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">
                    Google Drive is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable.
                  </p>
                )}
                {announcementSlides.filter(isValidSlide).length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-xs text-slate-400">Slides added: {announcementSlides.filter(isValidSlide).length}</span>
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
              title={announcementSource === 'device' && pendingFiles.length > 0 ? 'Add files as slides first' : undefined}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add announcement to setlist
            </Button>
          </div>
        )}

        {/* Canvas editor modal: clean image with eraser (frontend-only) */}
        {canvasEditorSlideIndex !== null && announcementSlides[canvasEditorSlideIndex] && (() => {
          const slide = announcementSlides[canvasEditorSlideIndex]!;
          const imageSource = canvasEditorObjectUrl ?? slide.url?.trim() ?? '';
          return imageSource ? (
            <AnnouncementCanvasEditor
              open={true}
              onOpenChange={(open) => !open && closeCanvasEditor()}
              imageSource={imageSource}
              onSave={handleCanvasEditorSave}
            />
          ) : null;
        })()}
      </div>
    </div>
  );
}
