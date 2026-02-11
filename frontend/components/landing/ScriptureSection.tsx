'use client'

import { motion } from 'framer-motion'
import { BookOpen, Mic, LayoutList } from 'lucide-react'

const items = [
  {
    icon: BookOpen,
    title: 'Verse display',
    description: 'Display verses on the big screen. Add references to your setlist and follow along.',
  },
  {
    icon: Mic,
    title: 'Reference follow',
    description: 'AI listens and keeps the verse in sync. KJV and ESV supported.',
  },
  {
    icon: LayoutList,
    title: 'One flow',
    description: 'Songs and scripture in the same setlist. One operator view, one flow.',
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
          {items.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-card-hover p-8 space-y-4"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
                <p className="text-gray-300 leading-relaxed">{item.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
