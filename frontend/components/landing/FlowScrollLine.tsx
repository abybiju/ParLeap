'use client'

import { useRef } from 'react'
import type { MotionValue } from 'framer-motion'
import { motion, useScroll, useTransform } from 'framer-motion'

// From CCLI Top 100 US — top/latest worship songs (3 lines max, 4 per row)
const items = [
  'Holy Forever',
  'Goodness Of God',
  'Great Are You Lord',
  'Gratitude',
  'Build My Life',
  'Trust In God',
  'Worthy Of It All',
  'Who Else',
  'How Great Is Our God',
  'Firm Foundation',
  'What A Beautiful Name',
  'King Of Kings',
]

function ScrollLabel({
  title,
  index,
  scrollYProgress,
}: {
  title: string
  index: number
  scrollYProgress: MotionValue<number>
}) {
  const start = 0.15 + (index / items.length) * 0.48
  const end = start + 0.12
  const opacity = useTransform(scrollYProgress, [start, end], [0, 1])
  return (
    <motion.div className="text-center" style={{ opacity }}>
      <span className="text-sm lg:text-base font-medium text-white/90">{title}</span>
    </motion.div>
  )
}

export function FlowScrollLine() {
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const pathProgress = useTransform(scrollYProgress, [0, 0.5], [0, 1])
  const pathOffset = useTransform(pathProgress, (v) => 1 - v)

  return (
    <section ref={sectionRef} className="py-12 lg:py-16 px-4 relative">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-2"
        >
          Ready for any song
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center text-white/60 text-sm lg:text-base mb-4"
        >
          CCLI Top 100 US
        </motion.p>

        <div className="relative max-w-4xl mx-auto flex flex-col justify-center">
          {/* SVG line that "draws" on scroll */}
          <div className="relative w-full h-2 flex items-center justify-center">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 800 8"
              fill="none"
              preserveAspectRatio="none"
            >
              <motion.path
                d="M 0 4 Q 200 0 400 4 T 800 4"
                stroke="rgba(255,140,0,0.6)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: pathOffset,
                }}
              />
            </svg>
          </div>

          {/* Labels — 3 lines max (4 per row) */}
          <div className="relative w-full mt-5 grid grid-cols-4 gap-3 px-2 max-w-3xl mx-auto">
            {items.map((title, i) => (
              <ScrollLabel
                key={title}
                title={title}
                index={i}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
