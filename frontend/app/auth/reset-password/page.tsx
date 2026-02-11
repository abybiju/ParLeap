'use client'

import { useState, useTransition, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'
import { toast } from 'sonner'

const resetSchema = z
  .object({
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ResetFormState = 'loading' | 'ready' | 'invalid_link' | 'success'

function ResetPasswordForm() {
  const router = useRouter()
  const [state, setState] = useState<ResetFormState>('loading')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let subscription: { unsubscribe: () => void } | null = null

    const setReady = () => {
      if (!resolved) {
        resolved = true
        setState('ready')
      }
    }

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setReady()
        return
      }
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) setReady()
      })
      subscription = data.subscription
      timeoutId = setTimeout(async () => {
        subscription?.unsubscribe()
        if (resolved) return
        const {
          data: { session: s },
        } = await supabase.auth.getSession()
        if (!s) {
          resolved = true
          setState('invalid_link')
        }
      }, 3000)
    }

    checkSession()
    return () => {
      clearTimeout(timeoutId)
      subscription?.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const parsed = resetSchema.safeParse({ password, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid input')
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })

    if (updateError) {
      setError(updateError.message)
      return
    }

    setState('success')
    toast.success('Password updated. Signing you in...')
    startTransition(() => {
      router.push('/dashboard')
    })
  }

  if (state === 'loading') {
    return (
      <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
          <div className="text-center text-white">Checking your reset link...</div>
        </div>
      </AppPageWrapper>
    )
  }

  if (state === 'invalid_link') {
    return (
      <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white">Invalid or expired link</h1>
            <p className="text-sm text-slate-300 mt-2">
              This password reset link is invalid or has expired. Request a new one.
            </p>
          </div>
          <Link
            href="/auth/forgot-password"
            className={cn(
              'block w-full rounded-lg bg-indigo-500 px-4 py-2 text-white font-medium text-center',
              'hover:bg-indigo-400 transition shadow-lg shadow-indigo-500/30'
            )}
          >
            Request new reset link
          </Link>
          <p className="mt-6 text-center text-sm text-slate-300">
            <Link className="text-indigo-300 hover:text-indigo-200" href="/auth/login">
              Back to sign in
            </Link>
          </p>
        </div>
      </AppPageWrapper>
    )
  }

  if (state === 'success') {
    return (
      <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
          <div className="text-center text-white">Redirecting to dashboard...</div>
        </div>
      </AppPageWrapper>
    )
  }

  return (
    <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-white">Set new password</h1>
          <p className="text-sm text-slate-300 mt-2">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-200 mb-2" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white',
                'placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40'
              )}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-200 mb-2" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white',
                'placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40'
              )}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error ? (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className={cn(
              'w-full rounded-lg bg-indigo-500 px-4 py-2 text-white font-medium',
              'hover:bg-indigo-400 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30',
              'flex items-center justify-center gap-2'
            )}
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              'Update password'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          <Link className="text-indigo-300 hover:text-indigo-200" href="/auth/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </AppPageWrapper>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
            <div className="text-center text-white">Loading...</div>
          </div>
        </AppPageWrapper>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
