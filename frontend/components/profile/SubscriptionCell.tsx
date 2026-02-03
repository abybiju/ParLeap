'use client'

import { Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/stores/authStore'
import { cn } from '@/lib/utils'

interface SubscriptionCellProps {
  className?: string
}

export function SubscriptionCell({ className }: SubscriptionCellProps) {
  const { profile } = useAuthStore()

  const subscriptionTier = profile?.subscription_tier || 'free'
  const isPro = subscriptionTier === 'pro' || subscriptionTier === 'team'

  // Mock data for billing
  const renewalDate = 'Mar 15, 2026'
  const paymentMethod = '**** 4242'

  return (
    <div
      className={cn(
        'bg-white/5 border border-gray-200/20 rounded-xl p-6 shadow-sm',
        isPro && 'border-orange-500/30',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-orange-500" />
        <span className="text-sm text-gray-400">Plan Status</span>
      </div>

      <div className="mb-4">
        <span className="text-2xl font-semibold text-white capitalize">{subscriptionTier}</span>
      </div>

      {isPro && (
        <>
          <div className="mt-4 space-y-3 text-sm border-t border-gray-200/20 pt-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Renewal</span>
              <span className="text-white">{renewalDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Payment</span>
              <span className="text-white">{paymentMethod}</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 border-gray-200/20 text-white hover:bg-white/10"
            onClick={() => {
              // Placeholder for future Stripe integration
              console.log('Manage billing clicked')
            }}
          >
            Manage Billing
          </Button>
        </>
      )}

      {!isPro && (
        <Button
          variant="outline"
          className="w-full mt-4 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
          onClick={() => {
            // Placeholder for upgrade flow
            console.log('Upgrade clicked')
          }}
        >
          Upgrade to PRO
        </Button>
      )}
    </div>
  )
}
