'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { HelpCircle, Bell, Settings, LogOut, Calendar, CheckCircle, Info, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/lib/stores/authStore'
import { useCommandMenu } from '@/components/providers/CommandProvider'
import { Search } from 'lucide-react'

interface Notification {
  id: string
  type: 'event' | 'system' | 'success' | 'warning'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'event',
    title: 'Sunday Service Starting Soon',
    message: 'Your event "Sunday Service" starts in 15 minutes',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    read: false,
    actionUrl: '/events/123'
  },
  {
    id: '2',
    type: 'success',
    title: 'Setlist Updated',
    message: '3 songs added to "Sunday Service" setlist',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    read: false,
    actionUrl: '/events/123'
  },
  {
    id: '3',
    type: 'system',
    title: 'New Feature Available',
    message: 'Try the new Hum Search feature to find songs by melody',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    read: true
  },
  {
    id: '4',
    type: 'warning',
    title: 'Low Song Count',
    message: 'Your event "Youth Night" only has 2 songs. Consider adding more.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    read: true,
    actionUrl: '/events/456'
  }
]

export function DashboardHeader() {
  const router = useRouter()
  const { user, profile, fetchUser, signOut } = useAuthStore()
  const { setOpen: setCommandMenuOpen } = useCommandMenu()
  const [notifications] = useState<Notification[]>(mockNotifications)

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

  const emojiAvatarMap: Record<string, string> = {
    rocket: '🚀',
    planet: '🪐',
    star: '⭐',
    galaxy: '🌌',
    moon: '🌙',
    comet: '☄️',
    satellite: '🛰️',
    telescope: '🔭',
  }

  const presetImageMap: Record<string, string> = {
    'preset:astronaut-helmet': '/avatars/presets/astronaut-helmet.png',
    'preset:rocket-launch': '/avatars/presets/rocket-launch.png',
    'preset:cosmic-energy': '/avatars/presets/cosmic-energy.png',
    'preset:futuristic-head': '/avatars/presets/futuristic-head.png',
    'preset:holographic-cassette': '/avatars/presets/holographic-cassette.png',
    'preset:planet-rings': '/avatars/presets/planet-rings.png',
    'preset:energy-sphere': '/avatars/presets/energy-sphere.png',
    'preset:cassette-tape': '/avatars/presets/cassette-tape.png',
    'preset:saturn-planet': '/avatars/presets/saturn-planet.png',
    'preset:compass-hexagon': '/avatars/presets/compass-hexagon.png',
  }

  const avatarValue = profile?.avatar ?? null
  const avatarInitials = getUserInitials()

  const renderAvatar = () => {
    if (!avatarValue) return <span>{avatarInitials}</span>

    if (presetImageMap[avatarValue]) {
      return (
        <Image
          src={presetImageMap[avatarValue]}
          alt="Avatar"
          width={32}
          height={32}
          className="w-full h-full object-cover"
        />
      )
    }

    if (emojiAvatarMap[avatarValue]) {
      return <span className="text-base leading-none">{emojiAvatarMap[avatarValue]}</span>
    }

    if (avatarValue.startsWith('http://') || avatarValue.startsWith('https://')) {
      // Use <img> for external URLs unless next/image remotePatterns are configured
      return <img src={avatarValue} alt="Avatar" className="w-full h-full object-cover" />
    }

    return <span>{avatarInitials}</span>
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  // Get unread notification count
  const getUnreadCount = (): number => {
    return notifications.filter(n => !n.read).length
  }

  // Format timestamp to relative time
  const formatTimestamp = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Get notification icon based on type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'event':
        return <Calendar className="w-5 h-5 text-blue-400" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'system':
        return <Info className="w-5 h-5 text-slate-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
    }
  }

  const unreadCount = getUnreadCount()

  return (
    <header className="fixed top-0 w-full z-50 h-16 border-b border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 h-full">
        {/* Left Side: Logo */}
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0">
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

        {/* Center: Search Bar */}
        <button
          onClick={() => setCommandMenuOpen(true)}
          className="flex-1 max-w-xl mx-8 flex items-center gap-3 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-left text-sm text-white/60 hover:text-white/80"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Search songs, events, or commands...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white/40 bg-white/5 border border-white/10 rounded">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </button>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/60 hover:text-white hover:bg-white/10 relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-white/20">
              <div className="px-3 py-2 border-b border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs text-slate-400">{unreadCount} unread</span>
                  )}
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-slate-400">No notifications</p>
                </div>
              ) : (
                <div className="py-1 pr-2">
                  {notifications.map((notification) => (
                    <div key={notification.id}>
                      <DropdownMenuItem
                        asChild
                        className="p-0 focus:bg-transparent"
                      >
                        <Link
                          href={notification.actionUrl || '#'}
                          className="group relative flex items-start gap-3 px-3 py-3 rounded-md transition-all duration-200 cursor-pointer w-full bg-transparent hover:bg-white/5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                        >
                          <div className="absolute left-0 top-2 bottom-2 w-1 bg-orange-500 rounded-r-full opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out" />
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-white">
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-slate-400 group-hover:text-gray-300 mt-0.5 line-clamp-2 transition-colors">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatTimestamp(notification.timestamp)}
                            </p>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    </div>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center justify-center w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 text-white text-sm font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="User menu"
              >
                {renderAvatar()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="flex items-center gap-2 cursor-pointer">
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
