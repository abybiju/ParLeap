'use client'

import { Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/stores/authStore'
import { cn } from '@/lib/utils'

export function BillingSection() {
  const { profile } = useAuthStore()

  const subscriptionTier = profile?.subscription_tier || 'free'
  const isPro = subscriptionTier === 'pro' || subscriptionTier === 'team'

  // Mock data for billing
  const renewalDate = 'Mar 15, 2026'
  const paymentMethod = '**** 4242'

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-8">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="w-5 h-5 text-orange-500" />
        <h2 className="text-xl font-semibold text-white">Billing</h2>
      </div>
      <p className="text-sm text-gray-400 mt-1">Manage your subscription and payment methods</p>

      <div className="border-b border-white/5 my-6" />

      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className="text-sm font-medium text-gray-400 mb-2 block">
            Subscription Plan
          </label>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-2xl font-semibold text-white capitalize',
                isPro && 'text-orange-500'
              )}
            >
              {subscriptionTier}
            </span>
            {isPro && <Crown className="w-5 h-5 text-orange-500" />}
          </div>
        </div>

        {isPro && (
          <>
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <span className="text-sm text-gray-400">Renewal Date</span>
              <span className="text-white">{renewalDate}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <span className="text-sm text-gray-400">Payment Method</span>
              <span className="text-white">{paymentMethod}</span>
            </div>

            <div className="pt-4 border-t border-white/5">
              <Button
                variant="outline"
                className="w-full border-white/10 text-white hover:bg-white/10"
                onClick={() => {
                  // Placeholder for future Stripe integration
                  console.log('Manage billing clicked')
                }}
              >
                Manage Billing
              </Button>
            </div>
          </>
        )}

        {!isPro && (
          <div className="pt-4 border-t border-white/5">
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white hover:opacity-90"
              onClick={() => {
                // Placeholder for upgrade flow
                console.log('Upgrade clicked')
              }}
            >
              Upgrade to PRO
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
