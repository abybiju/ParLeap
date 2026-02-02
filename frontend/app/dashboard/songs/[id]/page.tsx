import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SongEditorForm } from '@/components/songs/SongEditorForm'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'
import type { Database } from '@/lib/supabase/types'

type Song = Database['public']['Tables']['songs']['Row']

interface SongDetailPageProps {
  params: {
    id: string
  }
}

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: song, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()
    .returns<Song>()

  if (error || !song) {
    notFound()
  }

  return (
    <AppPageWrapper className="bg-background">
      <main className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="mb-6">
          <Link
            href="/songs"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Songs
          </Link>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl">
          <h1 className="text-2xl font-bold tracking-tight mb-6">Edit Song</h1>
          
          <SongEditorForm
            song={song}
            mode="page"
          />
        </div>
      </main>
    </AppPageWrapper>
  )
}
