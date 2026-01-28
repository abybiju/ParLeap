'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { TypewriterText } from '@/components/ui/TypewriterText'

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center px-4 py-20 pt-48">
      <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center mt-8">
        {/* Left: Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
            You speak,<br />
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
              It flows.
            </span>
          </h1>
          
          <div className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-xl">
            <TypewriterText
              text="AI-powered auto-follow for live performances. Stop tapping slides. Start leading."
              delay={300}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="gradient-brand text-white hover:opacity-90 px-8 py-6 text-lg font-semibold"
              >
                Start Performing Free
              </Button>
            </Link>
            
            <Button
              size="lg"
              variant="outline"
              className="glass-card-hover text-white border-white/20 px-8 py-6 text-lg font-semibold"
              onClick={() => {
                document.getElementById('ai-moment')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <Play className="mr-2 h-5 w-5" />
              See the Magic
            </Button>
          </div>
        </motion.div>

        {/* Right: 3D Floating Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex justify-center lg:justify-end"
        >
          <motion.div
            className="relative"
            style={{
              perspective: '2000px',
            }}
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <motion.div
              className="rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-orange-500/20"
              style={{
                transform: 'rotateX(5deg) rotateY(-5deg)',
                transformStyle: 'preserve-3d',
              }}
              whileHover={{
                scale: 1.02,
                transition: { duration: 0.3 },
              }}
            >
              <Image
                src="/live-page-mockup.png"
                alt="ParLeap Live Page"
                width={800}
                height={600}
                className="rounded-xl w-full h-auto max-w-full"
                priority
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
