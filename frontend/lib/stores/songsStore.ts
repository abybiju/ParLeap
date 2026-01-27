import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

type Song = Database['public']['Tables']['songs']['Row'];

interface SongsState {
  songs: Song[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchSongs: () => Promise<void>;
  addSong: (song: Omit<Song, 'id' | 'created_at' | 'updated_at'>) => Promise<Song | null>;
  updateSong: (id: string, updates: Partial<Omit<Song, 'id' | 'created_at' | 'updated_at'>>) => Promise<Song | null>;
  deleteSong: (id: string) => Promise<boolean>;
  searchSongs: (query: string) => Song[];
  getSongById: (id: string) => Song | null;
  clearError: () => void;
}

export const useSongsStore = create<SongsState>((set, get) => ({
  songs: [],
  loading: false,
  error: null,

  fetchSongs: async () => {
    set({ loading: true, error: null });
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ loading: false, error: 'Not authenticated' });
      return;
    }

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', user.id)
      .order('title', { ascending: true });

    if (error) {
      set({ loading: false, error: error.message, songs: [] });
      return;
    }

    set({ loading: false, error: null, songs: data || [] });
  },

  addSong: async (songData) => {
    set({ loading: true, error: null });
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ loading: false, error: 'Not authenticated' });
      return null;
    }

    const { data, error } = await supabase
      .from('songs')
      .insert({
        ...songData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      return null;
    }

    // Update local state
    const currentSongs = get().songs;
    set({ 
      loading: false, 
      error: null, 
      songs: [...currentSongs, data].sort((a, b) => a.title.localeCompare(b.title))
    });

    return data;
  },

  updateSong: async (id, updates) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { data, error } = await supabase
      .from('songs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      return null;
    }

    // Update local state
    const currentSongs = get().songs;
    set({ 
      loading: false, 
      error: null, 
      songs: currentSongs.map(song => song.id === id ? data : song)
    });

    return data;
  },

  deleteSong: async (id) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', id);

    if (error) {
      set({ loading: false, error: error.message });
      return false;
    }

    // Update local state
    const currentSongs = get().songs;
    set({ 
      loading: false, 
      error: null, 
      songs: currentSongs.filter(song => song.id !== id)
    });

    return true;
  },

  searchSongs: (query) => {
    const { songs } = get();
    if (!query.trim()) return songs;

    const lowerQuery = query.toLowerCase();
    return songs.filter(song => 
      song.title.toLowerCase().includes(lowerQuery) ||
      (song.artist && song.artist.toLowerCase().includes(lowerQuery))
    );
  },

  getSongById: (id) => {
    const { songs } = get();
    return songs.find(song => song.id === id) || null;
  },

  clearError: () => {
    set({ error: null });
  },
}));
