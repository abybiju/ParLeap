import { Suspense } from 'react'
import { BiblePageClient } from './BiblePageClient'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'
import { MissionControlBackground } from '@/components/layout/MissionControlBackground'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Bible | ParLeap',
  description: 'Read Bible verses',
}

export default async function BiblePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  return (
    <>
      <MissionControlBackground />
      <AppPageWrapper>
        <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-12 text-gray-400">Loading…</div>}>
          <BiblePageClient />
        </Suspense>
      </AppPageWrapper>
    </>
  )
}
