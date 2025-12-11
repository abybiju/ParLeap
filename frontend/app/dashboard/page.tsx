import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-indigo-200">Welcome{user?.email ? `, ${user.email}` : ''}</p>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-slate-300">
              Start by building your content library, creating an event, then launching a live session.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/songs"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 hover:border-indigo-300/50 transition shadow-lg shadow-indigo-500/10"
            >
              <h2 className="text-lg font-semibold text-white">Songs Library</h2>
              <p className="text-sm text-slate-300 mt-1">Manage lyrics and content.</p>
            </Link>

            <Link
              href="/events"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 hover:border-indigo-300/50 transition shadow-lg shadow-indigo-500/10"
            >
              <h2 className="text-lg font-semibold text-white">Events & Setlists</h2>
              <p className="text-sm text-slate-300 mt-1">Create events and arrange songs.</p>
            </Link>

            <Link
              href="/live/operator/sample"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 hover:border-indigo-300/50 transition shadow-lg shadow-indigo-500/10"
            >
              <h2 className="text-lg font-semibold text-white">Operator View</h2>
              <p className="text-sm text-slate-300 mt-1">Control slides and monitor transcripts.</p>
            </Link>

            <Link
              href="/live/display/sample"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 hover:border-indigo-300/50 transition shadow-lg shadow-indigo-500/10"
            >
              <h2 className="text-lg font-semibold text-white">Audience View</h2>
              <p className="text-sm text-slate-300 mt-1">Preview the projector display.</p>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
