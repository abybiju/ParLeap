'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const words: { title: string; snippet: string; size: 'sm' | 'md' | 'lg' }[] = [
  { title: 'Amazing Grace', snippet: 'That saved a wretch like me', size: 'lg' },
  { title: 'How Great Thou Art', snippet: 'Then sings my soul, my Savior God to Thee', size: 'md' },
  { title: 'Oceans', snippet: 'Spirit lead me where my trust is without borders', size: 'md' },
  { title: 'What a Beautiful Name', snippet: 'Nothing compares to this', size: 'lg' },
  { title: 'Reckless Love', snippet: 'Oh, it chases me down', size: 'md' },
  { title: 'Way Maker', snippet: 'You are here, moving in our midst', size: 'sm' },
  { title: '10,000 Reasons', snippet: 'Bless the Lord, O my soul', size: 'md' },
  { title: 'Goodness of God', snippet: 'I love Your voice', size: 'sm' },
  { title: 'Build My Life', snippet: 'Holy, there is no one like You', size: 'sm' },
  { title: 'Cornerstone', snippet: 'My hope is built on nothing less', size: 'sm' },
  { title: 'No Longer Slaves', snippet: 'You surround me with a song', size: 'md' },
  { title: 'King of Kings', snippet: 'Till from heaven You came running', size: 'md' },
  { title: 'Raise a Hallelujah', snippet: 'Louder than the unbelief', size: 'sm' },
  { title: 'Graves Into Gardens', snippet: 'You turn bones into armies', size: 'md' },
  { title: 'The Blessing', snippet: 'Make His face shine upon you', size: 'lg' },
  { title: 'Living Hope', snippet: 'How great the chasm that lay between us', size: 'sm' },
  { title: 'So Will I', snippet: 'God of creation, there at the start', size: 'md' },
  { title: 'It Is Well', snippet: 'When peace like a river attendeth my way', size: 'sm' },
  { title: 'In Christ Alone', snippet: 'He is my light, my strength, my song', size: 'md' },
  { title: 'Great Is Thy Faithfulness', snippet: 'There is no shadow of turning with Thee', size: 'sm' },
  { title: 'Blessed Assurance', snippet: 'Oh, what a foretaste of glory divine', size: 'sm' },
  { title: 'Be Thou My Vision', snippet: 'O Lord of my heart', size: 'sm' },
  { title: 'Come Thou Fount', snippet: 'Tune my heart to sing Thy grace', size: 'sm' },
  { title: 'Great Are You Lord', snippet: 'So we pour out our praise', size: 'sm' },
]

const sizeClasses = {
  sm: 'text-sm lg:text-base',
  md: 'text-base lg:text-lg',
  lg: 'text-lg lg:text-xl xl:text-2xl',
}

const rotationClasses = ['-rotate-[2deg]', 'rotate-[1deg]', 'rotate-[2deg]', '-rotate-[1deg]', ''] as const
function rotationClass(i: number): string {
  return rotationClasses[i % rotationClasses.length]
}

export function LyricWordCloud() {
  const [activeSnippet, setActiveSnippet] = useState<string | null>(null)

  return (
    <section className="py-24 px-4">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-12"
        >
          Ready for any song
        </motion.h2>

        <div className="relative max-w-4xl mx-auto min-h-[320px]">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 px-4 py-8">
            {words.map((item, index) => (
              <motion.button
                key={item.title + index}
                type="button"
                onMouseEnter={() => setActiveSnippet(item.snippet)}
                onMouseLeave={() => setActiveSnippet(null)}
                onClick={() => setActiveSnippet(activeSnippet === item.snippet ? null : item.snippet)}
                className={`font-semibold text-white/80 hover:text-white transition-colors cursor-pointer rounded px-1 ${sizeClasses[item.size]} ${rotationClass(index)}`}
                whileHover={{
                  scale: 1.12,
                  transition: { duration: 0.2 },
                }}
              >
                <motion.span
                  className="block"
                  whileHover={{
                    textShadow: '0 0 20px rgba(255,255,255,0.4), 0 0 40px rgba(255,140,0,0.2)',
                  }}
                >
                  {item.title}
                </motion.span>
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeSnippet && (
              <motion.div
                key={activeSnippet}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-center"
              >
                <p className="text-sm lg:text-base text-white/90 italic">&ldquo;{activeSnippet}&rdquo;</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
