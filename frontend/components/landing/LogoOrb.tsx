'use client'

import Image from 'next/image'

export function LogoOrb() {
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      <div className="container mx-auto">
        <div className="relative flex flex-col items-center text-center">
          {/* Ambient glow */}
          <div className="absolute -top-16 h-72 w-72 rounded-full bg-gradient-to-br from-orange-400/30 via-red-500/20 to-blue-500/20 blur-3xl" />
          <div className="absolute top-10 h-96 w-96 rounded-full border border-white/5 bg-white/5 blur-2xl" />

          {/* Orb */}
          <div className="relative h-56 w-56 sm:h-64 sm:w-64 md:h-72 md:w-72">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500/20 via-red-500/10 to-blue-600/20 blur-xl" />
            <div className="absolute inset-2 rounded-full border border-white/10 bg-black/30 backdrop-blur-xl" />
            <div className="absolute inset-0 rounded-full animate-[spin_40s_linear_infinite]">
              <div className="absolute -left-6 top-1/3 h-16 w-16 rounded-full bg-orange-400/20 blur-2xl" />
              <div className="absolute -right-8 top-2/3 h-20 w-20 rounded-full bg-blue-500/20 blur-2xl" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="ParLeap"
                width={220}
                height={220}
                className="w-40 sm:w-48 md:w-52 drop-shadow-[0_25px_60px_rgba(255,130,60,0.35)]"
                priority
              />
            </div>
          </div>

          <div className="mt-10 max-w-2xl space-y-3">
            <h2 className="text-3xl md:text-4xl font-semibold text-white">
              The stage is listening.
            </h2>
            <p className="text-sm md:text-base text-slate-400">
              A glowing moment between proof and pricing — the ParLeap signal in motion.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
