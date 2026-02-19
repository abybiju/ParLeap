'use client'

import { useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

const contentSubset = [
  { song: 'Amazing Grace', lyric: 'Amazing grace how sweet the sound / That saved a wretch like me', artist: 'John Newton' },
  { song: 'How Great Thou Art', lyric: 'Then sings my soul, my Savior God to Thee / How great Thou art, how great Thou art', artist: 'Carl Boberg' },
  { song: 'Oceans', lyric: 'Spirit lead me where my trust is without borders / Let me walk upon the waters', artist: 'Hillsong UNITED' },
  { song: 'What a Beautiful Name', lyric: 'What a beautiful Name it is / Nothing compares to this / What a beautiful Name it is', artist: 'Hillsong Worship' },
  { song: 'Reckless Love', lyric: 'Oh, the overwhelming, never-ending, reckless love of God / Oh, it chases me down', artist: 'Cory Asbury' },
  { song: 'Graves Into Gardens', lyric: 'You turn graves into gardens / You turn bones into armies / You turn seas into highways', artist: 'Elevation Worship' },
  { song: 'The Blessing', lyric: 'The Lord bless you and keep you / Make His face shine upon you / And be gracious to you', artist: 'Kari Jobe & Cody Carnes' },
  { song: 'So Will I', lyric: 'God of creation, there at the start / Before the beginning of time / You were on the throne', artist: 'Hillsong UNITED' },
]

export function HolographicLyrics() {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--x', String(e.clientX - rect.left))
    el.style.setProperty('--y', String(e.clientY - rect.top))
  }, [])

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
          className="relative max-w-4xl mx-auto min-h-[480px] rounded-2xl py-12 px-8 cursor-default"
          style={
            {
              '--x': '-999',
              '--y': '-999',
            } as React.CSSProperties
          }
        >
          {/* Layer 1 (back): Lyric text with soft glow */}
          <div
            className="relative z-0 max-w-3xl mx-auto text-center space-y-8 select-none"
            style={{
              textShadow: '0 0 20px rgba(255,255,255,0.15), 0 0 40px rgba(255,140,0,0.08)',
            }}
          >
            {contentSubset.map((item, index) => (
              <p
                key={`${item.song}-${index}`}
                className="text-xl lg:text-2xl font-medium leading-relaxed text-white/95"
              >
                {item.lyric}
              </p>
            ))}
          </div>

          {/* Layer 2 (glass): Dark glass panel */}
          <div
            className="absolute inset-0 rounded-2xl backdrop-blur-xl bg-black/20 border border-white/10 pointer-events-none z-10"
            aria-hidden="true"
          />

          {/* Layer 3 (stickers): Iridescent foil overlay with mouse-follow shine */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none z-20 overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0 rounded-2xl opacity-40"
              style={{
                background: `linear-gradient(135deg, rgb(var(--brand-orange-start) / 0.25), rgba(120, 50, 255, 0.2), rgba(0, 200, 255, 0.15), rgba(255, 100, 180, 0.2))`,
              }}
            />
            <div
              className="absolute inset-0 rounded-2xl opacity-70"
              style={{
                background: `radial-gradient(circle 120px at var(--x)px var(--y)px, rgba(255,255,255,0.5) 0%, rgba(255,200,150,0.2) 40%, transparent 70%)`,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
