'use client'

import Link from 'next/link'

interface DashboardHeroProps {
  event: {
    id: string
    name: string
    event_date: string | null
    status: 'draft' | 'live' | 'ended'
  } | null
  songCount?: number
}

/**
 * Format time until event starts
 */
function formatUpcomingTime(eventDate: string): string {
  const now = new Date()
  const event = new Date(eventDate)
  const hoursUntil = (event.getTime() - now.getTime()) / (1000 * 60 * 60)
  
  if (hoursUntil < 1) {
    const minutesUntil = Math.floor(hoursUntil * 60)
    return `starts in ${minutesUntil} minutes`
  } else if (hoursUntil < 24) {
    return `starts in ${Math.floor(hoursUntil)} hours`
  } else if (hoursUntil < 48) {
    return `starts tomorrow at ${event.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }
  return `starts ${event.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`
}

/**
 * Smart HUD Dashboard Hero Component
 * Shows contextual information based on event urgency:
 * - On-Air: Live event (high urgency)
 * - Up Next: Upcoming event within 48 hours (medium urgency)
 * - Standard: Hidden (low urgency)
 */
export function DashboardHero({ event, songCount = 0 }: DashboardHeroProps) {
  if (!event) {
    return null // Standard state - hidden
  }

  // State 1: On-Air (Live Event)
  if (event.status === 'live') {
    return (
      <div className="w-full p-8 rounded-2xl mb-8 flex items-center justify-between bg-gradient-to-r from-red-900/60 to-orange-900/60 border border-red-500/50 shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)] animate-pulse">
        <div className="flex items-center gap-6">
          <span className="px-3 py-1 rounded-full bg-red-500/30 text-red-200 border border-red-500/50 text-xs font-medium uppercase tracking-wider">
            🔴 LIVE
          </span>
          <div>
            <h2 className="text-2xl font-bold text-white">{event.name} is LIVE</h2>
          </div>
        </div>
        <Link
          href={`/live/${event.id}`}
          className="rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:opacity-90"
        >
          RESUME CONTROL
        </Link>
      </div>
    )
  }

  // State 2: Up Next (Upcoming Event)
  if (event.status === 'draft' && event.event_date) {
    const timeText = formatUpcomingTime(event.event_date)
    const songText = songCount === 1 ? 'Song' : 'Songs'
    
    return (
      <div className="w-full p-8 rounded-2xl mb-8 flex items-center justify-between bg-gradient-to-r from-orange-900/40 to-black border border-orange-500/30 shadow-[0_0_40px_-10px_rgba(234,88,12,0.2)] backdrop-blur-xl">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-medium uppercase tracking-wider">
              Up Next
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{event.name}</h2>
          <p className="text-sm text-slate-400">
            {timeText} • {songCount} {songText} Ready
          </p>
        </div>
        <div className="flex items-center gap-3 ml-6">
          <Link
            href={`/live/${event.id}`}
            className="rounded-lg bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90"
          >
            Launch Live
          </Link>
          <Link
            href={`/events/${event.id}`}
            className="rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Edit Setlist
          </Link>
        </div>
      </div>
    )
  }

  // No matching state - return null
  return null
}
