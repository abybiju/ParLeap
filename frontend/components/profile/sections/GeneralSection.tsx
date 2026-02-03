'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProfileForm } from '@/lib/hooks/useProfileForm'
import { AvatarSelector } from '../AvatarSelector'

const spaceAvatars: Record<string, string> = {
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

export function GeneralSection() {
  const { user, profile } = useAuthStore()
  const {
    displayName,
    setDisplayName,
    username,
    setUsername,
    avatar,
    setAvatar,
    isDirty,
    isSaving,
    handleSave,
    handleCancel,
  } = useProfileForm()

  const [avatarSelectorOpen, setAvatarSelectorOpen] = useState(false)

  const getUserInitials = (): string => {
    if (profile?.username) {
      return profile.username.charAt(0).toUpperCase()
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase()
    }
    return 'U'
  }

  // Determine what to display for avatar
  const getAvatarDisplay = () => {
    if (!avatar) {
      return { type: 'initials' as const, value: getUserInitials() }
    }

    // Check if it's a preset image
    if (presetImageMap[avatar]) {
      return { type: 'preset-image' as const, value: presetImageMap[avatar] }
    }

    // Check if it's an emoji preset
    if (spaceAvatars[avatar]) {
      return { type: 'emoji' as const, value: spaceAvatars[avatar] }
    }

    // Check if it's a URL (uploaded image)
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return { type: 'url' as const, value: avatar }
    }

    // Fallback to initials
    return { type: 'initials' as const, value: getUserInitials() }
  }

  const avatarDisplay = getAvatarDisplay()

  return (
    <>
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-8">
        <div>
          <h2 className="text-xl font-semibold text-white">Public Profile</h2>
          <p className="text-sm text-gray-400 mt-1">This will be displayed on your profile</p>
        </div>

        <div className="border-b border-white/5 my-6" />

        {/* Avatar Row */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xl font-semibold text-white shadow-md overflow-hidden">
            {avatarDisplay.type === 'url' || avatarDisplay.type === 'preset-image' ? (
              <Image
                src={avatarDisplay.value}
                alt="Avatar"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : avatarDisplay.type === 'emoji' ? (
              <span>{avatarDisplay.value}</span>
            ) : (
              <span>{avatarDisplay.value}</span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-white font-medium">{displayName}</h3>
            <p className="text-sm text-gray-400">Operator</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setAvatarSelectorOpen(true)}
            className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Change Photo
          </Button>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-transparent border border-white/10 rounded-lg p-3 w-full text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-gray-600"
              placeholder="Enter display name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-transparent border border-white/10 rounded-lg p-3 w-full text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-gray-600"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-transparent border border-white/10 rounded-lg p-3 w-full text-white opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
        </div>

        {/* Save Actions */}
        {isDirty && (
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/5">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white hover:opacity-90"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      <AvatarSelector
        open={avatarSelectorOpen}
        onOpenChange={setAvatarSelectorOpen}
        currentAvatar={avatar}
        onSelect={setAvatar}
      />
    </>
  )
}
