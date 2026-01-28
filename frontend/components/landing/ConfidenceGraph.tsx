'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function ConfidenceGraph() {
  const [confidence, setConfidence] = useState(98)

  useEffect(() => {
    const interval = setInterval(() => {
      setConfidence((prev) => {
        const change = Math.random() * 4 - 2 // -2 to +2
        return Math.max(95, Math.min(100, prev + change))
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <motion.span
          key={confidence}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent"
        >
          {Math.round(confidence)}%
        </motion.span>
        <span className="text-gray-400 text-sm">confidence</span>
      </div>
      
      <div className="flex gap-1 h-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="flex-1 bg-gradient-to-t from-orange-500 to-red-500 rounded-full"
            initial={{ scaleY: 0.3 }}
            animate={{
              scaleY: Math.random() * 0.7 + 0.3,
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: i * 0.05,
            }}
          />
        ))}
      </div>
    </div>
  )
}
