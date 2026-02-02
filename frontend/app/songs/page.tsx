import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SongsPageClient } from './SongsPageClient';
import { AppPageWrapper } from '@/components/layout/AppPageWrapper';

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
    <AppPageWrapper className="bg-background">
      <div>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Song Library</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your songs and lyrics
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Suspense fallback={<SongsLoadingSkeleton />}>
          <SongsPageClient initialSongs={songs} />
        </Suspense>
      </main>
      </div>
    </AppPageWrapper>
  );
}

function SongsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="h-12 bg-muted/30" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 border-t border-border/30 bg-muted/10" />
        ))}
      </div>
    </div>
  );
}
