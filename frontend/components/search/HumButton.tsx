'use client'

import { useState } from 'react'
import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ListeningOverlay } from './ListeningOverlay'

interface HumButtonProps {
  variant?: 'icon' | 'full'
  className?: string
  onSelectSong?: (songId: string) => void
}

export function HumButton({ variant = 'icon', className, onSelectSong }: HumButtonProps) {
  const [listening, setListening] = useState(false)

  const handleToggle = () => {
    setListening(true)
  }

  if (variant === 'full') {
    return (
      <>
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'group relative flex items-center gap-3 px-5 py-3 rounded-full',
            'bg-gradient-to-r from-orange-500/10 to-red-500/10',
            'border border-orange-500/30 hover:border-orange-500/60',
            'transition-all duration-300',
            'hover:shadow-lg hover:shadow-orange-500/20',
            className
          )}
        >
          {/* Animated background */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-500 opacity-0 group-hover:opacity-10 transition-opacity" />
          
          {/* Icon with subtle animation */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping opacity-0 group-hover:opacity-50" />
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
          </div>
          
          {/* Text */}
          <div className="text-left">
            <p className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">
              Hum to Search
            </p>
            <p className="text-xs text-white/50">
              Find songs by melody
            </p>
          </div>
        </button>

        <ListeningOverlay
          open={listening}
          onClose={() => setListening(false)}
          onSelectSong={onSelectSong}
        />
      </>
    )
  }

  // Icon variant (default)
  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'group relative rounded-full p-2.5 transition-all duration-300',
          'hover:bg-gradient-to-br hover:from-orange-500/20 hover:to-red-500/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          className
        )}
        aria-label="Hum to search for a song"
        title="Hum to search"
      >
        {/* Hover glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-red-500 opacity-0 group-hover:opacity-20 blur-md transition-opacity" />

        {/* Icon */}
        <Mic
          className={cn(
            'h-5 w-5 relative z-10 transition-all duration-300',
            'text-white/60 group-hover:text-orange-400',
            'group-hover:scale-110'
          )}
        />
      </button>

      <ListeningOverlay
        open={listening}
        onClose={() => setListening(false)}
        onSelectSong={onSelectSong}
      />
    </>
  )
}
