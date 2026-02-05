'use client'

import Image from 'next/image'

export function LogoOrb() {
  return (
    <section className="relative py-32 px-4 overflow-hidden">
      <div className="container mx-auto">
        <div className="relative flex flex-col items-center text-center">
          {/* Ambient glow */}
          <div className="absolute -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-orange-400/30 via-red-500/20 to-blue-500/20 blur-3xl" />
          <div className="absolute top-8 h-[30rem] w-[30rem] rounded-full border border-white/5 bg-white/5 blur-2xl" />

          {/* Orb */}
          <div className="relative h-72 w-72 sm:h-80 sm:w-80 md:h-[22rem] md:w-[22rem]">
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
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/70" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />
            </div>
            <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-orange-400/20 via-red-500/10 to-blue-600/20 blur-3xl" />
            <div className="absolute inset-0 rounded-full ring-1 ring-white/10 shadow-[0_30px_80px_rgba(255,140,66,0.35)]" />
            <div className="absolute -inset-8 rounded-full opacity-40 blur-2xl bg-[radial-gradient(circle,rgba(255,160,80,0.25)_0%,rgba(10,12,24,0)_60%)]" />
          </div>

          {/* Twinkling stars */}
          <div className="pointer-events-none absolute -z-10 inset-0">
            <span className="absolute left-[10%] top-[20%] h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
            <span className="absolute left-[22%] top-[55%] h-1 w-1 rounded-full bg-white/60 animate-pulse [animation-delay:400ms]" />
            <span className="absolute right-[18%] top-[30%] h-1 w-1 rounded-full bg-white/70 animate-pulse [animation-delay:800ms]" />
            <span className="absolute right-[12%] top-[60%] h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse [animation-delay:1200ms]" />
            <span className="absolute right-[30%] top-[45%] h-1 w-1 rounded-full bg-white/60 animate-pulse [animation-delay:1600ms]" />
          </div>

          <div className="mt-12 max-w-2xl space-y-3">
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
