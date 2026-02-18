'use client'

import { motion } from 'framer-motion'
import { ConfidenceGraph } from './ConfidenceGraph'
import { Zap, MousePointerClick } from 'lucide-react'

export function FeatureGrid() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-16"
        >
          Built for the chaos of live events
        </motion.h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1: Large Box - Real-Time Confidence Engine */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card-hover p-8 md:col-span-2 lg:col-span-2 space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white">Real-Time Confidence Engine</h3>
            </div>
            <p className="text-gray-300 leading-relaxed text-lg">
              Our AI calculates match confidence every 50ms. If it&apos;s not sure, it asks you. If it is sure, it just works.
            </p>
            <ConfidenceGraph />
          </motion.div>

          {/* Feature 2: Zero-Latency Sync */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="glass-card-hover p-8 space-y-4"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <Zap className="h-6 w-6 text-orange-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white">Zero-Latency Sync</h3>
            <p className="text-gray-300 leading-relaxed">
              What you see on the operator screen is what they see on the big screen. Instantly.
            </p>
          </motion.div>

          {/* Feature 3: Panic Button */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-card-hover p-8 space-y-4"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <MousePointerClick className="h-6 w-6 text-orange-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white">Panic Button</h3>
            <p className="text-gray-300 leading-relaxed">
              Things go wrong? Click any lyric to instantly override the AI and take control.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
