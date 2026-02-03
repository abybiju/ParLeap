'use client'

import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useState } from 'react'

export function SecuritySection() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-8">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 text-green-500" />
        <h2 className="text-xl font-semibold text-white">Security</h2>
      </div>
      <p className="text-sm text-gray-400 mt-1">Manage your account security settings</p>

      <div className="border-b border-white/5 my-6" />

      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className="text-sm font-medium text-gray-400 mb-2 block">
            Password
          </label>
          <p className="text-sm text-gray-500 mb-3">
            Change your password to keep your account secure
          </p>
          <Button
            variant="outline"
            className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => {
              // Placeholder for password reset flow
              console.log('Reset password clicked')
            }}
          >
            Reset Password
          </Button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <label className="text-sm font-medium text-white">Two-Factor Authentication</label>
            <p className="text-xs text-gray-400 mt-1">
              Add an extra layer of security to your account
            </p>
          </div>
          <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
        </div>
      </div>
    </div>
  )
}
