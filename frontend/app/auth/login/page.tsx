'use client'

import { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { AuthFlowFrame } from '@/components/ui/sign-in-flow-1'

const loginSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
})

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid credentials')
      return
    }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (signInError) {
      setError(signInError.message)
      return
    }

    startTransition(() => {
      router.push(redirectTo)
    })
  }

  return (
    <AuthFlowFrame title="Sign in to ParLeap" subtitle="Real-time AI-powered presentation orchestration">
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
              'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white',
              'placeholder:text-slate-400 focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/30'
            )}
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm text-slate-200" htmlFor="password">
              Password
            </label>
            <Link href="/auth/forgot-password" className="text-xs text-slate-400 hover:text-orange-300 hover:underline">
              Forgot your password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-white',
                'placeholder:text-slate-400 focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/30'
              )}
              placeholder="••••••••"
              required
            />
            {password.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-xl px-3 py-2">
            {error}
          </div>
        ) : null}

        <motion.button
          type="submit"
          disabled={isPending}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            'w-full rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF3C38] px-4 py-3 text-white font-semibold',
            'hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25',
            'flex items-center justify-center gap-2'
          )}
        >
          {isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            'Sign in'
          )}
        </motion.button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-300">
        No account?{' '}
        <Link className="text-orange-300 hover:text-orange-200" href="/auth/signup">
          Sign up
        </Link>
      </p>
      <p className="mt-6 text-center text-xs text-slate-400">
        By signing up, you agree to the{' '}
        <Link href="/terms" className="underline hover:text-slate-200 transition-colors">
          Product Terms
        </Link>
        ,{' '}
        <Link href="/terms#policies" className="underline hover:text-slate-200 transition-colors">
          Policies
        </Link>
        ,{' '}
        <Link href="/privacy" className="underline hover:text-slate-200 transition-colors">
          Privacy Notice
        </Link>
        , and{' '}
        <Link href="/privacy#cookies" className="underline hover:text-slate-200 transition-colors">
          Cookie Notice
        </Link>
        .
      </p>
    </AuthFlowFrame>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthFlowFrame title="Sign in to ParLeap" subtitle="Loading...">
        <div className="text-center text-white">Loading...</div>
      </AuthFlowFrame>
    }>
      <LoginForm />
    </Suspense>
  )
}
