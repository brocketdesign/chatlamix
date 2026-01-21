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
          email: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      characters: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string
          thumbnail: string | null
          category: string
          is_public: boolean
          personality: Json | null
          physical_attributes: Json | null
          tags: string[] | null
          main_face_image: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description: string
          thumbnail?: string | null
          category: string
          is_public?: boolean
          personality?: Json | null
          physical_attributes?: Json | null
          tags?: string[] | null
          main_face_image?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string
          thumbnail?: string | null
          category?: string
          is_public?: boolean
          personality?: Json | null
          physical_attributes?: Json | null
          tags?: string[] | null
          main_face_image?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      character_images: {
        Row: {
          id: string
          character_id: string
          image_url: string
          prompt: string | null
          is_main_face: boolean
          settings: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          character_id: string
          image_url: string
          prompt?: string | null
          is_main_face?: boolean
          settings?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          image_url?: string
          prompt?: string | null
          is_main_face?: boolean
          settings?: Json | null
          created_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          character_id: string
          user_id: string
          relationship_progress: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          user_id: string
          relationship_progress?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          user_id?: string
          relationship_progress?: number
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          character_id: string
          user_id: string
          sender: 'user' | 'character'
          text: string
          emotion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          character_id: string
          user_id: string
          sender: 'user' | 'character'
          text: string
          emotion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          character_id?: string
          user_id?: string
          sender?: 'user' | 'character'
          text?: string
          emotion?: string | null
          created_at?: string
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
