'use client'

import { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'

const emailSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email' }),
})

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    const parsed = emailSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid email')
      return
    }

    const supabase = createClient()
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : '/auth/reset-password'

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    })

    if (resetError) {
      setError(resetError.message)
      return
    }

    startTransition(() => {
      setSuccess(true)
    })
  }

  if (success) {
    return (
      <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white">Check your email</h1>
            <p className="text-sm text-slate-300 mt-2">
              We sent a password reset link to <span className="text-white font-medium">{email}</span>
            </p>
          </div>
          <p className="text-sm text-slate-400 text-center mb-6">
            Click the link in the email to set a new password. If you don&apos;t see it, check your
            spam folder.
          </p>
          <Link
            href="/auth/login"
            className={cn(
              'block w-full rounded-lg bg-indigo-500 px-4 py-2 text-white font-medium text-center',
              'hover:bg-indigo-400 transition shadow-lg shadow-indigo-500/30'
            )}
          >
            Back to sign in
          </Link>
        </div>
      </AppPageWrapper>
    )
  }

  return (
    <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-white">Forgot your password?</h1>
          <p className="text-sm text-slate-300 mt-2">
            Enter your email and we&apos;ll send you a link to reset it
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-200 mb-2" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white',
                'placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40'
              )}
              placeholder="you@example.com"
              required
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
                <span>Sending...</span>
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          Remember your password?{' '}
          <Link className="text-indigo-300 hover:text-indigo-200" href="/auth/login">
            Sign in
          </Link>
        </p>
      </div>
    </AppPageWrapper>
  )
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordForm />
    </Suspense>
  )
}
