'use client'

import { motion } from 'framer-motion'
import { WaveformAnimation } from './WaveformAnimation'

export function AIMoment() {
  return (
    <section id="ai-moment" className="py-20 px-4">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
              From voice to visual in{' '}
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                &lt; 100ms
              </span>
            </h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              ParLeap listens to the microphone stream, matches it against your active setlist, and fires the correct slide trigger. No manual intervention required.
            </p>
          </motion.div>

          {/* Right: Animation */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <WaveformAnimation />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
