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
        'bg-white/5 border border-gray-200/20 rounded-xl p-8 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-6">
        {/* Large uploadable avatar */}
        <button className="relative group">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-2xl font-semibold text-white shadow-md">
            {getUserInitials()}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>

        <div>
          <h2 className="text-2xl font-semibold text-white">{displayName}</h2>
          <p className="text-gray-400 mt-1">@{username}</p>
          <Badge variant="orange" className="mt-2">
            Operator
          </Badge>
        </div>
      </div>

      {/* Editable fields with ghost/underline inputs */}
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm text-gray-400 block mb-2">
            Display Name
          </label>
          <input
            type="text"
            defaultValue={displayName}
            className="w-full bg-transparent border-b border-gray-200/20 py-2 text-white focus:border-gray-400 outline-none transition-colors"
            placeholder="Enter display name"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-2">
            Username
          </label>
          <input
            type="text"
            defaultValue={username}
            className="w-full bg-transparent border-b border-gray-200/20 py-2 text-white focus:border-gray-400 outline-none transition-colors"
            placeholder="Enter username"
          />
        </div>
      </div>
    </div>
  )
}
