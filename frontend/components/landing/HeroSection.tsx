'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { TypewriterText } from '@/components/ui/TypewriterText'
import { SplineViewer } from '@/components/SplineViewer'

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center px-4 py-20 pt-48 relative overflow-hidden">
      {/* Spacer for fixed header */}
      <div className="absolute top-0 left-0 right-0 h-24" />
      {/* Spline Background Layer - Robot Design (only in hero section) */}
      <div className="absolute inset-0 z-0">
        <SplineViewer
          url="https://prod.spline.design/OEL0IKUCdPbQ7Xyx/scene.splinecode"
          className="w-full h-full"
        />
        {/* Gradient Overlay: Lighter at top to merge with header, darker at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/90 pointer-events-none" />
        {/* Bottom fade: Smoothly transitions to the next section */}
        <div className="absolute bottom-0 left-0 right-0 h-80 bg-gradient-to-b from-transparent via-black/40 to-black pointer-events-none" />
      </div>

      <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center mt-8 relative z-10">
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
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative hidden lg:block perspective-1000"
        >
          <div 
            className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl transition-all duration-700 hover:scale-[1.02]"
            style={{
              transform: 'rotateY(-10deg) rotateX(5deg)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1.02)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'rotateY(-10deg) rotateX(5deg)'
            }}
          >
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-black flex items-center justify-center group relative">
              <Image
                src="/assets/archive/ui-mockup-placeholder.png"
                alt="ParLeap UI Mockup"
                width={800}
                height={600}
                className="w-full h-full object-contain group-hover:opacity-100 opacity-90 transition-opacity"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-red-500/10 pointer-events-none" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
