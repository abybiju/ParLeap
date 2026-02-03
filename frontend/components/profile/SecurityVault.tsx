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
        'backdrop-blur-xl bg-[#0A0A0A]/60 border border-white/10 rounded-2xl p-6',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-green-500" />
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          SECURITY_VAULT
        </span>
      </div>

      <div className="space-y-4">
        <Button
          variant="outline"
          className="w-full border-white/20 text-white hover:bg-white/10"
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
