'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'
import Link from 'next/link'
import { TypewriterText } from '@/components/ui/TypewriterText'
import { SplineViewer } from '@/components/SplineViewer'

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center px-4 py-20 pt-48 relative overflow-hidden">
      {/* Spacer for fixed header */}
      <div className="absolute top-0 left-0 right-0 h-24" />
      {/* Spline Background Layer - Mouse Follow Effect (only in hero section) */}
      <div className="absolute inset-0 z-0">
        <SplineViewer
          url="https://prod.spline.design/kzdIEyudaZu1oiNQ/scene.splinecode"
          className="w-full h-full"
        />
        {/* Old Brand Gradient: Light beige/off-white at top transitioning to dark reddish-black */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5F5F0] via-[#8B5A5A] to-[#2A1A1A] pointer-events-none" />
        {/* Bottom fade: Smoothly transitions to the next section */}
        <div className="absolute bottom-0 left-0 right-0 h-80 bg-gradient-to-b from-transparent via-[#2A1A1A]/60 to-[#1A0A0A] pointer-events-none" />
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

        {/* Right: Empty - Spline background shows through */}
        <div className="hidden lg:block"></div>
      </div>
    </section>
  )
}
