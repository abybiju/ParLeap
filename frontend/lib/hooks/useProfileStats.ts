import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/authStore'

interface ProfileStats {
  eventsRun: number
  songsAdded: number
  storageUsed: string // Formatted as "X.X GB"
  isLoading: boolean
  error: string | null
}

export function useProfileStats(): ProfileStats {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<ProfileStats>({
    eventsRun: 0,
    songsAdded: 0,
    storageUsed: '0 GB',
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    if (!user) {
      setStats(prev => ({ ...prev, isLoading: false }))
      return
    }

    const fetchStats = async () => {
      const supabase = createClient()
      
      try {
        // Fetch events count (live or ended)
        const { count: eventsCount } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('status', ['live', 'ended'])

        // Fetch songs count
        const { count: songsCount } = await supabase
          .from('songs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        // Calculate storage from lyrics
        const { data: songs } = await supabase
          .from('songs')
          .select('lyrics')
          .eq('user_id', user.id)

        const totalBytes = (songs as { lyrics: string }[] | null)?.reduce((acc, song) => {
          return acc + new Blob([song.lyrics]).size
        }, 0) || 0

        const storageGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2)

        setStats({
          eventsRun: eventsCount || 0,
          songsAdded: songsCount || 0,
          storageUsed: `${storageGB} GB`,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch stats',
        }))
      }
    }

    fetchStats()
  }, [user])

  return stats
}
