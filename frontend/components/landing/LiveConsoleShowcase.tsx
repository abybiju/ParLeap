'use client'

import { useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

const TILT_MAX = 3
const SPRING = { type: 'spring' as const, stiffness: 80, damping: 28 }

export function LiveConsoleShowcase() {
  const [modalOpen, setModalOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [TILT_MAX, -TILT_MAX])
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-TILT_MAX, TILT_MAX])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return
      const rect = cardRef.current.getBoundingClientRect()
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
    <section className="py-20 px-4 relative">
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            See ParLeap in action
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Your command center, live. Operator view, setlist, and real-time transcript in one place.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="flex justify-center"
          style={{ perspective: 1000 }}
        >
          <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => setModalOpen(true)}
            tabIndex={0}
            role="button"
            aria-label="View larger screenshot of ParLeap operator console"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setModalOpen(true)
              }
            }}
            style={{
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
              transformPerspective: 1000,
            }}
            transition={SPRING}
            whileHover={{
              scale: 1.01,
              transition: { duration: 0.25 },
            }}
            className="glass-card cursor-pointer rounded-xl overflow-hidden border border-white/10 shadow-xl hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20 transition-shadow duration-300 max-w-4xl w-full"
          >
            <div className="relative aspect-[16/10] w-full" style={{ transform: 'translateZ(0)' }}>
              <Image
                src="/landing/operator-console.png"
                alt="ParLeap operator console showing live session, setlist, and real-time transcription"
                fill
                className="object-contain"
                sizes="(max-width: 896px) 100vw, 896px"
                priority={false}
              />
            </div>
          </motion.div>
        </motion.div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden bg-black/90 border-white/10 p-0">
            <DialogTitle className="sr-only">
              ParLeap operator console screenshot
            </DialogTitle>
            <div className="relative w-full aspect-[16/10] max-h-[85vh]">
              <Image
                src="/landing/operator-console.png"
                alt="ParLeap operator console showing live session, setlist, and real-time transcription"
                fill
                className="object-contain"
                sizes="95vw"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
