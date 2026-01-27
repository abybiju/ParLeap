'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Database } from '@/lib/supabase/types';

type Event = Database['public']['Tables']['events']['Row'];

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const eventDate = event.event_date ? new Date(event.event_date) : null;
  // Format date only (no time) for cleaner display
  const formattedDate = eventDate && !Number.isNaN(eventDate.getTime())
    ? eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'No date set';

  const getStatusBadge = () => {
    switch (event.status) {
      case 'live':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'ended':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'draft':
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  const getStatusLabel = () => {
    switch (event.status) {
      case 'live':
        return 'Live';
      case 'ended':
        return 'Ended';
      case 'draft':
      default:
        return 'Draft';
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:border-indigo-300/50 transition-all duration-200 shadow-lg shadow-indigo-500/10 backdrop-blur">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{event.name}</h3>
          <p className="text-sm text-slate-400">{formattedDate}</p>
        </div>
        <span
          className={cn(
            'px-2 py-1 rounded-full text-xs font-medium border',
            getStatusBadge()
          )}
        >
          {getStatusLabel()}
        </span>
      </div>

      <div className="flex gap-2 mt-4">
        <Link
          href={`/live/${event.id}`}
          className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition text-center"
        >
          Launch Live
        </Link>
        <Link
          href={`/events/${event.id}`}
          className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
