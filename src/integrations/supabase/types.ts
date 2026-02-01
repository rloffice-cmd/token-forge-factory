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
      api_key_deliveries: {
        Row: {
          api_key_id: string
          created_at: string
          customer_id: string
          delivered: boolean | null
          expires_at: string
          id: string
          plaintext_key: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          customer_id: string
          delivered?: boolean | null
          expires_at: string
          id?: string
          plaintext_key: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          customer_id?: string
          delivered?: boolean | null
          expires_at?: string
          id?: string
          plaintext_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_deliveries_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_key_deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          key_hash: string
          key_prefix: string
          label: string | null
          last_used_at: string | null
          plan: string | null
          quota_monthly: number | null
          quota_reset_at: string | null
          rate_limit_tier: string
          revoked_at: string | null
          revoked_reason: string | null
          status: string
          used_monthly: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string | null
          last_used_at?: string | null
          plan?: string | null
          quota_monthly?: number | null
          quota_reset_at?: string | null
          rate_limit_tier?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          used_monthly?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string | null
          last_used_at?: string | null
          plan?: string | null
          quota_monthly?: number | null
          quota_reset_at?: string | null
          rate_limit_tier?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          used_monthly?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_requests: {
        Row: {
          api_key_id: string
          chain: string
          confidence: number
          created_at: string
          credits_charged: number
          customer_id: string
          decision: string
          endpoint: string
          flags: string[]
          id: string
          ip: string | null
          response_time_ms: number | null
          result_json: Json
          risk_score: number
          target_address: string
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          chain?: string
          confidence: number
          created_at?: string
          credits_charged: number
          customer_id: string
          decision: string
          endpoint: string
          flags?: string[]
          id?: string
          ip?: string | null
          response_time_ms?: number | null
          result_json: Json
          risk_score: number
          target_address: string
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          chain?: string
          confidence?: number
          created_at?: string
          credits_charged?: number
          customer_id?: string
          decision?: string
          endpoint?: string
          flags?: string[]
          id?: string
          ip?: string | null
          response_time_ms?: number | null
          result_json?: Json
          risk_score?: number
          target_address?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_requests_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      auto_offer_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          offer_reason: string
          priority: number
          rule_name: string
          rule_type: string
          threshold_unit: string
          threshold_value: number
          time_window_hours: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          offer_reason: string
          priority?: number
          rule_name: string
          rule_type: string
          threshold_unit?: string
          threshold_value: number
          time_window_hours?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          offer_reason?: string
          priority?: number
          rule_name?: string
          rule_type?: string
          threshold_unit?: string
          threshold_value?: number
          time_window_hours?: number
        }
        Relationships: []
      }
      brain_settings: {
        Row: {
          allowed_contracts: Json
          allowed_functions: Json
          auto_approve_threshold: number
          auto_closing_enabled: boolean
          auto_swap_enabled: boolean
          auto_sweep_enabled: boolean
          brain_enabled: boolean
          created_at: string
          emergency_stop: boolean
          fulfillment_enabled: boolean
          id: boolean
          last_sweep_at: string | null
          max_daily_outreach: number
          max_daily_txs: number
          max_daily_value_usd: number
          max_value_per_tx_usd: number
          min_opportunity_value_usd: number
          outreach_enabled: boolean
          payout_wallet_address: string | null
          scan_enabled: boolean
          session_rotate_if_hours_left: number
          session_rotation_enabled: boolean
          session_ttl_hours: number
          treasury_target_asset: string
          treasury_target_network: string
          updated_at: string
        }
        Insert: {
          allowed_contracts?: Json
          allowed_functions?: Json
          auto_approve_threshold?: number
          auto_closing_enabled?: boolean
          auto_swap_enabled?: boolean
          auto_sweep_enabled?: boolean
          brain_enabled?: boolean
          created_at?: string
          emergency_stop?: boolean
          fulfillment_enabled?: boolean
          id?: boolean
          last_sweep_at?: string | null
          max_daily_outreach?: number
          max_daily_txs?: number
          max_daily_value_usd?: number
          max_value_per_tx_usd?: number
          min_opportunity_value_usd?: number
          outreach_enabled?: boolean
          payout_wallet_address?: string | null
          scan_enabled?: boolean
          session_rotate_if_hours_left?: number
          session_rotation_enabled?: boolean
          session_ttl_hours?: number
          treasury_target_asset?: string
          treasury_target_network?: string
          updated_at?: string
        }
        Update: {
          allowed_contracts?: Json
          allowed_functions?: Json
          auto_approve_threshold?: number
          auto_closing_enabled?: boolean
          auto_swap_enabled?: boolean
          auto_sweep_enabled?: boolean
          brain_enabled?: boolean
          created_at?: string
          emergency_stop?: boolean
          fulfillment_enabled?: boolean
          id?: boolean
          last_sweep_at?: string | null
          max_daily_outreach?: number
          max_daily_txs?: number
          max_daily_value_usd?: number
          max_value_per_tx_usd?: number
          min_opportunity_value_usd?: number
          outreach_enabled?: boolean
          payout_wallet_address?: string | null
          scan_enabled?: boolean
          session_rotate_if_hours_left?: number
          session_rotation_enabled?: boolean
          session_ttl_hours?: number
          treasury_target_asset?: string
          treasury_target_network?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_experiments: {
        Row: {
          auto_implement_winner: boolean | null
          control_variant: Json
          created_at: string
          ended_at: string | null
          experiment_type: string
          hypothesis: string
          id: string
          implemented_at: string | null
          minimum_sample_size: number | null
          name: string
          primary_metric: string
          results: Json | null
          scheduled_end_at: string | null
          secondary_metrics: string[] | null
          started_at: string | null
          statistical_significance: number | null
          status: string | null
          test_variants: Json
          traffic_split: Json | null
          winner_variant: string | null
        }
        Insert: {
          auto_implement_winner?: boolean | null
          control_variant: Json
          created_at?: string
          ended_at?: string | null
          experiment_type: string
          hypothesis: string
          id?: string
          implemented_at?: string | null
          minimum_sample_size?: number | null
          name: string
          primary_metric: string
          results?: Json | null
          scheduled_end_at?: string | null
          secondary_metrics?: string[] | null
          started_at?: string | null
          statistical_significance?: number | null
          status?: string | null
          test_variants?: Json
          traffic_split?: Json | null
          winner_variant?: string | null
        }
        Update: {
          auto_implement_winner?: boolean | null
          control_variant?: Json
          created_at?: string
          ended_at?: string | null
          experiment_type?: string
          hypothesis?: string
          id?: string
          implemented_at?: string | null
          minimum_sample_size?: number | null
          name?: string
          primary_metric?: string
          results?: Json | null
          scheduled_end_at?: string | null
          secondary_metrics?: string[] | null
          started_at?: string | null
          statistical_significance?: number | null
          status?: string | null
          test_variants?: Json
          traffic_split?: Json | null
          winner_variant?: string | null
        }
        Relationships: []
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
      closing_attempts: {
        Row: {
          action: string
          charge_id: string | null
          checkout_url: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata_json: Json | null
          opportunity_id: string
          payment_id: string | null
          result: string
        }
        Insert: {
          action: string
          charge_id?: string | null
          checkout_url?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata_json?: Json | null
          opportunity_id: string
          payment_id?: string | null
          result?: string
        }
        Update: {
          action?: string
          charge_id?: string | null
          checkout_url?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata_json?: Json | null
          opportunity_id?: string
          payment_id?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "closing_attempts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "confirmed_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      content_queue: {
        Row: {
          body: string
          content_type: string
          context: string | null
          created_at: string
          cta: string | null
          hashtags: string[] | null
          id: string
          performance_data: Json | null
          platform: string
          product: string | null
          published_at: string | null
          published_url: string | null
          scheduled_for: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          content_type: string
          context?: string | null
          created_at?: string
          cta?: string | null
          hashtags?: string[] | null
          id?: string
          performance_data?: Json | null
          platform: string
          product?: string | null
          published_at?: string | null
          published_url?: string | null
          scheduled_for?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          content_type?: string
          context?: string | null
          created_at?: string
          cta?: string | null
          hashtags?: string[] | null
          id?: string
          performance_data?: Json | null
          platform?: string
          product?: string | null
          published_at?: string | null
          published_url?: string | null
          scheduled_for?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_events: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          metadata: Json | null
          ref_id: string | null
          source: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          metadata?: Json | null
          ref_id?: string | null
          source: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          metadata?: Json | null
          ref_id?: string | null
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
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
          total_credits_burned: number | null
          total_credits_purchased: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_balance?: number
          customer_id: string
          id?: string
          total_credits_burned?: number | null
          total_credits_purchased?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_balance?: number
          customer_id?: string
          id?: string
          total_credits_burned?: number | null
          total_credits_purchased?: number | null
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
      demand_signals: {
        Row: {
          category: string | null
          created_at: string
          detected_at: string
          external_id: string | null
          id: string
          payload_json: Json
          query_text: string
          rejection_reason: string | null
          relevance_score: number | null
          source_id: string | null
          source_url: string | null
          status: string
          urgency_score: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          detected_at?: string
          external_id?: string | null
          id?: string
          payload_json?: Json
          query_text: string
          rejection_reason?: string | null
          relevance_score?: number | null
          source_id?: string | null
          source_url?: string | null
          status?: string
          urgency_score?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          detected_at?: string
          external_id?: string | null
          id?: string
          payload_json?: Json
          query_text?: string
          rejection_reason?: string | null
          relevance_score?: number | null
          source_id?: string | null
          source_url?: string | null
          status?: string
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_signals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "offer_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      denylist: {
        Row: {
          active: boolean | null
          blocked_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          reason: string | null
          type: string
          value: string
        }
        Insert: {
          active?: boolean | null
          blocked_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          type: string
          value: string
        }
        Update: {
          active?: boolean | null
          blocked_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          type?: string
          value?: string
        }
        Relationships: []
      }
      endpoint_costs: {
        Row: {
          cost_credits: number
          created_at: string
          description: string | null
          endpoint_name: string
          is_active: boolean | null
        }
        Insert: {
          cost_credits: number
          created_at?: string
          description?: string | null
          endpoint_name: string
          is_active?: boolean | null
        }
        Update: {
          cost_credits?: number
          created_at?: string
          description?: string | null
          endpoint_name?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      engine_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
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
      fulfillment_jobs: {
        Row: {
          api_key_id: string | null
          artifact_url: string | null
          created_at: string
          delivered_at: string | null
          delivery_email: string | null
          delivery_type: string
          error_message: string | null
          fulfillment_type: string | null
          id: string
          offer_id: string | null
          opportunity_id: string | null
          output: Json | null
          payment_id: string
          queued_at: string
          started_at: string | null
          status: string
        }
        Insert: {
          api_key_id?: string | null
          artifact_url?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_email?: string | null
          delivery_type: string
          error_message?: string | null
          fulfillment_type?: string | null
          id?: string
          offer_id?: string | null
          opportunity_id?: string | null
          output?: Json | null
          payment_id: string
          queued_at?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          api_key_id?: string | null
          artifact_url?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_email?: string | null
          delivery_type?: string
          error_message?: string | null
          fulfillment_type?: string | null
          id?: string
          offer_id?: string | null
          opportunity_id?: string | null
          output?: Json | null
          payment_id?: string
          queued_at?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_jobs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_jobs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_jobs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_jobs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "confirmed_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_jobs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_offers: {
        Row: {
          charge_id: string | null
          created_at: string
          customer_id: string
          estimated_monthly_loss_usd: number
          expires_at: string
          id: string
          paid_at: string | null
          payment_link: string | null
          price_usd: number
          reason: string
          sent_at: string | null
          status: string
          viewed_at: string | null
        }
        Insert: {
          charge_id?: string | null
          created_at?: string
          customer_id: string
          estimated_monthly_loss_usd?: number
          expires_at?: string
          id?: string
          paid_at?: string | null
          payment_link?: string | null
          price_usd?: number
          reason: string
          sent_at?: string | null
          status?: string
          viewed_at?: string | null
        }
        Update: {
          charge_id?: string | null
          created_at?: string
          customer_id?: string
          estimated_monthly_loss_usd?: number
          expires_at?: string
          id?: string
          paid_at?: string | null
          payment_link?: string | null
          price_usd?: number
          reason?: string
          sent_at?: string | null
          status?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      improvement_suggestions: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          description: string
          evidence: Json | null
          id: string
          implemented_at: string | null
          priority: string
          source: string
          status: string
          title: string
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string
          description: string
          evidence?: Json | null
          id?: string
          implemented_at?: string | null
          priority?: string
          source: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          description?: string
          evidence?: Json | null
          id?: string
          implemented_at?: string | null
          priority?: string
          source?: string
          status?: string
          title?: string
        }
        Relationships: []
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
            referencedRelation: "confirmed_payments"
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
      leads: {
        Row: {
          acquisition_campaign: string | null
          acquisition_channel: string | null
          author: string | null
          budget_signals: string | null
          company: string | null
          composite_score: number | null
          content: string | null
          converted_at: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          engagement_score: number | null
          first_contact_at: string | null
          funnel_stage: string | null
          id: string
          intent_score: number | null
          interests: Json | null
          keywords_matched: string[] | null
          last_contact_at: string | null
          lifetime_value_usd: number | null
          notes: string | null
          pain_points: Json | null
          raw_data: Json | null
          referred_by: string | null
          relevance_score: number | null
          source: string
          source_id: string | null
          source_type: string | null
          source_url: string | null
          status: string
          tags: string[] | null
          tech_stack: Json | null
          title: string | null
          updated_at: string
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          acquisition_campaign?: string | null
          acquisition_channel?: string | null
          author?: string | null
          budget_signals?: string | null
          company?: string | null
          composite_score?: number | null
          content?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          engagement_score?: number | null
          first_contact_at?: string | null
          funnel_stage?: string | null
          id?: string
          intent_score?: number | null
          interests?: Json | null
          keywords_matched?: string[] | null
          last_contact_at?: string | null
          lifetime_value_usd?: number | null
          notes?: string | null
          pain_points?: Json | null
          raw_data?: Json | null
          referred_by?: string | null
          relevance_score?: number | null
          source: string
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          tech_stack?: Json | null
          title?: string | null
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          acquisition_campaign?: string | null
          acquisition_channel?: string | null
          author?: string | null
          budget_signals?: string | null
          company?: string | null
          composite_score?: number | null
          content?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          engagement_score?: number | null
          first_contact_at?: string | null
          funnel_stage?: string | null
          id?: string
          intent_score?: number | null
          interests?: Json | null
          keywords_matched?: string[] | null
          last_contact_at?: string | null
          lifetime_value_usd?: number | null
          notes?: string | null
          pain_points?: Json | null
          raw_data?: Json | null
          referred_by?: string | null
          relevance_score?: number | null
          source?: string
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          tech_stack?: Json | null
          title?: string | null
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_events: {
        Row: {
          actual_impact: Json | null
          change_description: string
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          expected_impact: Json | null
          id: string
          is_reversible: boolean | null
          measured_at: string | null
          new_state: Json | null
          previous_state: Json | null
          rollback_reason: string | null
          rolled_back_at: string | null
          trigger_insight_id: string | null
          trigger_reason: string | null
        }
        Insert: {
          actual_impact?: Json | null
          change_description: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          expected_impact?: Json | null
          id?: string
          is_reversible?: boolean | null
          measured_at?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          rollback_reason?: string | null
          rolled_back_at?: string | null
          trigger_insight_id?: string | null
          trigger_reason?: string | null
        }
        Update: {
          actual_impact?: Json | null
          change_description?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          expected_impact?: Json | null
          id?: string
          is_reversible?: boolean | null
          measured_at?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          rollback_reason?: string | null
          rolled_back_at?: string | null
          trigger_insight_id?: string | null
          trigger_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_trigger_insight_id_fkey"
            columns: ["trigger_insight_id"]
            isOneToOne: false
            referencedRelation: "marketing_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_insights: {
        Row: {
          affected_entities: Json | null
          auto_implementable: boolean | null
          category: string
          confidence: number | null
          created_at: string
          description: string
          evidence: Json
          generated_by: string | null
          generation_prompt: string | null
          id: string
          impact_measured: Json | null
          implemented_at: string | null
          implemented_by: string | null
          insight_type: string
          metrics_after: Json | null
          metrics_before: Json | null
          model_version: string | null
          priority: string | null
          recommendation: string | null
          sample_size: number | null
          statistical_significance: number | null
          status: string | null
          title: string
        }
        Insert: {
          affected_entities?: Json | null
          auto_implementable?: boolean | null
          category: string
          confidence?: number | null
          created_at?: string
          description: string
          evidence?: Json
          generated_by?: string | null
          generation_prompt?: string | null
          id?: string
          impact_measured?: Json | null
          implemented_at?: string | null
          implemented_by?: string | null
          insight_type: string
          metrics_after?: Json | null
          metrics_before?: Json | null
          model_version?: string | null
          priority?: string | null
          recommendation?: string | null
          sample_size?: number | null
          statistical_significance?: number | null
          status?: string | null
          title: string
        }
        Update: {
          affected_entities?: Json | null
          auto_implementable?: boolean | null
          category?: string
          confidence?: number | null
          created_at?: string
          description?: string
          evidence?: Json
          generated_by?: string | null
          generation_prompt?: string | null
          id?: string
          impact_measured?: Json | null
          implemented_at?: string | null
          implemented_by?: string | null
          insight_type?: string
          metrics_after?: Json | null
          metrics_before?: Json | null
          model_version?: string | null
          priority?: string | null
          recommendation?: string | null
          sample_size?: number | null
          statistical_significance?: number | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      message_performance: {
        Row: {
          body_template: string | null
          channel: string
          click_rate: number | null
          clicks: number | null
          confidence_level: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string
          deprecated_at: string | null
          deprecated_reason: string | null
          id: string
          is_active: boolean | null
          is_winner: boolean | null
          open_rate: number | null
          opens: number | null
          persona: string | null
          positive_replies: number | null
          replies: number | null
          reply_rate: number | null
          sample_size: number | null
          sends: number | null
          subject_template: string | null
          template_id: string
          template_name: string | null
          variant: string | null
        }
        Insert: {
          body_template?: string | null
          channel: string
          click_rate?: number | null
          clicks?: number | null
          confidence_level?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string
          deprecated_at?: string | null
          deprecated_reason?: string | null
          id?: string
          is_active?: boolean | null
          is_winner?: boolean | null
          open_rate?: number | null
          opens?: number | null
          persona?: string | null
          positive_replies?: number | null
          replies?: number | null
          reply_rate?: number | null
          sample_size?: number | null
          sends?: number | null
          subject_template?: string | null
          template_id: string
          template_name?: string | null
          variant?: string | null
        }
        Update: {
          body_template?: string | null
          channel?: string
          click_rate?: number | null
          clicks?: number | null
          confidence_level?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string
          deprecated_at?: string | null
          deprecated_reason?: string | null
          id?: string
          is_active?: boolean | null
          is_winner?: boolean | null
          open_rate?: number | null
          opens?: number | null
          persona?: string | null
          positive_replies?: number | null
          replies?: number | null
          reply_rate?: number | null
          sample_size?: number | null
          sends?: number | null
          subject_template?: string | null
          template_id?: string
          template_name?: string | null
          variant?: string | null
        }
        Relationships: []
      }
      micro_events: {
        Row: {
          cost_usd: number
          created_at: string
          customer_id: string
          estimated_loss_usd: number
          id: string
          product: string
          raw_input: Json
          raw_output: Json
          severity: number
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          customer_id: string
          estimated_loss_usd?: number
          id?: string
          product: string
          raw_input?: Json
          raw_output?: Json
          severity?: number
        }
        Update: {
          cost_usd?: number
          created_at?: string
          customer_id?: string
          estimated_loss_usd?: number
          id?: string
          product?: string
          raw_input?: Json
          raw_output?: Json
          severity?: number
        }
        Relationships: [
          {
            foreignKeyName: "micro_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_pricing: {
        Row: {
          created_at: string
          description: string | null
          description_he: string | null
          is_active: boolean
          price_usd: number
          product: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_he?: string | null
          is_active?: boolean
          price_usd: number
          product: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_he?: string | null
          is_active?: boolean
          price_usd?: number
          product?: string
        }
        Relationships: []
      }
      micro_rate_limits: {
        Row: {
          blocked_at: string | null
          cap_usd: number
          customer_id: string
          hits_count: number
          id: string
          limit_date: string
          spent_usd: number
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          cap_usd?: number
          customer_id: string
          hits_count?: number
          id?: string
          limit_date?: string
          spent_usd?: number
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          cap_usd?: number
          customer_id?: string
          hits_count?: number
          id?: string
          limit_date?: string
          spent_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_rate_limits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          amount: number | null
          charge_id: string | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          is_test: boolean
          message: string
          metadata: Json | null
          source: string
          was_sent: boolean
        }
        Insert: {
          amount?: number | null
          charge_id?: string | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          is_test?: boolean
          message: string
          metadata?: Json | null
          source?: string
          was_sent?: boolean
        }
        Update: {
          amount?: number | null
          charge_id?: string | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          is_test?: boolean
          message?: string
          metadata?: Json | null
          source?: string
          was_sent?: boolean
        }
        Relationships: []
      }
      offer_sources: {
        Row: {
          created_at: string
          failure_count: number | null
          health_score: number | null
          id: string
          is_active: boolean
          last_scanned_at: string | null
          last_success_at: string | null
          name: string
          query: string | null
          query_keywords: string[] | null
          scan_config: Json
          scan_interval_minutes: number
          source_type: string
          url: string
        }
        Insert: {
          created_at?: string
          failure_count?: number | null
          health_score?: number | null
          id?: string
          is_active?: boolean
          last_scanned_at?: string | null
          last_success_at?: string | null
          name: string
          query?: string | null
          query_keywords?: string[] | null
          scan_config?: Json
          scan_interval_minutes?: number
          source_type: string
          url: string
        }
        Update: {
          created_at?: string
          failure_count?: number | null
          health_score?: number | null
          id?: string
          is_active?: boolean
          last_scanned_at?: string | null
          last_success_at?: string | null
          name?: string
          query?: string | null
          query_keywords?: string[] | null
          scan_config?: Json
          scan_interval_minutes?: number
          source_type?: string
          url?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          code: string | null
          created_at: string
          delivery_config: Json
          delivery_type: string
          description: string | null
          description_he: string | null
          fulfillment_type: string | null
          id: string
          is_active: boolean
          keywords: string[]
          min_value_usd: number
          name: string
          name_he: string
          pack_id: string | null
          pricing_model: Json | null
          terms_url: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          delivery_config?: Json
          delivery_type: string
          description?: string | null
          description_he?: string | null
          fulfillment_type?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          min_value_usd?: number
          name: string
          name_he: string
          pack_id?: string | null
          pricing_model?: Json | null
          terms_url?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          delivery_config?: Json
          delivery_type?: string
          description?: string | null
          description_he?: string | null
          fulfillment_type?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          min_value_usd?: number
          name?: string
          name_he?: string
          pack_id?: string | null
          pricing_model?: Json | null
          terms_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "credit_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          approved_at: string | null
          auto_approved: boolean | null
          composite_score: number | null
          confidence_score: number | null
          created_at: string
          est_value_usd: number | null
          expected_value_usd: number | null
          id: string
          offer_id: string | null
          rejection_reason: string | null
          risk_flags: string[] | null
          risk_score: number | null
          signal_id: string
          signal_id_v2: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          auto_approved?: boolean | null
          composite_score?: number | null
          confidence_score?: number | null
          created_at?: string
          est_value_usd?: number | null
          expected_value_usd?: number | null
          id?: string
          offer_id?: string | null
          rejection_reason?: string | null
          risk_flags?: string[] | null
          risk_score?: number | null
          signal_id: string
          signal_id_v2?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          auto_approved?: boolean | null
          composite_score?: number | null
          confidence_score?: number | null
          created_at?: string
          est_value_usd?: number | null
          expected_value_usd?: number | null
          id?: string
          offer_id?: string | null
          rejection_reason?: string | null
          risk_flags?: string[] | null
          risk_score?: number | null
          signal_id?: string
          signal_id_v2?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "demand_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_queue: {
        Row: {
          ai_model: string | null
          channel: string
          created_at: string
          error_message: string | null
          external_message_id: string | null
          generation_metadata: Json | null
          id: string
          lead_id: string
          message_body: string
          message_content: string | null
          message_variant: string | null
          persona: string | null
          priority: number | null
          prompt_version: string | null
          response_received_at: string | null
          response_sentiment: string | null
          retry_count: number | null
          scheduled_at: string
          sent_at: string | null
          source_url: string | null
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_model?: string | null
          channel: string
          created_at?: string
          error_message?: string | null
          external_message_id?: string | null
          generation_metadata?: Json | null
          id?: string
          lead_id: string
          message_body: string
          message_content?: string | null
          message_variant?: string | null
          persona?: string | null
          priority?: number | null
          prompt_version?: string | null
          response_received_at?: string | null
          response_sentiment?: string | null
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          source_url?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_model?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          external_message_id?: string | null
          generation_metadata?: Json | null
          id?: string
          lead_id?: string
          message_body?: string
          message_content?: string | null
          message_variant?: string | null
          persona?: string | null
          priority?: number | null
          prompt_version?: string | null
          response_received_at?: string | null
          response_sentiment?: string | null
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          source_url?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pain_scores: {
        Row: {
          customer_id: string
          estimated_loss_usd_total: number
          events_count: number
          id: string
          pain_score_total: number
          payment_drift_total_usd: number
          top_problem_type: string | null
          updated_at: string
          wallet_risk_high_count: number
          webhook_failures_count: number
          window_date: string
        }
        Insert: {
          customer_id: string
          estimated_loss_usd_total?: number
          events_count?: number
          id?: string
          pain_score_total?: number
          payment_drift_total_usd?: number
          top_problem_type?: string | null
          updated_at?: string
          wallet_risk_high_count?: number
          webhook_failures_count?: number
          window_date?: string
        }
        Update: {
          customer_id?: string
          estimated_loss_usd_total?: number
          events_count?: number
          id?: string
          pain_score_total?: number
          payment_drift_total_usd?: number
          top_problem_type?: string | null
          updated_at?: string
          wallet_risk_high_count?: number
          webhook_failures_count?: number
          window_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "pain_scores_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
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
      rate_limits: {
        Row: {
          api_key_id: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          id?: string
          request_count?: number
          window_start: string
        }
        Update: {
          api_key_id?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      scaling_rules: {
        Row: {
          action_config: Json
          action_type: string
          cooldown_minutes: number | null
          created_at: string
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          rule_name: string
          trigger_condition: string
          trigger_count: number | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          cooldown_minutes?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          rule_name: string
          trigger_condition: string
          trigger_count?: number | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          cooldown_minutes?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          rule_name?: string
          trigger_condition?: string
          trigger_count?: number | null
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          category: string
          config: Json | null
          created_at: string
          description: string | null
          discovered_by: string | null
          id: string
          launched_at: string | null
          metrics: Json | null
          name: string
          service_key: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json | null
          created_at?: string
          description?: string | null
          discovered_by?: string | null
          id?: string
          launched_at?: string | null
          metrics?: Json | null
          name: string
          service_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json | null
          created_at?: string
          description?: string | null
          discovered_by?: string | null
          id?: string
          launched_at?: string | null
          metrics?: Json | null
          name?: string
          service_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          session_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "zerodev_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_discovery_queue: {
        Row: {
          candidate_type: string
          candidate_url: string
          confidence: number | null
          created_at: string
          id: string
          reason: string | null
          seed_topic: string
          status: string
        }
        Insert: {
          candidate_type: string
          candidate_url: string
          confidence?: number | null
          created_at?: string
          id?: string
          reason?: string | null
          seed_topic: string
          status?: string
        }
        Update: {
          candidate_type?: string
          candidate_url?: string
          confidence?: number | null
          created_at?: string
          id?: string
          reason?: string | null
          seed_topic?: string
          status?: string
        }
        Relationships: []
      }
      swap_orders: {
        Row: {
          amount_in: number
          asset_in: string
          asset_out: string
          created_at: string
          expected_amount_out: number | null
          failure_reason: string | null
          gas_est_usd: number | null
          id: string
          metadata: Json | null
          min_amount_out: number | null
          network: string
          slippage_bps: number | null
          source_payment_id: string | null
          status: string
          tx_hash: string | null
        }
        Insert: {
          amount_in: number
          asset_in: string
          asset_out: string
          created_at?: string
          expected_amount_out?: number | null
          failure_reason?: string | null
          gas_est_usd?: number | null
          id?: string
          metadata?: Json | null
          min_amount_out?: number | null
          network: string
          slippage_bps?: number | null
          source_payment_id?: string | null
          status?: string
          tx_hash?: string | null
        }
        Update: {
          amount_in?: number
          asset_in?: string
          asset_out?: string
          created_at?: string
          expected_amount_out?: number | null
          failure_reason?: string | null
          gas_est_usd?: number | null
          id?: string
          metadata?: Json | null
          min_amount_out?: number | null
          network?: string
          slippage_bps?: number | null
          source_payment_id?: string | null
          status?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          created_at: string
          dimensions: Json | null
          id: string
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          created_at?: string
          dimensions?: Json | null
          id?: string
          metric_name: string
          metric_type?: string
          metric_value: number
          recorded_at?: string
        }
        Update: {
          created_at?: string
          dimensions?: Json | null
          id?: string
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: []
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
      treasury_balances: {
        Row: {
          asset: string
          balance: number
          balance_usd: number | null
          id: string
          network: string
          updated_at: string
        }
        Insert: {
          asset: string
          balance?: number
          balance_usd?: number | null
          id?: string
          network: string
          updated_at?: string
        }
        Update: {
          asset?: string
          balance?: number
          balance_usd?: number | null
          id?: string
          network?: string
          updated_at?: string
        }
        Relationships: []
      }
      treasury_ledger: {
        Row: {
          amount: number
          amount_usd: number | null
          asset: string
          charge_code: string | null
          created_at: string
          currency: string | null
          direction: string
          id: string
          job_id: string
          network: string | null
          payer_email: string | null
          payment_id: string | null
          tx_hash: string | null
        }
        Insert: {
          amount: number
          amount_usd?: number | null
          asset?: string
          charge_code?: string | null
          created_at?: string
          currency?: string | null
          direction?: string
          id?: string
          job_id: string
          network?: string | null
          payer_email?: string | null
          payment_id?: string | null
          tx_hash?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          asset?: string
          charge_code?: string | null
          created_at?: string
          currency?: string | null
          direction?: string
          id?: string
          job_id?: string
          network?: string | null
          payer_email?: string | null
          payment_id?: string | null
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
          {
            foreignKeyName: "treasury_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "confirmed_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_routes: {
        Row: {
          asset_in: string
          asset_out: string
          created_at: string
          from_network: string
          id: string
          is_active: boolean | null
          max_gas_usd: number | null
          max_slippage_bps: number | null
          min_amount_usd: number | null
          strategy: string
          to_network: string
        }
        Insert: {
          asset_in: string
          asset_out?: string
          created_at?: string
          from_network: string
          id?: string
          is_active?: boolean | null
          max_gas_usd?: number | null
          max_slippage_bps?: number | null
          min_amount_usd?: number | null
          strategy?: string
          to_network?: string
        }
        Update: {
          asset_in?: string
          asset_out?: string
          created_at?: string
          from_network?: string
          id?: string
          is_active?: boolean | null
          max_gas_usd?: number | null
          max_slippage_bps?: number | null
          min_amount_usd?: number | null
          strategy?: string
          to_network?: string
        }
        Relationships: []
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
      webhook_endpoints: {
        Row: {
          created_at: string
          customer_id: string | null
          endpoint_secret_hash: string
          endpoint_url: string
          events_count: number | null
          id: string
          is_active: boolean | null
          last_event_at: string | null
          plan: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          endpoint_secret_hash: string
          endpoint_url: string
          events_count?: number | null
          id?: string
          is_active?: boolean | null
          last_event_at?: string | null
          plan?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          endpoint_secret_hash?: string
          endpoint_url?: string
          events_count?: number | null
          id?: string
          is_active?: boolean | null
          last_event_at?: string | null
          plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          endpoint_id: string | null
          event_type: string | null
          headers: Json | null
          id: string
          payload: Json
          replay_response: Json | null
          replayed: boolean | null
          replayed_at: string | null
          signature_valid: boolean | null
        }
        Insert: {
          created_at?: string
          endpoint_id?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          payload: Json
          replay_response?: Json | null
          replayed?: boolean | null
          replayed_at?: string | null
          signature_valid?: boolean | null
        }
        Update: {
          created_at?: string
          endpoint_id?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          payload?: Json
          replay_response?: Json | null
          replayed?: boolean | null
          replayed_at?: string | null
          signature_valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      zerodev_sessions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          network: string
          permissions_json: Json
          session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          network?: string
          permissions_json?: Json
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          network?: string
          permissions_json?: Json
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      confirmed_payments: {
        Row: {
          amount_eth: number | null
          amount_usd: number | null
          charge_code: string | null
          charge_id: string | null
          confirmed_at: string | null
          created_at: string | null
          credits_purchased: number | null
          customer_email: string | null
          id: string | null
          provider: string | null
        }
        Relationships: []
      }
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
