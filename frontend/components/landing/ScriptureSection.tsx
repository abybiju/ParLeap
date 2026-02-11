'use client'

import { motion } from 'framer-motion'

const items = [
  {
    title: 'Verse display',
    line: 'Display verses on the big screen. Add references and follow along.',
    footer: 'Verse 1',
  },
  {
    title: 'Reference follow',
    line: 'AI listens and keeps the verse in sync. KJV and ESV supported.',
    footer: 'KJV',
  },
  {
    title: 'One flow',
    line: 'Songs and scripture in the same setlist. One operator view.',
    footer: 'One setlist',
  },
]

export function ScriptureSection() {
  return (
    <section className="py-20 px-4 relative">
      <div className="container mx-auto relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-16"
        >
          And scripture too.
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card p-8 max-w-md"
            >
              <h4 className="text-xl font-semibold text-white mb-4">{item.title}</h4>
              <p className="text-2xl text-white leading-relaxed">{item.line}</p>
              <div className="mt-4 text-sm text-gray-400">{item.footer}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
