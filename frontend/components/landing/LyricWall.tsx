'use client'

import { motion } from 'framer-motion'

const content = [
  // Hymns
  {
    song: 'Amazing Grace',
    lyric: 'Amazing grace how sweet the sound / That saved a wretch like me',
    artist: 'John Newton',
  },
  {
    song: 'How Great Thou Art',
    lyric: 'Then sings my soul, my Savior God to Thee / How great Thou art, how great Thou art',
    artist: 'Carl Boberg',
  },
  {
    song: 'Great Is Thy Faithfulness',
    lyric: 'Great is Thy faithfulness, O God my Father / There is no shadow of turning with Thee',
    artist: 'Thomas Chisholm',
  },
  {
    song: 'It Is Well',
    lyric: 'When peace like a river attendeth my way / When sorrows like sea billows roll',
    artist: 'Horatio Spafford',
  },
  {
    song: 'In Christ Alone',
    lyric: 'In Christ alone my hope is found / He is my light, my strength, my song',
    artist: 'Keith Getty & Stuart Townend',
  },
  {
    song: 'Great Are You Lord',
    lyric: 'It\'s Your breath in our lungs / So we pour out our praise / We pour out our praise',
    artist: 'All Sons & Daughters',
  },
  {
    song: 'Blessed Assurance',
    lyric: 'Blessed assurance, Jesus is mine / Oh, what a foretaste of glory divine',
    artist: 'Fanny Crosby',
  },
  {
    song: 'Be Thou My Vision',
    lyric: 'Be Thou my vision, O Lord of my heart / Naught be all else to me, save that Thou art',
    artist: 'Traditional Irish',
  },
  {
    song: 'Come Thou Fount',
    lyric: 'Come Thou fount of every blessing / Tune my heart to sing Thy grace',
    artist: 'Robert Robinson',
  },
  // Modern Worship
  {
    song: 'Way Maker',
    lyric: 'You are here, moving in our midst / I worship You, I worship You',
    artist: 'Sinach',
  },
  {
    song: 'Oceans',
    lyric: 'Spirit lead me where my trust is without borders / Let me walk upon the waters',
    artist: 'Hillsong UNITED',
  },
  {
    song: '10,000 Reasons',
    lyric: 'Bless the Lord, O my soul / O my soul / Worship His holy name',
    artist: 'Matt Redman',
  },
  {
    song: 'Goodness of God',
    lyric: 'I love Your voice / You have led me through the fire / In darkest nights',
    artist: 'Bethel Music',
  },
  {
    song: 'What a Beautiful Name',
    lyric: 'What a beautiful Name it is / Nothing compares to this / What a beautiful Name it is',
    artist: 'Hillsong Worship',
  },
  {
    song: 'Reckless Love',
    lyric: 'Oh, the overwhelming, never-ending, reckless love of God / Oh, it chases me down',
    artist: 'Cory Asbury',
  },
  {
    song: 'Build My Life',
    lyric: 'Holy, there is no one like You / There is none beside You / Open up my eyes in wonder',
    artist: 'Pat Barrett',
  },
  {
    song: 'Cornerstone',
    lyric: 'My hope is built on nothing less / Than Jesus\' blood and righteousness',
    artist: 'Hillsong Worship',
  },
  {
    song: 'No Longer Slaves',
    lyric: 'You unravel me with a melody / You surround me with a song / Of deliverance',
    artist: 'Bethel Music',
  },
  {
    song: 'King of Kings',
    lyric: 'In the darkness we were waiting / Without hope, without light / Till from heaven You came running',
    artist: 'Hillsong Worship',
  },
  {
    song: 'Raise a Hallelujah',
    lyric: 'I raise a hallelujah, in the presence of my enemies / I raise a hallelujah, louder than the unbelief',
    artist: 'Bethel Music',
  },
  {
    song: 'Graves Into Gardens',
    lyric: 'You turn graves into gardens / You turn bones into armies / You turn seas into highways',
    artist: 'Elevation Worship',
  },
  {
    song: 'The Blessing',
    lyric: 'The Lord bless you and keep you / Make His face shine upon you / And be gracious to you',
    artist: 'Kari Jobe & Cody Carnes',
  },
  {
    song: 'Living Hope',
    lyric: 'How great the chasm that lay between us / How high the mountain I could not climb',
    artist: 'Phil Wickham',
  },
  {
    song: 'So Will I',
    lyric: 'God of creation, there at the start / Before the beginning of time / You were on the throne',
    artist: 'Hillsong UNITED',
  },
]

// Split content into two halves
const firstHalf = content.slice(0, Math.ceil(content.length / 2))
const secondHalf = content.slice(Math.ceil(content.length / 2))

export function LyricWall() {
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
          Ready for any song
        </motion.h2>

        <div
          className="relative h-[600px] overflow-hidden flex gap-6 justify-center"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
          }}
        >
          {/* Column 1: Scroll Up */}
          <div className="relative h-full overflow-hidden w-full max-w-md">
            <div className="animate-scroll-up-slow pause-on-hover flex flex-col gap-6">
              {/* First render */}
              {firstHalf.map((item, index) => (
                <div
                  key={`col1-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex-shrink-0 transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20"
                >
                  <p className="text-neutral-300 font-medium leading-relaxed">
                    {item.lyric}
                  </p>
                  <p className="text-neutral-500 text-sm mt-4">
                    {item.song} • {item.artist}
                  </p>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {firstHalf.map((item, index) => (
                <div
                  key={`col1-dup-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex-shrink-0 transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20"
                >
                  <p className="text-neutral-300 font-medium leading-relaxed">
                    {item.lyric}
                  </p>
                  <p className="text-neutral-500 text-sm mt-4">
                    {item.song} • {item.artist}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Scroll Down */}
          <div className="relative h-full overflow-hidden w-full max-w-md">
            <div className="animate-scroll-down-slow pause-on-hover flex flex-col gap-6">
              {/* First render */}
              {secondHalf.map((item, index) => (
                <div
                  key={`col2-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex-shrink-0 transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20"
                >
                  <p className="text-neutral-300 font-medium leading-relaxed">
                    {item.lyric}
                  </p>
                  <p className="text-neutral-500 text-sm mt-4">
                    {item.song} • {item.artist}
                  </p>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {secondHalf.map((item, index) => (
                <div
                  key={`col2-dup-${index}`}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex-shrink-0 transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20"
                >
                  <p className="text-neutral-300 font-medium leading-relaxed">
                    {item.lyric}
                  </p>
                  <p className="text-neutral-500 text-sm mt-4">
                    {item.song} • {item.artist}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
