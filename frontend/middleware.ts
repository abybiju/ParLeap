import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from './lib/supabase/types'

const PROTECTED_PATHS = [
  '/dashboard',
  '/songs',
  '/events',
  '/live',
  '/operator',
]

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname.startsWith(path))
}

export async function middleware(req: NextRequest) {
  const { pathname, origin, searchParams } = req.nextUrl
  const response = NextResponse.next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data } = await supabase.auth.getSession()
  const session = data.session

  const isAuthPath = pathname.startsWith('/auth')

  if (isProtectedPath(pathname) && !session) {
    const redirectTo = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname
    const redirectUrl = new URL(`/auth/login?redirect=${encodeURIComponent(redirectTo)}`, origin)
    return NextResponse.redirect(redirectUrl)
  }

  if (isAuthPath && session) {
    const redirectUrl = new URL('/dashboard', origin)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/songs/:path*',
    '/events/:path*',
    '/live/:path*',
    '/operator/:path*',
    '/auth/:path*',
  ],
}
