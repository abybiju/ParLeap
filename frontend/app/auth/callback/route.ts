import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  try {
    const url = new URL(raw, 'http://localhost')
    return url.pathname + url.search + url.hash
  } catch {
    return '/dashboard'
  }
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = safeRedirectPath(requestUrl.searchParams.get('redirect'))

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
  }

  try {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      )
    }

    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(message)}`, requestUrl.origin)
    )
  }
}
