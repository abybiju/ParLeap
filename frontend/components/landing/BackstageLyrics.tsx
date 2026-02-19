'use client'

import { useRef, useCallback } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'

const TILT_MAX = 6
const SPRING = { type: 'spring' as const, stiffness: 150, damping: 20 }

const posterLyrics = [
  'Amazing grace how sweet the sound',
  'Then sings my soul, my Savior God to Thee',
  'Spirit lead me where my trust is without borders',
  'What a beautiful Name it is',
  'Oh, the overwhelming, never-ending, reckless love of God',
  'The Lord bless you and keep you',
]

const oldStickers = [
  { label: 'Amazing Grace', top: '8%', left: '5%', rotation: -8 },
  { label: 'WORSHIP', top: '12%', right: '8%', left: undefined, rotation: 4 },
  { label: 'How Great Thou Art', bottom: '15%', left: '10%', top: undefined, rotation: -5 },
  { label: 'Revival', top: '70%', right: '6%', left: undefined, rotation: 6 },
  { label: 'Hymns', top: '75%', left: '7%', rotation: -4 },
]

const newStickers = [
  { label: 'Like', top: '10%', left: '12%' },
  { label: 'Amen', top: '15%', right: '15%', left: undefined },
  { label: 'Worship', bottom: '20%', left: '18%', top: undefined },
  { label: 'Yes', bottom: '25%', right: '12%', top: undefined },
  { label: 'One flow', top: '80%', right: '20%', left: undefined },
]

export function BackstageLyrics() {
  const wallRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [TILT_MAX, -TILT_MAX])
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-TILT_MAX, TILT_MAX])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!wallRef.current) return
      const rect = wallRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const x = (e.clientX - centerX) / rect.width
      const y = (e.clientY - centerY) / rect.height
      mouseX.set(x)
      mouseY.set(y)
    },
    [mouseX, mouseY]
  )

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0)
    mouseY.set(0)
  }, [mouseX, mouseY])

  return (
    <section className="py-24 px-4 relative">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-12"
        >
          Ready for any song
        </motion.h2>

        <div
          ref={wallRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative max-w-4xl mx-auto min-h-[480px] rounded-2xl overflow-hidden"
        >
          {/* Layer 1: Wall texture */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: `
                radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.25) 100%),
                repeating-linear-gradient(90deg, transparent 0, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px),
                repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px),
                linear-gradient(180deg, #1c1917 0%, #2a2520 50%, #1f1c19 100%)
              `,
            }}
            aria-hidden="true"
          />

          {/* Layer 2: Old stickers (faded, torn) */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" aria-hidden="true">
            {oldStickers.map((s, i) => (
              <div
                key={s.label + i}
                className="absolute px-2 py-1 text-xs font-medium uppercase tracking-wider text-stone-500 opacity-60 border border-stone-600/50 rounded-sm"
                style={{
                  top: s.top,
                  bottom: s.bottom,
                  left: s.left,
                  right: s.right,
                  transform: `rotate(${s.rotation}deg)`,
                  clipPath: 'polygon(0 0, 100% 0, 100% 85%, 95% 100%, 0 100%, 0 90%)',
                }}
              >
                {s.label}
              </div>
            ))}
          </div>

          {/* Layer 3: Poster lyrics */}
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="max-w-2xl mx-auto text-center px-6 py-8">
              {posterLyrics.map((line, i) => (
                <p
                  key={i}
                  className="text-xl lg:text-2xl xl:text-3xl font-bold text-white/95 leading-relaxed"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Layer 4: New stickers (3D tilt) */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-20" aria-hidden="true">
            {newStickers.map((s, i) => (
              <motion.div
                key={s.label + i}
                className="absolute px-3 py-1.5 text-xs font-semibold text-white/90 bg-white/15 border border-white/25 rounded-lg backdrop-blur-sm"
                style={{
                  top: s.top,
                  bottom: s.bottom,
                  left: s.left,
                  right: s.right,
                  rotateX,
                  rotateY,
                  transformStyle: 'preserve-3d',
                  transformPerspective: 1000,
                }}
                transition={SPRING}
              >
                {s.label}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
