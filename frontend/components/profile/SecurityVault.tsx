'use client'

import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SecurityVaultProps {
  className?: string
}

export function SecurityVault({ className }: SecurityVaultProps) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  return (
    <div
      className={cn(
        'bg-white/5 border border-gray-200/20 rounded-xl p-6 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-green-500" />
        <span className="text-sm text-gray-400">Security</span>
      </div>

      <div className="space-y-4">
        <Button
          variant="outline"
          className="w-full border-gray-200/20 text-white hover:bg-white/10"
          onClick={() => {
            // Placeholder for password reset flow
            console.log('Reset password clicked')
          }}
        >
          Reset Password
        </Button>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-white">Two-Factor Auth</span>
          <Switch
            checked={twoFactorEnabled}
            onCheckedChange={setTwoFactorEnabled}
          />
        </div>
      </div>
    </div>
  )
}
