'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutList, Library, ImagePlus, X, Upload, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EventFormCompact } from './EventFormCompact';
import { UnsplashBackgroundPicker } from './UnsplashBackgroundPicker';
import { updateEventBackground } from '@/app/events/actions';
import { validateEventBackgroundFile, uploadEventBackgroundAsset } from '@/lib/utils/eventBackgroundUpload';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type EventEditView = 'setlist' | 'library';

interface EventEditSidebarProps {
  event: {
    id: string;
    name: string;
    event_date: string | null;
    status: 'draft' | 'live' | 'ended';
    background_image_url?: string | null;
    background_media_type?: string | null;
  };
  setlistItemCount: number;
  activeView: EventEditView;
  onViewChange: (view: EventEditView) => void;
}

export function EventEditSidebar({
  event,
  setlistItemCount,
  activeView,
  onViewChange,
}: EventEditSidebarProps) {
  const router = useRouter();
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundUrl = event.background_image_url ?? null;
  const backgroundMediaType = event.background_media_type ?? null;

  const handleClearBackground = async () => {
    const result = await updateEventBackground(event.id, null, null);
    if (result.success) {
      toast.success('Background cleared');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to clear');
    }
  };

  const handleDeviceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const validation = validateEventBackgroundFile(file);
    if (!validation.valid) {
      toast.error(validation.error ?? 'Invalid file');
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }
      const publicUrl = await uploadEventBackgroundAsset(file, user.id, event.id);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      const result = await updateEventBackground(event.id, publicUrl, mediaType);
      if (result.success) {
        toast.success(mediaType === 'video' ? 'Background video set' : 'Background image set');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to set background');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="w-72 shrink-0 flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="glass-card rounded-xl p-4 space-y-4">
        <EventFormCompact event={event} />
      </div>

      <div className="glass-card rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-slate-200">Projector background</h3>
        {backgroundUrl ? (
          <div className="space-y-2">
            <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-slate-800">
              {backgroundMediaType === 'video' ? (
                <>
                  <video
                    src={backgroundUrl}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                    aria-label="Projector background video"
                  />
                  <div className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-slate-300">
                    <Video className="h-3 w-3" />
                    Video
                  </div>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- dynamic event background URL */
                <img
                  src={backgroundUrl}
                  alt="Projector background"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              {backgroundMediaType === 'video' ? 'Video from device' : 'Photo from Unsplash or device (attribution optional)'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearBackground}
              className="w-full border-white/10 text-slate-300 hover:bg-white/10"
            >
              <X className="h-3 w-3 mr-1" />
              Clear background
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Optional image behind lyrics on the projector.</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleDeviceFile}
          aria-label="Add background from device"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setUnsplashOpen(true)}
            className="flex-1 border-white/10 text-slate-300 hover:bg-white/10"
          >
            <ImagePlus className="h-3 w-3 mr-1" />
            {backgroundUrl ? 'Change' : 'Unsplash'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 border-white/10 text-slate-300 hover:bg-white/10"
          >
            <Upload className="h-3 w-3 mr-1" />
            {uploading ? 'Uploading…' : 'From device'}
          </Button>
        </div>
      </div>

      <UnsplashBackgroundPicker
        eventId={event.id}
        open={unsplashOpen}
        onOpenChange={setUnsplashOpen}
        onSuccess={() => router.refresh()}
      />

      <nav className="glass-card rounded-xl p-2 space-y-0.5" aria-label="Event workspace">
        <button
          type="button"
          onClick={() => onViewChange('setlist')}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            activeView === 'setlist'
              ? 'bg-orange-500/20 text-amber-200 border border-orange-500/50'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          )}
        >
          <LayoutList className="h-4 w-4 shrink-0" />
          Setlist
        </button>
        <button
          type="button"
          onClick={() => onViewChange('library')}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            activeView === 'library'
              ? 'bg-orange-500/20 text-amber-200 border border-orange-500/50'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          )}
        >
          <Library className="h-4 w-4 shrink-0" />
          Content Library
        </button>
      </nav>

      {activeView === 'library' && setlistItemCount > 0 && (
        <p className="text-xs text-slate-500">
          {setlistItemCount} item{setlistItemCount !== 1 ? 's' : ''} in setlist
        </p>
      )}
    </aside>
  );
}
