import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  error: string | null
  fetchUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: false,
  error: null,

  fetchUser: async () => {
    set({ isLoading: true, error: null })
    const supabase = createClient()
    const { data: sessionData, error: sessionError } = await supabase.auth.getUser()

    if (sessionError || !sessionData.user) {
      set({ user: null, profile: null, isLoading: false, error: sessionError?.message ?? null })
      return
    }

    const user = sessionData.user
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({
      user,
      profile: profileError ? null : profileData,
      isLoading: false,
      error: profileError?.message ?? null,
    })
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ isLoading: false, error: error.message })
      return
    }
    await useAuthStore.getState().fetchUser()
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      set({ isLoading: false, error: error.message })
      return
    }
    set({ user: null, profile: null, isLoading: false, error: null })
  },
}))
