'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import Link from 'next/link'

const tiers = [
  {
    name: 'Starter',
    price: '$0',
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
    price: '$19',
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
    price: 'Custom',
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
  return (
    <section id="pricing" className="py-24 px-4">
      <div className="container mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-5xl font-bold text-white text-center mb-16"
        >
          Simple, transparent pricing.
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`glass-card p-8 relative transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20 flex flex-col ${
                tier.highlighted
                  ? 'border-orange-500/50 shadow-lg shadow-orange-500/20'
                  : ''
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-white">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  {tier.period && (
                    <span className="text-gray-400">{tier.period}</span>
                  )}
                </div>
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
                <Button
                  size="lg"
                  variant={tier.buttonVariant}
                  className={`w-full ${
                    tier.highlighted
                      ? 'gradient-brand text-white hover:opacity-90'
                      : 'glass-card-hover text-white border-white/20'
                  }`}
                >
                  {tier.buttonText}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
