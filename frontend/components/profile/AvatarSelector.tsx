'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { uploadAvatarToStorage, validateImageFile } from '@/lib/utils/avatarUpload'
import { useAuthStore } from '@/lib/stores/authStore'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'

interface AvatarOption {
  id: string
  emoji?: string
  image?: string
  name: string
}

// Emoji presets
const emojiAvatars: AvatarOption[] = [
  { id: 'rocket', emoji: '🚀', name: 'Rocket' },
  { id: 'planet', emoji: '🪐', name: 'Planet' },
  { id: 'star', emoji: '⭐', name: 'Star' },
  { id: 'galaxy', emoji: '🌌', name: 'Galaxy' },
  { id: 'moon', emoji: '🌙', name: 'Moon' },
  { id: 'comet', emoji: '☄️', name: 'Comet' },
  { id: 'satellite', emoji: '🛰️', name: 'Satellite' },
  { id: 'telescope', emoji: '🔭', name: 'Telescope' },
]

// Image presets
const imageAvatars: AvatarOption[] = [
  { id: 'preset:astronaut-helmet', image: '/avatars/presets/astronaut-helmet.png', name: 'Astronaut' },
  { id: 'preset:rocket-launch', image: '/avatars/presets/rocket-launch.png', name: 'Rocket Launch' },
  { id: 'preset:cosmic-energy', image: '/avatars/presets/cosmic-energy.png', name: 'Cosmic Energy' },
  { id: 'preset:futuristic-head', image: '/avatars/presets/futuristic-head.png', name: 'Futuristic' },
  { id: 'preset:holographic-cassette', image: '/avatars/presets/holographic-cassette.png', name: 'Cassette' },
  { id: 'preset:planet-rings', image: '/avatars/presets/planet-rings.png', name: 'Planet Rings' },
  { id: 'preset:energy-sphere', image: '/avatars/presets/energy-sphere.png', name: 'Energy Sphere' },
  { id: 'preset:cassette-tape', image: '/avatars/presets/cassette-tape.png', name: 'Tape' },
  { id: 'preset:saturn-planet', image: '/avatars/presets/saturn-planet.png', name: 'Saturn' },
  { id: 'preset:compass-hexagon', image: '/avatars/presets/compass-hexagon.png', name: 'Compass' },
]

interface AvatarSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatar: string | null
  onSelect: (avatarId: string) => void
}

type TabType = 'presets' | 'upload'

export function AvatarSelector({
  open,
  onOpenChange,
  currentAvatar,
  onSelect,
}: AvatarSelectorProps) {
  const { user } = useAuthStore()
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatar)
  const [activeTab, setActiveTab] = useState<TabType>('presets')
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync selectedAvatar with currentAvatar when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAvatar(currentAvatar)
      setPreviewUrl(null)
      setActiveTab('presets')
    }
  }, [open, currentAvatar])

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid file')
      return
    }

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setSelectedAvatar(null) // Clear preset selection when uploading
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !user) {
      toast.error('Please select an image file')
      return
    }

    setUploading(true)
    try {
      const publicUrl = await uploadAvatarToStorage(file, user.id)
      setSelectedAvatar(publicUrl)
      setPreviewUrl(null)
      toast.success('Avatar uploaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  const handleApply = () => {
    if (selectedAvatar) {
      onSelect(selectedAvatar)
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelectedAvatar(currentAvatar) // Reset to current
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  const isSelected = (avatarId: string) => {
    return selectedAvatar === avatarId
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl shadow-2xl text-white [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Choose Avatar
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('presets')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'presets'
                ? 'border-b-2 border-orange-500 text-orange-500'
                : 'text-gray-400 hover:text-white'
            )}
          >
            Presets
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'upload'
                ? 'border-b-2 border-orange-500 text-orange-500'
                : 'text-gray-400 hover:text-white'
            )}
          >
            Upload
          </button>
        </div>

        {/* Content */}
        <div className="py-4 max-h-[400px] overflow-y-auto">
          {activeTab === 'presets' && (
            <div className="space-y-6">
              {/* Emoji Presets */}
              <div>
                <p className="text-sm text-gray-400 mb-3">Emoji Avatars</p>
                <div className="grid grid-cols-4 gap-4">
                  {emojiAvatars.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                        'hover:bg-white/5',
                        isSelected(avatar.id)
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

              {/* Image Presets */}
              <div>
                <p className="text-sm text-gray-400 mb-3">Image Avatars</p>
                <div className="grid grid-cols-4 gap-4">
                  {imageAvatars.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all overflow-hidden',
                        'hover:bg-white/5',
                        isSelected(avatar.id)
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-white/10 bg-transparent'
                      )}
                    >
                      {avatar.image && (
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-white/5 flex items-center justify-center">
                          <Image
                            src={avatar.image}
                            alt={avatar.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <span className="text-xs text-gray-400 text-center">{avatar.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Upload an image from your device (Max 5MB, PNG, JPG, WEBP, GIF)
              </p>

              {/* File Input */}
              <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-orange-500/50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <Upload className="w-12 h-12 text-gray-400" />
                  <div>
                    <p className="text-white font-medium">Click to upload</p>
                    <p className="text-sm text-gray-400 mt-1">or drag and drop</p>
                  </div>
                </label>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-white/5 border-2 border-white/10">
                    {/* Use <img> for blob: previews (next/image doesn't support blob URLs reliably) */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="bg-gradient-to-r from-orange-500 to-red-600 text-white hover:opacity-90"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload Avatar'
                    )}
                  </Button>
                </div>
              )}

              {/* Show selected uploaded avatar */}
              {selectedAvatar && selectedAvatar.startsWith('http') && !previewUrl && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-white/5 border-2 border-orange-500">
                    {/* Use <img> for external URLs unless next/image remotePatterns are configured */}
                    <img
                      src={selectedAvatar}
                      alt="Current avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm text-gray-400">Current uploaded avatar</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
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
