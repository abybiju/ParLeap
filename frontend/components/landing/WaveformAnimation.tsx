'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

type AnimationState = 'waveform' | 'orb' | 'card'

export function WaveformAnimation() {
  const [state, setState] = useState<AnimationState>('waveform')

  useEffect(() => {
    const sequence = ['waveform', 'orb', 'card'] as AnimationState[]
    let currentIndex = 0

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % sequence.length
      setState(sequence[currentIndex])
    }, 3000) // 3 seconds per state

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full h-64 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {state === 'waveform' && (
          <motion.div
            key="waveform"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.5 }}
            className="flex items-end gap-2 h-32"
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-3 bg-gradient-to-t from-orange-500 to-red-500 rounded-t"
                initial={{ height: '20%' }}
                animate={{
                  height: `${Math.random() * 80 + 20}%`,
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  delay: i * 0.05,
                }}
              />
            ))}
          </motion.div>
        )}

        {state === 'orb' && (
          <motion.div
            key="orb"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <motion.div
              className="w-32 h-32 rounded-full gradient-brand"
              animate={{
                scale: [1, 1.2, 1],
                boxShadow: [
                  '0 0 20px rgba(255, 140, 0, 0.5)',
                  '0 0 60px rgba(255, 140, 0, 0.8)',
                  '0 0 20px rgba(255, 140, 0, 0.5)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-white/20"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}

        {state === 'card' && (
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
            className="glass-card p-8 max-w-md"
          >
            <h4 className="text-xl font-semibold text-white mb-4">Amazing Grace</h4>
            <p className="text-2xl text-white leading-relaxed">
              Amazing grace how sweet the sound
            </p>
            <div className="mt-4 text-sm text-gray-400">Slide 1</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
