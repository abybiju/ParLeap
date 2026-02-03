'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AvatarOption {
  id: string
  emoji: string
  name: string
}

const spaceAvatars: AvatarOption[] = [
  { id: 'rocket', emoji: '🚀', name: 'Rocket' },
  { id: 'planet', emoji: '🪐', name: 'Planet' },
  { id: 'star', emoji: '⭐', name: 'Star' },
  { id: 'galaxy', emoji: '🌌', name: 'Galaxy' },
  { id: 'moon', emoji: '🌙', name: 'Moon' },
  { id: 'comet', emoji: '☄️', name: 'Comet' },
  { id: 'satellite', emoji: '🛰️', name: 'Satellite' },
  { id: 'telescope', emoji: '🔭', name: 'Telescope' },
]

interface AvatarSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatar: string | null
  onSelect: (avatarId: string) => void
}

export function AvatarSelector({
  open,
  onOpenChange,
  currentAvatar,
  onSelect,
}: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatar)

  // Sync selectedAvatar with currentAvatar when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAvatar(currentAvatar)
    }
  }, [open, currentAvatar])

  const handleApply = () => {
    if (selectedAvatar) {
      onSelect(selectedAvatar)
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelectedAvatar(currentAvatar) // Reset to current
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-2xl text-white [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Choose Avatar
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-400 mb-4">
            Select a space-themed avatar for your profile
          </p>

          <div className="grid grid-cols-4 gap-4">
            {spaceAvatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => setSelectedAvatar(avatar.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                  'hover:bg-white/5',
                  selectedAvatar === avatar.id
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-white/10 bg-transparent'
                )}
              >
                <span className="text-4xl">{avatar.emoji}</span>
                <span className="text-xs text-gray-400">{avatar.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-white/20 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedAvatar}
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white hover:opacity-90"
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
