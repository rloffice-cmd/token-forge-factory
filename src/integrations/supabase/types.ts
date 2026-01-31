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
          safe_address: string | null
          safe_tx_hash: string | null
          signed_at: string | null
          status: string
          submitted_at: string | null
          to_wallet_address: string | null
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
          safe_address?: string | null
          safe_tx_hash?: string | null
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          to_wallet_address?: string | null
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
          safe_address?: string | null
          safe_tx_hash?: string | null
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          to_wallet_address?: string | null
          tx_hash?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      credit_packs: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          description_he: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          name_he: string
          price_usd: number
        }
        Insert: {
          created_at?: string
          credits: number
          description?: string | null
          description_he?: string | null
          features?: Json | null
          id: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          name_he: string
          price_usd: number
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          description_he?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          name_he?: string
          price_usd?: number
        }
        Relationships: []
      }
      credit_wallets: {
        Row: {
          created_at: string
          credits_balance: number
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_balance?: number
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_balance?: number
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_wallets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
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
          cost_credits: number | null
          created_at: string
          customer_id: string | null
          id: string
          iteration: number
          payment_id: string | null
          score: number | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          cost_credits?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          iteration?: number
          payment_id?: string | null
          score?: number | null
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          cost_credits?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          iteration?: number
          payment_id?: string | null
          score?: number | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_eth: number | null
          amount_usd: number
          charge_code: string | null
          charge_id: string | null
          confirmed_at: string | null
          created_at: string
          credits_purchased: number
          customer_id: string
          hosted_url: string | null
          id: string
          metadata: Json | null
          pack_id: string | null
          provider: string
          status: string
        }
        Insert: {
          amount_eth?: number | null
          amount_usd: number
          charge_code?: string | null
          charge_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          credits_purchased?: number
          customer_id: string
          hosted_url?: string | null
          id?: string
          metadata?: Json | null
          pack_id?: string | null
          provider?: string
          status?: string
        }
        Update: {
          amount_eth?: number | null
          amount_usd?: number
          charge_code?: string | null
          charge_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          credits_purchased?: number
          customer_id?: string
          hosted_url?: string | null
          id?: string
          metadata?: Json | null
          pack_id?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
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
          direction: string
          id: string
          job_id: string
          tx_hash: string | null
        }
        Insert: {
          amount: number
          asset?: string
          created_at?: string
          direction?: string
          id?: string
          job_id: string
          tx_hash?: string | null
        }
        Update: {
          amount?: number
          asset?: string
          created_at?: string
          direction?: string
          id?: string
          job_id?: string
          tx_hash?: string | null
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
      treasury_settings: {
        Row: {
          alert_threshold_dtf: number | null
          created_at: string
          id: string
          min_withdrawal_eth: number
          network: string
          payout_wallet_address: string | null
          treasury_safe_address: string | null
          updated_at: string
        }
        Insert: {
          alert_threshold_dtf?: number | null
          created_at?: string
          id?: string
          min_withdrawal_eth?: number
          network?: string
          payout_wallet_address?: string | null
          treasury_safe_address?: string | null
          updated_at?: string
        }
        Update: {
          alert_threshold_dtf?: number | null
          created_at?: string
          id?: string
          min_withdrawal_eth?: number
          network?: string
          payout_wallet_address?: string | null
          treasury_safe_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      treasury_wallet: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string | null
          network: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label?: string | null
          network?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string | null
          network?: string
        }
        Relationships: []
      }
      users_customers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
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
