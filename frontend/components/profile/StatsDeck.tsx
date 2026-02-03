'use client'

import { Calendar, Music, Users, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsDeckProps {
  className?: string
}

// Mock stats data
const mockStats = [
  { label: 'EVENTS_RUN', value: '24', icon: Calendar },
  { label: 'SONGS_ADDED', value: '156', icon: Music },
  { label: 'TEAM_MEMBERS', value: '3', icon: Users },
  { label: 'STORAGE_USED', value: '2.4GB', icon: HardDrive },
]

export function StatsDeck({ className }: StatsDeckProps) {
  return (
    <div
      className={cn(
        'backdrop-blur-xl bg-[#0A0A0A]/60 border border-white/10 rounded-2xl p-6',
        className
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {mockStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="text-center">
              <Icon className="w-5 h-5 mx-auto text-gray-500 mb-2" />
              <span className="text-3xl font-mono font-bold text-white block">{stat.value}</span>
              <p className="text-xs font-mono text-gray-500 mt-1 uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
