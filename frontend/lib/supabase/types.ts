export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          subscription_tier: 'free' | 'pro' | 'team'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          subscription_tier?: 'free' | 'pro' | 'team'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          subscription_tier?: 'free' | 'pro' | 'team'
          updated_at?: string
        }
      }
      songs: {
        Row: {
          id: string
          user_id: string
          title: string
          artist: string | null
          lyrics: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          artist?: string | null
          lyrics: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          artist?: string | null
          lyrics?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          user_id: string
          name: string
          event_date: string | null
          status: 'draft' | 'live' | 'ended'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          event_date?: string | null
          status?: 'draft' | 'live' | 'ended'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          event_date?: string | null
          status?: 'draft' | 'live' | 'ended'
          updated_at?: string
        }
      }
      event_items: {
        Row: {
          id: string
          event_id: string
          song_id: string
          sequence_order: number
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          song_id: string
          sequence_order: number
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          song_id?: string
          sequence_order?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
