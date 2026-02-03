'use client'

import { motion } from 'framer-motion'

const features = [
  'Offline Capable',
  'CCLI Integration',
  'OBS Overlay Support',
  'Multi-User Collaboration',
  'MIDI Control',
  'Dark Mode First',
]

export function FeatureMarquee() {
  // Calculate the width of one set of features + separators
  const singleSetWidth = features.length * 200 + (features.length - 1) * 32 // Approximate width

  return (
    <section className="py-12 px-4 overflow-hidden bg-[#050505]">
      <div className="container mx-auto">
        <motion.div
          className="flex gap-8"
          animate={{
            x: [0, -singleSetWidth],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 20,
              ease: 'linear',
            },
          }}
        >
          {/* Render multiple times for seamless loop */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-8 items-center">
              {features.map((feature, index) => (
                <div key={`${i}-${index}`} className="flex items-center gap-8">
                  <span className="text-gray-400 text-lg whitespace-nowrap font-medium">
                    {feature}
                  </span>
                  {index < features.length - 1 && (
                    <span className="text-gray-600 text-lg">•</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
