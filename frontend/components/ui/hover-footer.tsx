'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

type TextHoverEffectProps = {
  text: string
  duration?: number
  className?: string
}

export function TextHoverEffect({ text, duration = 0.18, className }: TextHoverEffectProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [maskPosition, setMaskPosition] = useState({ cx: '50%', cy: '50%' })

  useEffect(() => {
    if (!svgRef.current) return
    const svgRect = svgRef.current.getBoundingClientRect()
    if (svgRect.width === 0 || svgRect.height === 0) return

    const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100
    const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100

    setMaskPosition({
      cx: `${cxPercentage}%`,
      cy: `${cyPercentage}%`,
    })
  }, [cursor])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 320 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(event) => setCursor({ x: event.clientX, y: event.clientY })}
      className={cn('select-none uppercase cursor-pointer', className)}
    >
      <defs>
        <linearGradient id="parleapTextGradient" gradientUnits="userSpaceOnUse" cx="50%" cy="50%" r="30%">
          {hovered && (
            <>
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="45%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#60a5fa" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="parleapRevealMask"
          gradientUnits="userSpaceOnUse"
          r={hovered ? '34%' : '16%'}
          initial={{ cx: '50%', cy: '50%' }}
          animate={maskPosition}
          transition={{ duration, ease: 'easeOut' }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="parleapTextMask">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#parleapRevealMask)" />
        </mask>
      </defs>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.5"
        className="fill-transparent stroke-white/35 text-8xl font-black"
        style={{ opacity: hovered ? 0.9 : 0 }}
      >
        {text}
      </text>

      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.5"
        className="fill-transparent stroke-[#60a5fa] text-8xl font-black"
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{ strokeDashoffset: 0, strokeDasharray: 1000 }}
        transition={{ duration: 2.6, ease: 'easeInOut' }}
      >
        {text}
      </motion.text>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="url(#parleapTextGradient)"
        strokeWidth="0.55"
        mask="url(#parleapTextMask)"
        className="fill-transparent text-8xl font-black"
        style={{ filter: hovered ? 'drop-shadow(0 0 18px rgba(59, 130, 246, 0.75))' : 'none' }}
      >
        {text}
      </text>
    </svg>
  )
}

export function FooterBackgroundGradient() {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        background:
          'radial-gradient(130% 120% at 50% 15%, rgba(3, 7, 18, 0.78) 45%, rgba(30, 64, 175, 0.16) 78%, rgba(245, 158, 11, 0.12) 100%)',
      }}
    />
  )
}
