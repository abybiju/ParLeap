'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutList, Library, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EventFormCompact } from './EventFormCompact';
import { UnsplashBackgroundPicker } from './UnsplashBackgroundPicker';
import { updateEventBackground } from '@/app/events/actions';
import { toast } from 'sonner';

type EventEditView = 'setlist' | 'library';

interface EventEditSidebarProps {
  event: {
    id: string;
    name: string;
    event_date: string | null;
    status: 'draft' | 'live' | 'ended';
    background_image_url?: string | null;
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
  const backgroundUrl = event.background_image_url ?? null;

  const handleClearBackground = async () => {
    const result = await updateEventBackground(event.id, null);
    if (result.success) {
      toast.success('Background cleared');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to clear');
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
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic event background URL */}
              <img
                src={backgroundUrl}
                alt="Projector background"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[10px] text-slate-500">Photo from Unsplash (attribution on projector optional)</p>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setUnsplashOpen(true)}
          className="w-full border-white/10 text-slate-300 hover:bg-white/10"
        >
          <ImagePlus className="h-3 w-3 mr-1" />
          {backgroundUrl ? 'Change image' : 'Search Unsplash'}
        </Button>
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
