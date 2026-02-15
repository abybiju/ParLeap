'use client';

import Link from 'next/link';
import { ArrowLeft, LayoutList, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventFormCompact } from './EventFormCompact';

type EventEditView = 'setlist' | 'library';

interface EventEditSidebarProps {
  event: {
    id: string;
    name: string;
    event_date: string | null;
    status: 'draft' | 'live' | 'ended';
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
