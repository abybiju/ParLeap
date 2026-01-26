'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createEvent, deleteEvent, updateEvent } from '@/app/events/actions';

type EventStatus = 'draft' | 'live' | 'ended';

interface EventFormProps {
  mode: 'create' | 'edit';
  event?: {
    id: string;
    name: string;
    event_date: string | null;
    status: EventStatus;
  };
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function EventForm({ mode, event }: EventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(event?.name ?? '');
  const [eventDate, setEventDate] = useState(toDateTimeLocal(event?.event_date));
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'draft');

  const title = useMemo(() => {
    return mode === 'create' ? 'Create Event' : 'Event Details';
  }, [mode]);

  const handleSubmit = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('name', name);
      formData.set('event_date', eventDate);
      formData.set('status', status);

      const result = mode === 'create'
        ? await createEvent(formData)
        : await updateEvent(event?.id ?? '', formData);

      if (!result.success) {
        toast.error(result.error || 'Something went wrong');
        return;
      }

      toast.success(mode === 'create' ? 'Event created' : 'Event updated');

      if (mode === 'create' && result.id) {
        router.push(`/events/${result.id}`);
      } else {
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!event?.id) return;
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/40 backdrop-blur">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-slate-300">Manage the event settings and schedule.</p>
        </div>
        {mode === 'edit' && (
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Event
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">Event Name</label>
          <Input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sunday Service"
            className="mt-2"
          />
        </div>
        <div>
          <label className="text-sm text-slate-300">Event Date</label>
          <Input
            name="event_date"
            type="datetime-local"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <label className="text-sm text-slate-300">Status</label>
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as EventStatus)}
            className="mt-2 w-full rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          >
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
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
