'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ThumbsUp } from 'lucide-react'

const contentSubset = [
  { song: 'Amazing Grace', lyric: 'Amazing grace how sweet the sound / That saved a wretch like me', artist: 'John Newton' },
  { song: 'How Great Thou Art', lyric: 'Then sings my soul, my Savior God to Thee / How great Thou art, how great Thou art', artist: 'Carl Boberg' },
  { song: 'Oceans', lyric: 'Spirit lead me where my trust is without borders / Let me walk upon the waters', artist: 'Hillsong UNITED' },
  { song: 'What a Beautiful Name', lyric: 'What a beautiful Name it is / Nothing compares to this', artist: 'Hillsong Worship' },
  { song: 'Reckless Love', lyric: 'Oh, the overwhelming, never-ending, reckless love of God', artist: 'Cory Asbury' },
  { song: 'The Blessing', lyric: 'The Lord bless you and keep you / Make His face shine upon you', artist: 'Kari Jobe & Cody Carnes' },
  { song: 'So Will I', lyric: 'God of creation, there at the start / Before the beginning of time', artist: 'Hillsong UNITED' },
]

type StickerType = 'like' | 'amen'

interface Sticker {
  id: string
  x: number
  y: number
  rotation: number
  type: StickerType
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function SlapLyrics() {
  const [stickers, setStickers] = useState<Sticker[]>([])

  const addSticker = useCallback((type: StickerType) => {
    const sticker: Sticker = {
      id: crypto.randomUUID(),
      x: randomInRange(10, 90),
      y: randomInRange(10, 90),
      rotation: randomInRange(-12, 12),
      type,
    }
    setStickers((prev) => [...prev, sticker])
  }, [])

  return (
    <section className="py-24 px-4 relative min-h-[520px]">
      <div className="container mx-auto relative">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-12"
        >
          Ready for any song
        </motion.h2>

        {/* Sticker layer (behind lyrics, non-interactive) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none min-h-[380px]"
          aria-hidden="true"
        >
          {stickers.map((s) => (
            <div
              key={s.id}
              className="absolute text-xs font-medium whitespace-nowrap px-2 py-1 rounded-full bg-white/10 border border-white/20 text-white/90"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                transform: 'translate(-50%, -50%) rotate(' + s.rotation + 'deg)',
              }}
            >
              {s.type === 'like' ? (
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Like
                </span>
              ) : (
                'Amen'
              )}
            </div>
          ))}
        </div>

        {/* Lyric list (on top, interactive) */}
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          {contentSubset.map((item, index) => (
            <motion.div
              key={`${item.song}-${index}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="flex flex-wrap items-center gap-3 py-2"
            >
              <p className="text-white/95 text-lg leading-relaxed flex-1 min-w-0">
                {item.lyric}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => addSticker('like')}
                  className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
                  aria-label="Like this lyric"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Like
                </button>
                <button
                  type="button"
                  onClick={() => addSticker('amen')}
                  className="text-sm text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
                  aria-label="Amen"
                >
                  Amen
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
