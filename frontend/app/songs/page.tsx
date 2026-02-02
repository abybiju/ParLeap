import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SongsPageClient } from './SongsPageClient';
import { AppPageWrapper } from '@/components/layout/AppPageWrapper';
import { MissionControlBackground } from '@/components/layout/MissionControlBackground';

export const metadata = {
  title: 'Song Library | ParLeap',
  description: 'Manage your song library',
};

async function getSongs() {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*')
    .eq('user_id', user.id)
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching songs:', error);
    return [];
  }

  return songs || [];
}

export default async function SongsPage() {
  const songs = await getSongs();

  return (
    <AppPageWrapper className="relative text-white">
      <MissionControlBackground />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Mission Control</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Song Library</h1>
              <p className="text-sm text-slate-400">
                Manage your songs and lyrics
              </p>
            </div>
          </div>

          <Suspense fallback={<SongsLoadingSkeleton />}>
            <SongsPageClient initialSongs={songs} />
          </Suspense>
        </div>
      </main>
    </AppPageWrapper>
  );
}

function SongsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 bg-white/5 animate-pulse rounded-md" />
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden backdrop-blur-xl">
        <div className="h-12 bg-white/[0.03]" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 border-t border-white/10 bg-white/5" />
        ))}
      </div>
    </div>
  );
}
