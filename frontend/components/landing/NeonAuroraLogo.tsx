'use client'

import Image from 'next/image'

export function NeonAuroraLogo() {
  return (
    <div className="relative w-full max-w-[500px] mx-auto">
      {/* Layer 3: Outer Glow */}
      <div className="absolute inset-0 -z-10 bg-orange-500/20 blur-[100px] rounded-full" />
      
      {/* Layer 1: The Anchor (Static Logo) */}
      <div className="relative z-10">
        <Image
          src="/logo.png"
          alt="ParLeap Logo"
          width={500}
          height={500}
          className="w-full h-auto"
          priority
        />
      </div>
      
      {/* Layer 2: The Flow (Animated Gradient Overlay) */}
      <div
        className="absolute inset-0 z-20 bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-orange-500/40 animate-aurora mix-blend-color-dodge pointer-events-none"
        style={{
          backgroundSize: '200% 100%',
          backgroundPosition: '0% 50%',
        }}
      />
    </div>
  )
}
