import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/authStore'
import { toast } from 'sonner'

export function useProfileForm() {
  const { user, profile, fetchUser } = useAuthStore()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize from profile
  useEffect(() => {
    if (profile) {
      const initialDisplayName = profile.username || user?.email?.split('@')[0] || ''
      setDisplayName(initialDisplayName)
      setUsername(profile.username || '')
      setAvatar(profile.avatar || null)
    }
  }, [profile, user])

  const isDirty =
    displayName !== (profile?.username || user?.email?.split('@')[0] || '') ||
    username !== (profile?.username || '') ||
    avatar !== (profile?.avatar || null)

  const handleCancel = () => {
    if (profile) {
      const initialDisplayName = profile.username || user?.email?.split('@')[0] || ''
      setDisplayName(initialDisplayName)
      setUsername(profile.username || '')
      setAvatar(profile.avatar || null)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    const supabase = createClient()

    try {
      const { error } = await (supabase
        .from('profiles') as ReturnType<typeof supabase.from>)
        .update({
          username: username || null,
          avatar: avatar || null,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', user.id)

      if (error) {
        toast.error('Failed to update profile: ' + error.message)
      } else {
        await fetchUser()
        toast.success('Profile updated successfully')
      }
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return {
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
  }
}
