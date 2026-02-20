'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Instagram, Linkedin, Youtube, ArrowUpRight } from 'lucide-react'

import { FooterBackgroundGradient, TextHoverEffect } from '@/components/ui/hover-footer'

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Download', href: '#download' },
  { label: 'Changelog', href: '/changelog' },
]

const socialLinks = [
  { label: 'Instagram', href: 'https://instagram.com/parleap', icon: Instagram },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/parleap', icon: Linkedin },
  { label: 'YouTube', href: 'https://youtube.com/@parleap', icon: Youtube },
]

export function HoverFooter() {
  return (
    <footer className="relative mx-4 mb-6 mt-16 overflow-hidden rounded-3xl border border-white/10 bg-[#070B14]/80 backdrop-blur-sm md:mx-8">
      <FooterBackgroundGradient />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-8 pt-10 md:px-10 md:pt-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-3 hover:opacity-85 transition-opacity">
              <Image src="/logo.png" alt="ParLeap" width={44} height={44} className="h-11 w-11 rounded-md" />
              <span className="text-2xl font-semibold text-white">ParLeap</span>
            </Link>
            <p className="text-sm text-neutral-300">You speak, It flows</p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/90">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-1 text-sm text-neutral-300 transition-colors hover:text-[#60a5fa]"
                  >
                    {link.label}
                    {link.href.startsWith('/') && <ArrowUpRight className="h-3.5 w-3.5" />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/90">Stay Connected</h4>
            <ul className="space-y-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-[#60a5fa]"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/90">Built For Live Flow</h4>
            <p className="text-sm leading-relaxed text-neutral-300">
              ParLeap keeps worship moments moving without interruption. Fast projection, reliable control, clean
              transitions.
            </p>
            <div className="mt-4 relative inline-flex">
              <svg
                className="pointer-events-none absolute -inset-[2px] h-[calc(100%+4px)] w-[calc(100%+4px)]"
                viewBox="0 0 260 44"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="parleapBrandOrange" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="45%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                </defs>
                <rect x="1" y="1" width="258" height="42" rx="21" fill="none" stroke="rgba(255,255,255,0.12)" />
                <motion.rect
                  x="1"
                  y="1"
                  width="258"
                  height="42"
                  rx="21"
                  fill="none"
                  stroke="url(#parleapBrandOrange)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="52 532"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -584 }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
                  style={{ filter: 'drop-shadow(0 0 9px rgba(249, 115, 22, 0.98))' }}
                />
              </svg>
              <div className="relative rounded-full border border-white/15 bg-[#0b1220]/90 px-4 py-2 text-xs text-neutral-200">
                AI Auto-Follow Ready
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="flex flex-col items-start justify-between gap-3 text-sm text-neutral-400 md:flex-row md:items-center">
            <p>© 2026 ParLeap Inc.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="transition-colors hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden h-64 lg:block">
        <TextHoverEffect text="ParLeap" className="opacity-80" />
      </div>
    </footer>
  )
}
