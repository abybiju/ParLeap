'use client'

import { Calendar, Music, HardDrive } from 'lucide-react'
import { useProfileStats } from '@/lib/hooks/useProfileStats'
import { cn } from '@/lib/utils'

interface StatsDeckProps {
  className?: string
}

export function StatsDeck({ className }: StatsDeckProps) {
  const { eventsRun, songsAdded, storageUsed, isLoading } = useProfileStats()

  const stats = [
    { label: 'Events Run', value: eventsRun, icon: Calendar },
    { label: 'Songs Added', value: songsAdded, icon: Music },
    { label: 'Storage Used', value: storageUsed, icon: HardDrive },
  ]

  return (
    <div
      className={cn(
        'bg-white/5 border border-gray-200/20 rounded-xl p-8 shadow-sm',
        className
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="text-center">
              <Icon className="w-6 h-6 mx-auto text-gray-400 mb-3" />
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-700/50 rounded animate-pulse mx-auto mb-2" />
              ) : (
                <span className="text-3xl font-semibold text-white block mb-1">
                  {stat.value}
                </span>
              )}
              <p className="text-sm text-gray-400">{stat.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
