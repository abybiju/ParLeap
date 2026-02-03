'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

export function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  
  // On home page, return a hero header that merges with Spline background
  if (isHomePage) {
    return (
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 w-full z-50 backdrop-blur-md bg-black/25 border-b border-white/10"
      >
        <div className="container mx-auto px-4">
          <nav className="flex items-center h-24 py-4">
            {/* Logo - Bigger and clearer like Superlist */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0">
                <div className="relative w-14 h-14">
                  <Image
                    src="/logo.png"
                    alt="ParLeap"
                    width={56}
                    height={56}
                    className="w-14 h-14"
                    priority
                  />
                </div>
                <span className="text-white font-semibold text-xl">ParLeap</span>
              </Link>
            </motion.div>

            {/* Navigation Links - Positioned between logo and buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden md:flex items-center gap-8 flex-1 justify-end mr-8"
            >
              <Link
                href="#features"
                className="text-white/80 hover:text-white transition-colors text-sm font-medium"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-white/80 hover:text-white transition-colors text-sm font-medium"
              >
                Pricing
              </Link>
              <Link
                href="#download"
                className="text-white/80 hover:text-white transition-colors text-sm font-medium"
              >
                Download
              </Link>
            </motion.div>

            {/* Right Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center gap-6 flex-shrink-0"
            >
              <Link
                href="/auth/login"
                className="text-white/80 hover:text-white transition-colors hidden sm:block text-sm font-medium"
              >
                Sign In
              </Link>
              <Link href="/auth/signup">
                <Button
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] text-white hover:opacity-90 px-6 py-2 rounded-lg text-sm font-medium shadow-lg shadow-orange-500/20"
                >
                  Get Started
                </Button>
              </Link>
            </motion.div>
          </nav>
        </div>
      </motion.header>
    )
  }
  
  // Standard header for other pages
  return (
    <header className="fixed top-0 w-full z-50 backdrop-blur-xl bg-black/50 border-b border-white/5 pt-6">
      <div className="container mx-auto px-4">
        <nav className="flex items-center h-24 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0">
            <div className="relative w-12 h-12">
              <Image
                src="/logo.png"
                alt="ParLeap"
                width={48}
                height={48}
                className="w-12 h-12"
              />
            </div>
            <span className="text-white font-semibold text-xl">ParLeap</span>
          </Link>

          {/* Navigation Links - Positioned between logo and buttons */}
          <div className="hidden md:flex items-center gap-6 flex-1 justify-end mr-8">
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
          <div className="flex items-center gap-4 flex-shrink-0">
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
