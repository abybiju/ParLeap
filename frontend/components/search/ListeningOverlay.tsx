'use client'

import { cn } from '@/lib/utils'

interface ListeningOverlayProps {
  open: boolean
  onClose?: () => void
}

export function ListeningOverlay({ open, onClose }: ListeningOverlayProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="glass-card p-12 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Text */}
        <p className="text-center text-xl font-semibold text-white mb-8">
          Hum a song...
        </p>

        {/* Waveform Bars */}
        <div className="flex items-end justify-center gap-2 h-24">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 bg-gradient-to-t from-orange-500 to-red-500 rounded-t',
                'animate-waveform origin-bottom'
              )}
              style={{
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
