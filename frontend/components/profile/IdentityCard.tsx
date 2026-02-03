'use client'

import { Camera } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/stores/authStore'
import { cn } from '@/lib/utils'

interface IdentityCardProps {
  className?: string
}

export function IdentityCard({ className }: IdentityCardProps) {
  const { user, profile } = useAuthStore()

  const getUserInitials = (): string => {
    if (profile?.username) {
      return profile.username.charAt(0).toUpperCase()
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase()
    }
    return 'U'
  }

  const displayName = profile?.username || user?.email?.split('@')[0] || 'User'
  const username = profile?.username || user?.email?.split('@')[0] || 'user'

  return (
    <div
      className={cn(
        'bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-8 relative overflow-hidden',
        className
      )}
    >
      {/* Ambient blob behind avatar */}
      <div className="absolute -top-20 -left-20 w-60 h-60 bg-orange-500/20 rounded-full blur-3xl" />

      <div className="relative flex items-center gap-6">
        {/* Large uploadable avatar */}
        <button className="relative group">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
            {getUserInitials()}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
        </button>

        <div>
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">USER_ID</span>
          <h2 className="text-2xl font-bold text-white mt-1">{displayName}</h2>
          <p className="text-gray-400 mt-1">@{username}</p>
          <Badge variant="orange" className="mt-2">
            OPERATOR
          </Badge>
        </div>
      </div>

      {/* Editable fields with ghost/underline inputs */}
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-mono text-gray-500 uppercase tracking-wider block mb-2">
            DISPLAY_NAME
          </label>
          <input
            type="text"
            defaultValue={displayName}
            className="w-full bg-transparent border-b border-white/10 py-2 text-white focus:border-orange-500 outline-none transition-colors"
            placeholder="Enter display name"
          />
        </div>
        <div>
          <label className="text-xs font-mono text-gray-500 uppercase tracking-wider block mb-2">
            USERNAME
          </label>
          <input
            type="text"
            defaultValue={username}
            className="w-full bg-transparent border-b border-white/10 py-2 text-white focus:border-orange-500 outline-none transition-colors"
            placeholder="Enter username"
          />
        </div>
      </div>
    </div>
  )
}
