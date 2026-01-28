'use client'

import { motion } from 'framer-motion'

const testimonials = [
  {
    quote: "I used to stress about the lyrics operator falling asleep. Now ParLeap handles it, and I just focus on leading.",
    author: "Sarah J.",
    role: "Worship Director",
  },
  {
    quote: "The AI auto-follow feature is a game-changer. Our team can focus on worship instead of managing slides.",
    author: "Pastor Mike",
    role: "Lead Pastor",
  },
  {
    quote: "ParLeap transformed our worship services. No more missed cues or awkward pauses. It just works.",
    author: "Emily Chen",
    role: "Music Director",
  },
  {
    quote: "Best app ever for worship teams. The confidence engine is incredible - it knows when to ask and when to act.",
    author: "David Rodriguez",
    role: "Worship Leader",
  },
]

export function SocialProof() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-12"
        >
          Trusted by teams who value flow.
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="glass-card p-8 lg:p-10 transition-all duration-500 ease-out cursor-default hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_80px_-10px_rgba(255,140,66,0.3)] hover:border-[#FF8C42]/50 will-change-transform"
            >
              <blockquote className="text-xl lg:text-2xl text-white leading-relaxed mb-6">
                "{testimonial.quote}"
              </blockquote>
              <cite className="text-gray-400 text-lg not-italic">
                — {testimonial.author}, {testimonial.role}
              </cite>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
