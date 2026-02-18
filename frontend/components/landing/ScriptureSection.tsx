'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Mic, LayoutList } from 'lucide-react'

const BIBLE_API_VERSE = 'https://bible-api.com/john%203:16?translation=web'

interface BibleApiVerse {
  reference: string
  text: string
  translation_name?: string
}

const items = [
  {
    icon: BookOpen,
    title: 'Verse display',
    description: 'Display verses on the big screen. Add references to your setlist and follow along.',
  },
  {
    icon: Mic,
    title: 'Reference follow',
    description: 'AI listens and keeps the verse in sync. KJV, ESV, WEB and ASV supported.',
  },
  {
    icon: LayoutList,
    title: 'One flow',
    description: 'Songs and scripture in the same setlist. One operator view, one flow.',
  },
]

export function ScriptureSection() {
  const [verse, setVerse] = useState<BibleApiVerse | null>(null)
  const [verseError, setVerseError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(BIBLE_API_VERSE)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch'))))
      .then((data: BibleApiVerse) => {
        if (!cancelled && data?.text) {
          setVerse({
            reference: data.reference ?? 'John 3:16',
            text: (data.text ?? '').trim(),
            translation_name: data.translation_name,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setVerseError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
          And scripture too
        </motion.h2>

        {verse && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-14 max-w-2xl mx-auto text-center"
          >
            <blockquote className="text-xl md:text-2xl text-gray-200 leading-relaxed font-medium italic">
              &ldquo;{verse.text}&rdquo;
            </blockquote>
            <cite className="mt-3 block text-sm text-gray-400 not-italic">
              — {verse.reference}
              {verse.translation_name ? ` (${verse.translation_name})` : ''}
            </cite>
          </motion.div>
        )}
        {verseError && (
          <p className="mb-14 max-w-2xl mx-auto text-center text-gray-500 text-sm">
            Verse of the day will appear when available.
          </p>
        )}

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
