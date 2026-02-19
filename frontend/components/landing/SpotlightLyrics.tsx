'use client'

import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

const SPOTLIGHT_RADIUS = 150

const spotlightContent = [
  { lyric: 'Amazing grace how sweet the sound / That saved a wretch like me', song: 'Amazing Grace' },
  { lyric: 'Then sings my soul, my Savior God to Thee / How great Thou art, how great Thou art', song: 'How Great Thou Art' },
  { lyric: 'Spirit lead me where my trust is without borders / Let me walk upon the waters', song: 'Oceans' },
  { lyric: 'What a beautiful Name it is / Nothing compares to this / What a beautiful Name it is', song: 'What a Beautiful Name' },
  { lyric: 'Oh, the overwhelming, never-ending, reckless love of God / Oh, it chases me down', song: 'Reckless Love' },
  { lyric: 'Bless the Lord, O my soul / O my soul / Worship His holy name', song: '10,000 Reasons' },
  { lyric: 'You turn graves into gardens / You turn bones into armies / You turn seas into highways', song: 'Graves Into Gardens' },
  { lyric: 'The Lord bless you and keep you / Make His face shine upon you / And be gracious to you', song: 'The Blessing' },
]

const contentWrapperClass = 'max-w-3xl mx-auto text-center space-y-8 select-none'

function LyricBlock({ dim = false }: { dim?: boolean }) {
  return (
    <div
      className={`${contentWrapperClass} ${
        dim ? 'text-white/40' : 'text-white'
      }`}
    >
      {spotlightContent.map((item, index) => (
        <p
          key={`${item.song}-${index}`}
          className="text-xl lg:text-2xl font-medium leading-relaxed"
        >
          {item.lyric}
        </p>
      ))}
    </div>
  )
}

export function SpotlightLyrics() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setSpot({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const handleMouseEnter = useCallback(() => setIsHovering(true), [])
  const handleMouseLeave = useCallback(() => setIsHovering(false), [])

  const maskStyle = isHovering
    ? {
        maskImage: `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${spot.x}px ${spot.y}px, black 0%, transparent 100%)`,
        WebkitMaskImage: `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${spot.x}px ${spot.y}px, black 0%, transparent 100%)`,
      }
    : { maskImage: 'none', WebkitMaskImage: 'none' }

  return (
    <section className="py-24 px-4">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-16"
        >
          Ready for any song
        </motion.h2>

        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative min-h-[420px] rounded-2xl py-12 px-6 cursor-default"
        >
          {/* Layer 1: dim text (always visible) */}
          <LyricBlock dim />

          {/* Layer 2: bright text with radial spotlight mask — same layout as layer 1 */}
          <div
            className="absolute inset-0 py-12 px-6 pointer-events-none"
            style={maskStyle}
          >
            <LyricBlock />
          </div>
        </div>
      </div>
    </section>
  )
}
