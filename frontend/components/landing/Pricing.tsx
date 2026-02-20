'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Check, Star } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const tiers = [
  {
    name: 'Starter',
    monthlyPrice: 0,
    yearlyPrice: 0,
    toggleSensitive: false,
    period: '',
    features: [
      '50 Songs',
      'Manual Slides',
      'Cloud Sync',
    ],
    buttonText: 'Start Free',
    buttonVariant: 'outline' as const,
    highlighted: false,
  },
  {
    name: 'Worship Leader',
    monthlyPrice: 19,
    yearlyPrice: 15,
    toggleSensitive: true,
    period: '/mo',
    features: [
      'AI Auto-Follow',
      'Unlimited Songs',
      'Motion Backgrounds',
      'Priority Support',
    ],
    buttonText: 'Get Started',
    buttonVariant: 'default' as const,
    highlighted: true,
  },
  {
    name: 'Multi-Campus',
    monthlyPrice: null,
    yearlyPrice: null,
    toggleSensitive: false,
    period: '',
    features: [
      'Team Roles',
      'API Access',
      'White Label',
    ],
    buttonText: 'Contact Us',
    buttonVariant: 'outline' as const,
    highlighted: false,
  },
]

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const sync = () => setIsDesktop(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  const yearlySave = useMemo(() => Math.round(((19 - 15) / 19) * 100), [])

  return (
    <section id="pricing" className="py-24 px-4">
      <div className="container mx-auto">
        <div className="text-center space-y-4 mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl lg:text-5xl font-bold text-white text-center"
          >
            Plans for every team
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-neutral-300 text-lg"
          >
            Start free, scale when your team needs more.
          </motion.p>
        </div>

        <div className="mb-10 flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-sm">
            <span className={cn('text-sm transition-colors', !isYearly ? 'text-white' : 'text-neutral-400')}>
              Monthly
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} aria-label="Toggle annual billing" />
            <span className={cn('text-sm transition-colors', isYearly ? 'text-white' : 'text-neutral-400')}>
              Annual
            </span>
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-300">
              Save {yearlySave}%
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-10 max-w-6xl mx-auto">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ y: 50, opacity: 0 }}
              whileInView={
                isDesktop
                  ? {
                      y: tier.highlighted ? -18 : 0,
                      opacity: 1,
                      x: index === 2 ? -24 : index === 0 ? 24 : 0,
                      scale: index === 0 || index === 2 ? 0.96 : 1,
                    }
                  : { y: 0, opacity: 1 }
              }
              viewport={{ once: true }}
              transition={{ duration: 1.05, type: 'spring', stiffness: 90, damping: 24, delay: 0.14 }}
              className={cn(
                'glass-card p-8 relative transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20 flex flex-col',
                tier.highlighted && 'border-orange-500/50 shadow-lg shadow-orange-500/20',
                !tier.highlighted && 'mt-5',
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white text-sm font-semibold inline-flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  Most Popular
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-white">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white min-h-[48px] inline-flex items-end">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={`${tier.name}-${tier.toggleSensitive ? (isYearly ? 'yearly' : 'monthly') : 'static'}`}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        {tier.monthlyPrice === null
                          ? 'Custom'
                          : `$${tier.toggleSensitive ? (isYearly ? tier.yearlyPrice : tier.monthlyPrice) : tier.monthlyPrice}`}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  {tier.period && (
                    <span className="text-gray-400">{tier.period}</span>
                  )}
                </div>
                {tier.monthlyPrice !== null && tier.toggleSensitive && (
                  <p className="text-xs text-neutral-400">{isYearly ? 'billed annually' : 'billed monthly'}</p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span
                      className={`text-gray-300 ${
                        feature === 'AI Auto-Follow' ? 'font-bold text-white' : ''
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link href={tier.name === 'Multi-Campus' ? '/contact' : '/auth/signup'} className="mt-auto">
                <span
                  className={cn(
                    buttonVariants({ size: 'lg', variant: tier.buttonVariant }),
                    'w-full text-lg font-semibold',
                    tier.highlighted
                      ? 'gradient-brand text-white hover:opacity-90'
                      : 'glass-card-hover text-white border-white/20',
                  )}
                >
                  {tier.buttonText}
                </span>
              </Link>
              <p className="mt-3 text-xs text-gray-500 text-center">
                <Link href="/terms" className="underline hover:text-gray-300 transition-colors">
                  Terms apply
                </Link>
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
