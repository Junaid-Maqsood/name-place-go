export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          category: string
          created_at: string
          game_id: string
          id: string
          player_id: string
          points: number
          round: number
          status: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          game_id: string
          id?: string
          player_id: string
          points?: number
          round: number
          status?: string
          value?: string
        }
        Update: {
          category?: string
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
          points?: number
          round?: number
          status?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          game_id: string
          id: string
          kind: string
          nickname: string
          player_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          game_id: string
          id?: string
          kind?: string
          nickname: string
          player_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          game_id?: string
          id?: string
          kind?: string
          nickname?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_bans: {
        Row: {
          created_at: string
          game_id: string
          id: string
          kick_count: number
          nickname: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          kick_count?: number
          nickname: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          kick_count?: number
          nickname?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          categories: string[]
          created_at: string
          current_letter: string | null
          current_round: number
          difficulty: string
          finish_countdown: number
          finish_triggered_at: string | null
          host_player_id: string | null
          id: string
          num_rounds: number
          round_seconds: number
          round_started_at: string | null
          status: string
          used_letters: string[]
        }
        Insert: {
          categories?: string[]
          created_at?: string
          current_letter?: string | null
          current_round?: number
          difficulty?: string
          finish_countdown?: number
          finish_triggered_at?: string | null
          host_player_id?: string | null
          id: string
          num_rounds?: number
          round_seconds?: number
          round_started_at?: string | null
          status?: string
          used_letters?: string[]
        }
        Update: {
          categories?: string[]
          created_at?: string
          current_letter?: string | null
          current_round?: number
          difficulty?: string
          finish_countdown?: number
          finish_triggered_at?: string | null
          host_player_id?: string | null
          id?: string
          num_rounds?: number
          round_seconds?: number
          round_started_at?: string | null
          status?: string
          used_letters?: string[]
        }
        Relationships: []
      }
      players: {
        Row: {
          connected: boolean
          emoji: string
          finished_round: boolean
          game_id: string
          id: string
          is_bot: boolean
          joined_at: string
          kick_count: number
          nickname: string
          score: number
        }
        Insert: {
          connected?: boolean
          emoji?: string
          finished_round?: boolean
          game_id: string
          id?: string
          is_bot?: boolean
          joined_at?: string
          kick_count?: number
          nickname: string
          score?: number
        }
        Update: {
          connected?: boolean
          emoji?: string
          finished_round?: boolean
          game_id?: string
          id?: string
          is_bot?: boolean
          joined_at?: string
          kick_count?: number
          nickname?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
