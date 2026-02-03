'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppPageWrapper } from '@/components/layout/AppPageWrapper'
import { GeneralSection } from '@/components/profile/sections/GeneralSection'
import { AccountSection } from '@/components/profile/sections/AccountSection'
import { SecuritySection } from '@/components/profile/sections/SecuritySection'
import { BillingSection } from '@/components/profile/sections/BillingSection'
import { cn } from '@/lib/utils'

type TabId = 'general' | 'account' | 'security' | 'billing'

const tabs: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'billing', label: 'Billing' },
]

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading, fetchUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabId>('general')

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
      <div className="max-w-6xl mx-auto py-10 px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white mb-2">Profile Settings</h1>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </header>

        <div className="flex flex-col md:flex-row gap-10">
          {/* Left: Sidebar Navigation */}
          <nav className="w-full md:w-64 flex-shrink-0">
            <div className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full text-left px-4 py-2 rounded-lg transition-all',
                    activeTab === tab.id
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Right: Content Area */}
          <div className="flex-1 space-y-8">
            {activeTab === 'general' && <GeneralSection />}
            {activeTab === 'account' && <AccountSection />}
            {activeTab === 'security' && <SecuritySection />}
            {activeTab === 'billing' && <BillingSection />}
          </div>
        </div>
      </div>
    </AppPageWrapper>
  )
}
