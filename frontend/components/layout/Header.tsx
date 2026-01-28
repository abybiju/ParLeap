'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="fixed top-0 w-full z-50 backdrop-blur-xl bg-black/50 border-b border-white/5">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="ParLeap"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-white font-semibold text-lg">ParLeap</span>
          </Link>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#download"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Download
            </Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-neutral-400 hover:text-white transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link href="/auth/signup">
              <Button
                className="bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] text-white hover:opacity-90 px-6"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
