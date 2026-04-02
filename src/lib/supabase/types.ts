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
        Relationships: []
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
        Relationships: []
      }
      video_requests: {
        Row: {
          id: string
          user_id: string
          product_id: string
          job_id: string | null
          question: string | null
          status: 'pending' | 'filming' | 'ready'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          job_id?: string | null
          question?: string | null
          status?: 'pending' | 'filming' | 'ready'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          job_id?: string | null
          question?: string | null
          status?: 'pending' | 'filming' | 'ready'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
      video_request_status: 'pending' | 'filming' | 'ready'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
