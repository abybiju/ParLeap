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
  {
    quote: "We've tried everything, and ParLeap is by far the most reliable. The zero-latency sync is perfect for our multi-campus setup.",
    author: "James Thompson",
    role: "Tech Director at City Church",
  },
  {
    quote: "The panic button saved us multiple times when the band went off-script. Absolute lifesaver.",
    author: "Lisa Park",
    role: "Worship Leader at Elevation",
  },
  {
    quote: "Our volunteers love how easy it is to use. The cloud sync means we can prepare at home and present at the venue seamlessly.",
    author: "Mark Williams",
    role: "Production Manager",
  },
  {
    quote: "ParLeap's AI is so accurate, we rarely need to intervene. It's like having a perfect operator who never gets tired.",
    author: "Rachel Kim",
    role: "Worship Director at Grace Community",
  },
  {
    quote: "The offline capability is crucial for us. We can run entire services without internet, and it still works flawlessly.",
    author: "Tom Anderson",
    role: "Technical Director",
  },
  {
    quote: "I love how ParLeap handles key changes and spontaneous moments. It adapts in real-time without missing a beat.",
    author: "Jessica Martinez",
    role: "Worship Leader",
  },
  {
    quote: "The OBS overlay support is perfect for our livestream. Everything syncs automatically - it's magical.",
    author: "Chris Brown",
    role: "Media Director",
  },
  {
    quote: "ParLeap has become essential to our worship team. We can't imagine going back to manual slide management.",
    author: "Amanda Taylor",
    role: "Worship Coordinator",
  },
]

// Split into 3 columns
const column1 = testimonials.slice(0, 4)
const column2 = testimonials.slice(4, 8)
const column3 = testimonials.slice(8, 12)

export function TestimonialWall() {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-16"
        >
          Trusted by teams who value flow.
        </motion.h2>

        <div
          className="relative h-[700px] overflow-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
          }}
        >
          {/* Column 1: Scroll Up (Slow) */}
          <div className="relative h-full overflow-hidden group">
            <div className="animate-scroll-up group-pause-on-hover flex flex-col gap-6">
              {/* First render */}
              {column1.map((testimonial, index) => (
                <div
                  key={`col1-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-300 opacity-80 scale-100 hover:scale-110 hover:z-50 hover:opacity-100 hover:border-[#FF8C42]/50 hover:shadow-[0_0_50px_-10px_rgba(255,140,66,0.3)] hover:bg-[#0A0A0A] relative"
                >
                  <blockquote className="text-lg text-white leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <cite className="text-gray-400 text-sm not-italic">
                    — {testimonial.author}, {testimonial.role}
                  </cite>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {column1.map((testimonial, index) => (
                <div
                  key={`col1-dup-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-300 opacity-80 scale-100 hover:scale-110 hover:z-50 hover:opacity-100 hover:border-[#FF8C42]/50 hover:shadow-[0_0_50px_-10px_rgba(255,140,66,0.3)] hover:bg-[#0A0A0A] relative"
                >
                  <blockquote className="text-lg text-white leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <cite className="text-gray-400 text-sm not-italic">
                    — {testimonial.author}, {testimonial.role}
                  </cite>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Scroll Down (Medium) */}
          <div className="relative h-full overflow-hidden group">
            <div className="animate-scroll-down group-pause-on-hover flex flex-col gap-6">
              {/* First render */}
              {column2.map((testimonial, index) => (
                <div
                  key={`col2-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-300 opacity-80 scale-100 hover:scale-110 hover:z-50 hover:opacity-100 hover:border-[#FF8C42]/50 hover:shadow-[0_0_50px_-10px_rgba(255,140,66,0.3)] hover:bg-[#0A0A0A] relative"
                >
                  <blockquote className="text-lg text-white leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <cite className="text-gray-400 text-sm not-italic">
                    — {testimonial.author}, {testimonial.role}
                  </cite>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {column2.map((testimonial, index) => (
                <div
                  key={`col2-dup-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-300 opacity-80 scale-100 hover:scale-110 hover:z-50 hover:opacity-100 hover:border-[#FF8C42]/50 hover:shadow-[0_0_50px_-10px_rgba(255,140,66,0.3)] hover:bg-[#0A0A0A] relative"
                >
                  <blockquote className="text-lg text-white leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <cite className="text-gray-400 text-sm not-italic">
                    — {testimonial.author}, {testimonial.role}
                  </cite>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Scroll Up (Slow) */}
          <div className="relative h-full overflow-hidden group">
            <div className="animate-scroll-up group-pause-on-hover flex flex-col gap-6">
              {/* First render */}
              {column3.map((testimonial, index) => (
                <div
                  key={`col3-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-300 opacity-80 scale-100 hover:scale-110 hover:z-50 hover:opacity-100 hover:border-[#FF8C42]/50 hover:shadow-[0_0_50px_-10px_rgba(255,140,66,0.3)] hover:bg-[#0A0A0A] relative"
                >
                  <blockquote className="text-lg text-white leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <cite className="text-gray-400 text-sm not-italic">
                    — {testimonial.author}, {testimonial.role}
                  </cite>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {column3.map((testimonial, index) => (
                <div
                  key={`col3-dup-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-300 opacity-80 scale-100 hover:scale-110 hover:z-50 hover:opacity-100 hover:border-[#FF8C42]/50 hover:shadow-[0_0_50px_-10px_rgba(255,140,66,0.3)] hover:bg-[#0A0A0A] relative"
                >
                  <blockquote className="text-lg text-white leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <cite className="text-gray-400 text-sm not-italic">
                    — {testimonial.author}, {testimonial.role}
                  </cite>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
