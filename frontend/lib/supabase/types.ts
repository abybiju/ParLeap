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
          avatar: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          subscription_tier?: 'free' | 'pro' | 'team'
          avatar?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          subscription_tier?: 'free' | 'pro' | 'team'
          avatar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          id: string
          user_id: string
          title: string
          artist: string | null
          lyrics: string
          ccli_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          artist?: string | null
          lyrics: string
          ccli_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          artist?: string | null
          lyrics?: string
          ccli_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'songs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'event_items_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_items_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          }
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
