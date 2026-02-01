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
          rate_limit_tier: string
          revoked_at: string | null
          revoked_reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string | null
          last_used_at?: string | null
          rate_limit_tier?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string | null
          last_used_at?: string | null
          rate_limit_tier?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
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
          budget_signals: string | null
          company: string | null
          composite_score: number | null
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
          last_contact_at: string | null
          lifetime_value_usd: number | null
          notes: string | null
          pain_points: Json | null
          raw_data: Json | null
          referred_by: string | null
          relevance_score: number | null
          source: string
          source_id: string | null
          source_url: string | null
          status: string
          tags: string[] | null
          tech_stack: Json | null
          updated_at: string
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          acquisition_campaign?: string | null
          acquisition_channel?: string | null
          budget_signals?: string | null
          company?: string | null
          composite_score?: number | null
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
          last_contact_at?: string | null
          lifetime_value_usd?: number | null
          notes?: string | null
          pain_points?: Json | null
          raw_data?: Json | null
          referred_by?: string | null
          relevance_score?: number | null
          source: string
          source_id?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          tech_stack?: Json | null
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          acquisition_campaign?: string | null
          acquisition_channel?: string | null
          budget_signals?: string | null
          company?: string | null
          composite_score?: number | null
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
          last_contact_at?: string | null
          lifetime_value_usd?: number | null
          notes?: string | null
          pain_points?: Json | null
          raw_data?: Json | null
          referred_by?: string | null
          relevance_score?: number | null
          source?: string
          source_id?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          tech_stack?: Json | null
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
          message_variant: string | null
          persona: string | null
          priority: number | null
          prompt_version: string | null
          response_received_at: string | null
          response_sentiment: string | null
          retry_count: number | null
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
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
          message_variant?: string | null
          persona?: string | null
          priority?: number | null
          prompt_version?: string | null
          response_received_at?: string | null
          response_sentiment?: string | null
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
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
          message_variant?: string | null
          persona?: string | null
          priority?: number | null
          prompt_version?: string | null
          response_received_at?: string | null
          response_sentiment?: string | null
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
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
