'use client'

import { usePathname } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { DashboardHeader } from '@/components/layout/DashboardHeader'

/**
 * ConditionalHeader Component
 * 
 * Renders the appropriate header based on the current route:
 * - DashboardHeader for protected routes (dashboard, songs, events, live, operator, profile)
 * - Header (marketing) for public routes (homepage, auth pages)
 */
export function ConditionalHeader() {
  const pathname = usePathname()

  // Check if current route is a protected route
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/songs') ||
    pathname.startsWith('/events') ||
    pathname.startsWith('/live') ||
    pathname.startsWith('/operator') ||
    pathname.startsWith('/profile')

  const isEmbeddedAuthHeaderRoute =
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/signup')

  if (isEmbeddedAuthHeaderRoute) {
    return null
  }

  // Render DashboardHeader for protected routes, Header for public routes
  return isProtectedRoute ? <DashboardHeader /> : <Header />
}
