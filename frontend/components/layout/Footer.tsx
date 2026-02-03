'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Instagram, Linkedin, Youtube } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-4 bg-[#050505]">
      <div className="container mx-auto">
        {/* Main Footer Content */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Left: Logo + Tagline */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity w-fit">
              <div className="relative w-12 h-12">
                <Image
                  src="/logo.png"
                  alt="ParLeap"
                  width={48}
                  height={48}
                  className="w-12 h-12"
                />
              </div>
            </Link>
            <p className="text-neutral-500 text-sm">
              You speak, It flows
            </p>
          </div>

          {/* Center: Links */}
          <div className="flex flex-wrap gap-6 justify-center md:justify-start">
            <Link
              href="#features"
              className="text-neutral-500 hover:text-white transition-colors text-sm"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-neutral-500 hover:text-white transition-colors text-sm"
            >
              Pricing
            </Link>
            <Link
              href="#download"
              className="text-neutral-500 hover:text-white transition-colors text-sm"
            >
              Download
            </Link>
            <Link
              href="/changelog"
              className="text-neutral-500 hover:text-white transition-colors text-sm"
            >
              Changelog
            </Link>
          </div>

          {/* Right: Social Icons */}
          <div className="flex items-center gap-4 justify-center md:justify-end">
            <a
              href="https://instagram.com/parleap"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://linkedin.com/company/parleap"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </a>
            <a
              href="https://youtube.com/@parleap"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="YouTube"
            >
              <Youtube className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Bottom Row: Copyright */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
          <p>© 2026 ParLeap Inc.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
