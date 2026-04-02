export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type VideoRequestStatus = 'pending' | 'filming' | 'ready'

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          headline: string
          brand: string | null
          price: number | null
          images: string[]
          jtbd_tags: string[]
          outcomes: Json
          specs: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          headline: string
          brand?: string | null
          price?: number | null
          images?: string[]
          jtbd_tags?: string[]
          outcomes?: Json
          specs?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          headline?: string
          brand?: string | null
          price?: number | null
          images?: string[]
          jtbd_tags?: string[]
          outcomes?: Json
          specs?: Json
          created_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          name: string
          statement: string
          context_questions: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          statement: string
          context_questions?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          statement?: string
          context_questions?: Json
          created_at?: string
        }
      }
      video_requests: {
        Row: {
          id: string
          user_id: string
          product_id: string
          job_id: string | null
          question: string | null
          status: VideoRequestStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          job_id?: string | null
          question?: string | null
          status?: VideoRequestStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          job_id?: string | null
          question?: string | null
          status?: VideoRequestStatus
          created_at?: string
          updated_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          product_id: string
          job_id: string | null
          expert_id: string | null
          url: string
          duration_sec: number | null
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          job_id?: string | null
          expert_id?: string | null
          url: string
          duration_sec?: number | null
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          job_id?: string | null
          expert_id?: string | null
          url?: string
          duration_sec?: number | null
          is_public?: boolean
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      video_request_status: VideoRequestStatus
    }
  }
}
