'use client'

import { motion } from 'framer-motion'
import { Mic, Shield, Cloud } from 'lucide-react'

const problems = [
  {
    icon: Mic,
    title: 'AI Auto-Follow',
    description: 'Listens to your voice and changes slides automatically.',
  },
  {
    icon: Shield,
    title: 'Panic Mode',
    description: 'Instant manual override when the band goes off-script.',
  },
  {
    icon: Cloud,
    title: 'Cloud Sync',
    description: 'Edit setlists at home, present at the venue.',
  },
]

export function ProblemFraming() {
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
          Manual slides break the flow.
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((problem, index) => {
            const Icon = problem.icon
            return (
              <motion.div
                key={problem.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-card-hover p-8 space-y-4"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white">{problem.title}</h3>
                <p className="text-gray-300 leading-relaxed">{problem.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
