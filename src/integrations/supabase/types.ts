export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          created_at: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          name?: string
        }
        Relationships: []
      }
      boards: {
        Row: {
          access_code: string | null
          created_at: string
          id: string
          is_public: boolean | null
          member_ids: string[] | null
          name: string
          owner_id: string
          share_code: string
          updated_at: string | null
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          id?: string
          is_public?: boolean | null
          member_ids?: string[] | null
          name: string
          owner_id: string
          share_code: string
          updated_at?: string | null
        }
        Update: {
          access_code?: string | null
          created_at?: string
          id?: string
          is_public?: boolean | null
          member_ids?: string[] | null
          name?: string
          owner_id?: string
          share_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          memory_id: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          memory_id: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          memory_id?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_comments_memory_id"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_memory_id"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories_with_likes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_parent_id"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_user_profile_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          access_code: string | null
          board_id: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          event_date: string
          id: string
          is_liked: boolean | null
          is_video: boolean
          likes: number
          location: string | null
          media_url: string | null
          memory_type: string | null
          moderated_at: string | null
          moderation_score: number | null
          moderation_status: string | null
        }
        Insert: {
          access_code?: string | null
          board_id?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          event_date: string
          id?: string
          is_liked?: boolean | null
          is_video?: boolean
          likes?: number
          location?: string | null
          media_url?: string | null
          memory_type?: string | null
          moderated_at?: string | null
          moderation_score?: number | null
          moderation_status?: string | null
        }
        Update: {
          access_code?: string | null
          board_id?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          is_liked?: boolean | null
          is_video?: boolean
          likes?: number
          location?: string | null
          media_url?: string | null
          memory_type?: string | null
          moderated_at?: string | null
          moderation_score?: number | null
          moderation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memories_access_code_fkey"
            columns: ["access_code"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_drafts: {
        Row: {
          board_id: string | null
          content: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board_id?: string | null
          content: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          board_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_drafts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_likes: {
        Row: {
          created_at: string | null
          id: string
          memory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          memory_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          memory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_memory_likes_memory_id"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_memory_likes_memory_id"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories_with_likes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_memory_likes_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_media_items: {
        Row: {
          created_at: string
          id: string
          is_video: boolean
          memory_id: string
          order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_video?: boolean
          memory_id: string
          order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_video?: boolean
          memory_id?: string
          order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_media_items_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_media_items_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories_with_likes"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          confidence_score: number | null
          content_hash: string | null
          content_id: string | null
          content_type: string
          created_at: string | null
          flagged_categories: string[] | null
          id: string
          is_appropriate: boolean
          moderation_reason: string | null
          user_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          content_hash?: string | null
          content_id?: string | null
          content_type: string
          created_at?: string | null
          flagged_categories?: string[] | null
          id?: string
          is_appropriate: boolean
          moderation_reason?: string | null
          user_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          content_hash?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string | null
          flagged_categories?: string[] | null
          id?: string
          is_appropriate?: boolean
          moderation_reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_moderation_logs_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_boards: {
        Row: {
          board_id: string | null
          created_at: string | null
          id: string
          name: string | null
          owner_id: string
          share_code: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          owner_id: string
          share_code: string
        }
        Update: {
          board_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          owner_id?: string
          share_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_boards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          profile_picture_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name?: string
          profile_picture_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          profile_picture_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      memories_with_likes: {
        Row: {
          access_code: string | null
          board_id: string | null
          caption: string | null
          created_at: string | null
          created_by: string | null
          event_date: string | null
          id: string | null
          is_liked: boolean | null
          is_video: boolean | null
          likes: number | null
          location: string | null
          media_url: string | null
          memory_type: string | null
          moderated_at: string | null
          moderation_score: number | null
          moderation_status: string | null
          total_likes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memories_access_code_fkey"
            columns: ["access_code"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_board_member: {
        Args: { board_id: string; user_id: string }
        Returns: boolean
      }
      add_user_to_board: {
        Args: { board_share_code: string; user_id_param: string }
        Returns: boolean
      }
      add_user_to_board_by_share_code: {
        Args: { share_code_param: string; user_id_param?: string }
        Returns: Json
      }
      create_board_with_owner: {
        Args: {
          board_name: string
          owner_user_id: string
          access_code_param: string
          share_code_param: string
        }
        Returns: string
      }
      create_missing_user_profiles: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_empty_boards: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      remove_board_member: {
        Args: { board_id: string; user_id: string }
        Returns: boolean
      }
      rename_board: {
        Args: { board_id: string; new_name: string; user_id?: string }
        Returns: Json
      }
      uid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const