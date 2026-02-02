'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'

const signUpSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
})

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const parsed = signUpSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid details')
      return
    }

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    setMessage('Check your email to confirm your account, then sign in.')

    startTransition(() => {
      router.push('/auth/login')
    })
  }

  return (
    <AppPageWrapper className="flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 shadow-xl shadow-slate-900/50 backdrop-blur border border-white/10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-white">Create your ParLeap account</h1>
          <p className="text-sm text-slate-300 mt-2">
            Automate your live presentations with AI
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

          <div>
            <label className="block text-sm text-slate-200 mb-2" htmlFor="password">
              Password
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
            />
          </div>

          {error ? (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-3 py-2">
              {message}
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
                <span>Signing up...</span>
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          Already have an account?{' '}
          <Link className="text-indigo-300 hover:text-indigo-200" href="/auth/login">
            Sign in
          </Link>
        </p>
      </div>
    </AppPageWrapper>
  )
}
