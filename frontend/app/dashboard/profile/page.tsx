'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'
import { IdentityCard } from '@/components/profile/IdentityCard'
import { SubscriptionCell } from '@/components/profile/SubscriptionCell'
import { StatsDeck } from '@/components/profile/StatsDeck'
import { SecurityVault } from '@/components/profile/SecurityVault'
import { PreferencesPanel } from '@/components/profile/PreferencesPanel'

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading, fetchUser } = useAuthStore()

  useEffect(() => {
    // Fetch user data if not already loaded
    if (!user && !isLoading) {
      fetchUser()
    }
  }, [user, isLoading, fetchUser])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <AppPageWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppPageWrapper>
    )
  }

  return (
    <AppPageWrapper>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            MISSION_CONTROL
          </span>
          <h1 className="text-3xl font-bold text-white mt-2">Profile</h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Row 1 */}
          <IdentityCard className="md:col-span-2" />
          <SubscriptionCell />

          {/* Row 2 - Full Width */}
          <StatsDeck className="md:col-span-3" />

          {/* Row 3 */}
          <SecurityVault />
          <PreferencesPanel className="md:col-span-2" />
        </div>
      </div>
    </AppPageWrapper>
  )
}
