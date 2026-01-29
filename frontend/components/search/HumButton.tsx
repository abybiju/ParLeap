'use client'

import { useState } from 'react'
import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ListeningOverlay } from './ListeningOverlay'

export function HumButton() {
  const [listening, setListening] = useState(false)

  const handleToggle = () => {
    setListening((prev) => !prev)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'relative rounded-full p-2.5 transition-colors',
          'hover:bg-muted/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          listening && 'overflow-visible'
        )}
        aria-label={listening ? 'Stop listening' : 'Start humming to search'}
      >
        {/* Pulsing Ring - only visible when listening */}
        {listening && (
          <span
            className={cn(
              'absolute inset-0 rounded-full bg-red-500/50',
              'animate-ping'
            )}
            aria-hidden="true"
          />
        )}

        {/* Microphone Icon */}
        <Mic
          className={cn(
            'h-5 w-5 relative z-10 transition-colors',
            listening ? 'text-red-500' : 'text-muted-foreground'
          )}
        />
      </button>

      {/* Listening Overlay */}
      <ListeningOverlay
        open={listening}
        onClose={() => setListening(false)}
      />
    </>
  )
}
