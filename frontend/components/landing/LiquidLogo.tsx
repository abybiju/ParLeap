'use client'

/**
 * Liquid Logo: video revealed through the logo shape via CSS mask.
 * Uses logo-mask.png (transparent PNG with opaque logo) so the gradient
 * video shows only inside the logo. Fallback gradient if video loads slowly.
 */
export function LiquidLogo() {
  const maskStyle: React.CSSProperties = {
    maskImage: "url('/logo-mask.png')",
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskImage: "url('/logo-mask.png')",
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
  }

  return (
    <div className="relative w-full max-w-[600px] aspect-square mx-auto">
      {/* Fallback gradient (visible if video loads slowly) */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-orange-600 via-red-600 to-purple-900"
        aria-hidden
      />
      {/* Video clipped by logo mask */}
      <div
        className="absolute inset-0 w-full h-full"
        style={maskStyle}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/gradient.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  )
}
