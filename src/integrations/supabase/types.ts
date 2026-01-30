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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      artifacts: {
        Row: {
          content: string
          created_at: string
          id: string
          job_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          job_id: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          job_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          job_id: string
          metadata: Json
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          job_id: string
          metadata?: Json
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          job_id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cashout_requests: {
        Row: {
          amount_dtf: number
          amount_eth: number | null
          amount_usd: number
          confirmed_at: string | null
          created_at: string
          error_message: string | null
          eth_price_usd: number | null
          id: string
          network: string
          signed_at: string | null
          status: string
          submitted_at: string | null
          tx_hash: string | null
          wallet_address: string
        }
        Insert: {
          amount_dtf: number
          amount_eth?: number | null
          amount_usd: number
          confirmed_at?: string | null
          created_at?: string
          error_message?: string | null
          eth_price_usd?: number | null
          id?: string
          network?: string
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          tx_hash?: string | null
          wallet_address: string
        }
        Update: {
          amount_dtf?: number
          amount_eth?: number | null
          amount_usd?: number
          confirmed_at?: string | null
          created_at?: string
          error_message?: string | null
          eth_price_usd?: number | null
          id?: string
          network?: string
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          tx_hash?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      failure_insights: {
        Row: {
          confidence: number
          created_at: string
          evidence: Json
          failure_category: string | null
          failure_type: string
          id: string
          job_id: string
          pattern_signature: string | null
          root_cause: string
          task_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence?: Json
          failure_category?: string | null
          failure_type: string
          id?: string
          job_id: string
          pattern_signature?: string | null
          root_cause: string
          task_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence?: Json
          failure_category?: string | null
          failure_type?: string
          id?: string
          job_id?: string
          pattern_signature?: string | null
          root_cause?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failure_insights_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failure_insights_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          iteration: number
          score: number | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          iteration?: number
          score?: number | null
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          iteration?: number
          score?: number | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          id: string
          name: string
          policy_json: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          policy_json: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          policy_json?: Json
        }
        Relationships: []
      }
      treasury_ledger: {
        Row: {
          amount: number
          asset: string
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          amount: number
          asset?: string
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          amount?: number
          asset?: string
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
