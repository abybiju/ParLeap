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
          projector_font: string | null
          bible_mode: boolean
          bible_version_id: string | null
          background_image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          event_date?: string | null
          status?: 'draft' | 'live' | 'ended'
          projector_font?: string | null
          bible_mode?: boolean
          bible_version_id?: string | null
          background_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          event_date?: string | null
          status?: 'draft' | 'live' | 'ended'
          projector_font?: string | null
          bible_mode?: boolean
          bible_version_id?: string | null
          background_image_url?: string | null
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
      bible_versions: {
        Row: {
          id: string
          name: string
          abbrev: string
          language: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          abbrev: string
          language?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          abbrev?: string
          language?: string
          is_default?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bible_books: {
        Row: {
          id: string
          name: string
          abbrev: string
          book_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          abbrev: string
          book_order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          abbrev?: string
          book_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      bible_verses: {
        Row: {
          id: string
          version_id: string
          book_id: string
          chapter: number
          verse: number
          text: string
          search_text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          version_id: string
          book_id: string
          chapter: number
          verse: number
          text: string
          search_text: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          version_id?: string
          book_id?: string
          chapter?: number
          verse?: number
          text?: string
          search_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bible_verses_version_id_fkey'
            columns: ['version_id']
            isOneToOne: false
            referencedRelation: 'bible_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bible_verses_book_id_fkey'
            columns: ['book_id']
            isOneToOne: false
            referencedRelation: 'bible_books'
            referencedColumns: ['id']
          }
        ]
      }
      event_items: {
        Row: {
          id: string
          event_id: string
          song_id: string | null
          sequence_order: number
          item_type: 'SONG' | 'BIBLE' | 'MEDIA' | null
          bible_ref: string | null
          media_url: string | null
          media_title: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          song_id?: string | null
          sequence_order: number
          item_type?: 'SONG' | 'BIBLE' | 'MEDIA' | null
          bible_ref?: string | null
          media_url?: string | null
          media_title?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          song_id?: string | null
          sequence_order?: number
          item_type?: 'SONG' | 'BIBLE' | 'MEDIA' | null
          bible_ref?: string | null
          media_url?: string | null
          media_title?: string | null
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
