'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface TypewriterTextProps {
  text: string
  delay?: number
  className?: string
}

export function TypewriterText({ text, delay = 0, className = '' }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    setDisplayedText('') // Reset when text changes
    let interval: NodeJS.Timeout | null = null

    // Start typing after delay
    const timeout = setTimeout(() => {
      let currentIndex = 0
      interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          if (interval) clearInterval(interval)
        }
      }, 30) // 30ms per character for smooth typing
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [text, delay])

  // Blinking cursor animation
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 530) // Blink every 530ms

    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <span className={`inline-block ${className}`}>
      {displayedText}
      <motion.span
        animate={{ opacity: showCursor ? 1 : 0 }}
        transition={{ duration: 0.1 }}
        className="inline-block ml-1 text-orange-400"
      >
        |
      </motion.span>
    </span>
  )
}
