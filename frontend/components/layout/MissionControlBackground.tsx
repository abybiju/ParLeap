'use client'

/**
 * Mission Control Background
 * Apple Music-style: Faint colorful blobs (Orange/Red) that make glass texture pop
 */
export function MissionControlBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      {/* Orange blob - top left */}
      <div
        className="absolute -top-40 -left-40 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(255,140,0,0.4) 0%, rgba(255,69,0,0.2) 40%, transparent 70%)',
        }}
      />
      {/* Red blob - top right */}
      <div
        className="absolute -top-20 -right-20 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(255,60,56,0.35) 0%, rgba(255,69,0,0.15) 50%, transparent 70%)',
        }}
      />
      {/* Soft center glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(ellipse, rgba(255,140,0,0.25) 0%, transparent 60%)',
        }}
      />
    </div>
  )
}
