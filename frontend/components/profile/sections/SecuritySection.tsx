'use client'

import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useState } from 'react'
import { z } from 'zod'
import { cn } from '@/lib/utils'

const resetSchema = z
  .object({
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function SecuritySection() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = resetSchema.safeParse({ password: newPassword, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input')
      return
    }
    setIsPending(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })
    setIsPending(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    toast.success('Password updated successfully')
    setResetModalOpen(false)
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-8 transition-all duration-300 hover:border-orange-500/30 hover:bg-white/[0.02] hover:shadow-[0_0_40px_-20px_rgba(234,88,12,0.35)]">
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
            onClick={() => setResetModalOpen(true)}
          >
            Reset Password
          </Button>
        </div>

        <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
          <DialogContent className="bg-[#0A0A0A] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription className="text-gray-400">
                Enter a new password. It must be at least 6 characters.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white',
                    'focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40'
                  )}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white',
                    'focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40'
                  )}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              {error ? (
                <p className="text-sm text-rose-300">{error}</p>
              ) : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                  onClick={() => setResetModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white"
                >
                  {isPending ? 'Updating...' : 'Update password'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
