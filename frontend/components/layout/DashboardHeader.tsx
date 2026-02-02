'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { HelpCircle, Bell, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/lib/stores/authStore'

export function DashboardHeader() {
  const router = useRouter()
  const { user, profile, fetchUser, signOut } = useAuthStore()

  // Fetch user data on mount
  useEffect(() => {
    if (!user) {
      fetchUser()
    }
  }, [user, fetchUser])

  // Get user initials for avatar
  const getUserInitials = (): string => {
    if (profile?.username) {
      return profile.username.charAt(0).toUpperCase()
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase()
    }
    return 'U'
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <header className="fixed top-0 w-full z-50 h-16 border-b border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 h-full">
        {/* Left Side: Logo */}
        <Link href="/dashboard" className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0">
          <div className="relative w-10 h-10">
            <Image
              src="/logo.png"
              alt="ParLeap"
              width={40}
              height={40}
              className="w-10 h-10"
              priority
            />
          </div>
        </Link>

        {/* Right Side: Utility Cluster */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Help Button */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>

          {/* Notifications Button */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white text-sm font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="User menu"
              >
                {getUserInitials()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2 cursor-pointer text-red-400 focus:text-red-300"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
