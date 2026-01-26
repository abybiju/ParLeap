import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventForm } from '@/components/events/EventForm';

export default async function NewEventPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <EventForm mode="create" />
      </div>
    </main>
  );
}
