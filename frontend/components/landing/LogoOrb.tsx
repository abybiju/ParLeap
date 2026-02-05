'use client'

import Image from 'next/image'

export function LogoOrb() {
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      <div className="container mx-auto">
        <div className="relative flex flex-col items-center text-center">
          {/* Ambient glow */}
          <div className="absolute -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-orange-400/30 via-red-500/20 to-blue-500/20 blur-3xl" />
          <div className="absolute top-8 h-96 w-96 rounded-full border border-white/5 bg-white/5 blur-2xl" />

          {/* Orb */}
          <div className="relative h-64 w-64 sm:h-72 sm:w-72 md:h-80 md:w-80">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500/20 via-red-500/10 to-blue-600/20 blur-2xl" />
            <div className="absolute inset-2 rounded-full border border-white/10 bg-black/30 backdrop-blur-xl" />
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <Image
                src="/assets/space1.jpeg"
                alt="ParLeap Orb"
                fill
                className="object-cover opacity-90 mix-blend-screen"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/50" />
            </div>
            <div className="absolute inset-0 rounded-full ring-1 ring-white/10 shadow-[0_30px_80px_rgba(255,140,66,0.25)]" />
          </div>

          <div className="mt-10 max-w-2xl space-y-3">
            <h2 className="text-3xl md:text-4xl font-semibold text-white">
              The stage is listening.
            </h2>
            <p className="text-sm md:text-base text-slate-400">
              A luminous signal between proof and pricing.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
