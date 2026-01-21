import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OperatorHUD } from '@/components/operator/OperatorHUD'

interface LivePageProps {
  params: {
    id: string
  }
}

export default async function LivePage({ params }: LivePageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch event details
  const { data: event, error } = await supabase
    .from('events')
    .select('id, name, event_date, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !event) {
    notFound()
  }

  return <OperatorHUD eventId={params.id} eventName={(event as any).name || 'Untitled Event'} />
}
