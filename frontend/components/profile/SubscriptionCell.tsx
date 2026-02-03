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
        'backdrop-blur-xl bg-[#0A0A0A]/60 rounded-2xl p-6',
        isPro
          ? 'border-2 border-orange-500/50 shadow-[0_0_30px_-5px_rgba(249,115,22,0.3)]'
          : 'border border-white/10',
        className
      )}
    >
      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">PLAN_STATUS</span>

      <div className="mt-4 flex items-center gap-2">
        <Crown className="w-6 h-6 text-orange-500" />
        <span className="text-2xl font-bold text-white uppercase">{subscriptionTier}</span>
      </div>

      {isPro && (
        <>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-mono text-gray-500 text-xs">RENEWAL</span>
              <span className="text-white">{renewalDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-500 text-xs">PAYMENT</span>
              <span className="text-white">{paymentMethod}</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 border-white/20 text-white hover:bg-white/10"
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
