'use client'

import { useEffect } from 'react'

interface SplineViewerProps {
  url: string
  className?: string
}

export function SplineViewer({ url, className }: SplineViewerProps) {
  useEffect(() => {
    // Load the Spline viewer script if not already loaded
    if (typeof window !== 'undefined' && !customElements.get('spline-viewer')) {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = 'https://unpkg.com/@splinetool/viewer@1.12.42/build/spline-viewer.js'
      document.head.appendChild(script)
    }
  }, [])

  return (
    <spline-viewer
      url={url}
      className={className}
      suppressHydrationWarning
    ></spline-viewer>
  )
}
