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
      board_members: {
        Row: {
          board_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          board_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          board_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          access_code: string | null
          created_at: string
          id: string
          name: string | null
          owner_id: string | null
          share_code: string
          updated_at: string | null
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          id?: string
          name?: string | null
          owner_id?: string | null
          share_code: string
          updated_at?: string | null
        }
        Update: {
          access_code?: string | null
          created_at?: string
          id?: string
          name?: string | null
          owner_id?: string | null
          share_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      love_notes: {
        Row: {
          content: string
          created_at: string
          delivered: boolean
          id: string
          scheduled_for: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivered?: boolean
          id?: string
          scheduled_for: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered?: boolean
          id?: string
          scheduled_for?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          access_code: string | null
          board_id: string | null
          caption: string | null
          created_at: string
          event_date: string
          id: string
          is_liked: boolean | null
          is_video: boolean
          likes: number
          location: string | null
          media_url: string
        }
        Insert: {
          access_code?: string | null
          board_id?: string | null
          caption?: string | null
          created_at?: string
          event_date: string
          id?: string
          is_liked?: boolean | null
          is_video?: boolean
          likes?: number
          location?: string | null
          media_url: string
        }
        Update: {
          access_code?: string | null
          board_id?: string | null
          caption?: string | null
          created_at?: string
          event_date?: string
          id?: string
          is_liked?: boolean | null
          is_video?: boolean
          likes?: number
          location?: string | null
          media_url?: string
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
            foreignKeyName: "memories_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
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
            foreignKeyName: "shared_boards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_user_to_board: {
        Args: { board_share_code: string; user_id_param: string }
        Returns: boolean
      }
      add_user_to_board_by_share_code: {
        Args: { share_code_param: string; user_id_param?: string }
        Returns: Json
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
