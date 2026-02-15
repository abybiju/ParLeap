'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassDatePicker } from '@/components/ui/GlassDatePicker';
import { deleteEvent, updateEvent } from '@/app/events/actions';

type EventStatus = 'draft' | 'live' | 'ended';

interface EventFormCompactProps {
  event: {
    id: string;
    name: string;
    event_date: string | null;
    status: EventStatus;
  };
}

function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dateToISO(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString();
}

export function EventFormCompact({ event }: EventFormCompactProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(event.name ?? '');
  const [eventDateTime, setEventDateTime] = useState<Date | null>(parseDateTime(event.event_date));
  const [status, setStatus] = useState<EventStatus>(event.status ?? 'draft');

  const handleSubmit = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('name', name);
      formData.set('event_date', dateToISO(eventDateTime) || '');
      formData.set('status', status);

      const result = await updateEvent(event.id, formData);

      if (!result.success) {
        toast.error(result.error || 'Something went wrong');
        return;
      }

      toast.success('Event updated');
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (!result.success) {
        toast.error(result.error || 'Failed to delete event');
        return;
      }
      toast.success('Event deleted');
      router.push('/events');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 block mb-1">Event name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sunday Service"
          className="border-white/10 bg-slate-900/60 text-white text-sm placeholder:text-slate-500 focus-visible:ring-orange-500/50"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Date & time</label>
        <GlassDatePicker
          value={eventDateTime}
          onChange={setEventDateTime}
          placeholder="Select date"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EventStatus)}
          className="w-full rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        >
          <option value="draft">Draft</option>
          <option value="live">Live</option>
          <option value="ended">Ended</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isPending}
          size="sm"
          className="w-full"
        >
          {isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-slate-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete event
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              This will permanently remove the event and its setlist. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
