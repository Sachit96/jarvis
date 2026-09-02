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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      anthropic_settings: {
        Row: {
          id: boolean
          spend_cap_usd: number
        }
        Insert: {
          id?: boolean
          spend_cap_usd?: number
        }
        Update: {
          id?: boolean
          spend_cap_usd?: number
        }
        Relationships: []
      }
      anthropic_usage: {
        Row: {
          cost_usd: number
          id: string
          incurred_at: string
          input_tokens: number
          model: string
          output_tokens: number
        }
        Insert: {
          cost_usd: number
          id?: string
          incurred_at?: string
          input_tokens: number
          model: string
          output_tokens: number
        }
        Update: {
          cost_usd?: number
          id?: string
          incurred_at?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_type: string
          created_at: string
          current_balance: number
          id: string
          is_active: boolean
          is_liability: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          account_type: string
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          is_liability?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          is_liability?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          contact_id: string
          created_at: string
          deal_id: string | null
          id: string
          notes: string
          occurred_at: string
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          notes: string
          occurred_at?: string
          type?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string
          occurred_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      body_metrics: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          logged_at: string
          notes: string | null
          updated_at: string
          weight_kg: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          updated_at?: string
          weight_kg: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          monthly_limit: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          monthly_limit: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_onboarding_tasks: {
        Row: {
          completed: boolean
          contact_id: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          completed?: boolean
          contact_id: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          completed?: boolean
          contact_id?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_name: string | null
          contact_person: string
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          notes: string | null
          phone: string | null
          source: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          contact_person: string
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          contact_person?: string
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contact_id: string
          created_at: string
          end_date: string | null
          id: string
          monthly_value: number
          notes: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_value?: number
          notes?: string | null
          start_date?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_value?: number
          notes?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_recommendations: {
        Row: {
          created_at: string
          focus_areas: string[]
          id: string
          markdown_body: string
          model_used: string | null
          rec_date: string
          strengths: string[]
          updated_at: string
          weaknesses: string[]
        }
        Insert: {
          created_at?: string
          focus_areas?: string[]
          id?: string
          markdown_body: string
          model_used?: string | null
          rec_date?: string
          strengths?: string[]
          updated_at?: string
          weaknesses?: string[]
        }
        Update: {
          created_at?: string
          focus_areas?: string[]
          id?: string
          markdown_body?: string
          model_used?: string | null
          rec_date?: string
          strengths?: string[]
          updated_at?: string
          weaknesses?: string[]
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          completed: boolean
          created_at: string
          deal_id: string
          due_date: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deal_id: string
          due_date?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          deal_id?: string
          due_date?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          contact_id: string
          created_at: string
          expected_close_date: string | null
          external_id: string | null
          id: string
          notes: string | null
          source: string
          stage_changed_at: string
          stage_id: string
          title: string | null
          updated_at: string
          value: number
        }
        Insert: {
          closed_at?: string | null
          contact_id: string
          created_at?: string
          expected_close_date?: string | null
          external_id?: string | null
          id?: string
          notes?: string | null
          source?: string
          stage_changed_at?: string
          stage_id: string
          title?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          expected_close_date?: string | null
          external_id?: string | null
          id?: string
          notes?: string | null
          source?: string
          stage_changed_at?: string
          stage_id?: string
          title?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          is_active: boolean
          muscle_group: string | null
          name: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          muscle_group?: string | null
          name: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          muscle_group?: string | null
          name?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      gemini_usage: {
        Row: {
          model: string
          request_count: number
          usage_date: string
        }
        Insert: {
          model: string
          request_count?: number
          usage_date: string
        }
        Update: {
          model?: string
          request_count?: number
          usage_date?: string
        }
        Relationships: []
      }
      ghl_connections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          location_id: string
          private_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          location_id: string
          private_token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          location_id?: string
          private_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      ghl_sync_logs: {
        Row: {
          created_at: string
          direction: string
          event_type: string
          id: string
          message: string | null
          payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          event_type: string
          id?: string
          message?: string | null
          payload?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          direction?: string
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          progress_percent: number
          status: string
          target_date: string | null
          timeframe: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          progress_percent?: number
          status?: string
          target_date?: string | null
          timeframe: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          progress_percent?: number
          status?: string
          target_date?: string | null
          timeframe?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed: boolean
          completed_at: string | null
          count: number | null
          created_at: string
          habit_id: string
          id: string
          log_date: string
          note: string | null
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          count?: number | null
          created_at?: string
          habit_id: string
          id?: string
          log_date: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          count?: number | null
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          metric_type: string
          name: string
          pinned: boolean
          sort_order: number
          target_count: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          metric_type?: string
          name: string
          pinned?: boolean
          sort_order?: number
          target_count?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          metric_type?: string
          name?: string
          pinned?: boolean
          sort_order?: number
          target_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          body: string
          created_at: string
          entry_date: string
          entry_type: string
          id: string
          linked_goal_ids: string[]
          mood: number | null
          obsidian_path: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          linked_goal_ids?: string[]
          mood?: number | null
          obsidian_path?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          linked_goal_ids?: string[]
          mood?: number | null
          obsidian_path?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_research: {
        Row: {
          ai_summary: string | null
          audit: Json
          city: string | null
          contact_id: string
          country: string | null
          created_at: string
          deal_id: string | null
          dismissed: boolean
          google_place_id: string
          id: string
          industry: string | null
          maps_url: string | null
          opportunities: string[]
          postal_code: string | null
          rating: number | null
          region: string | null
          researched_at: string
          review_count: number | null
          score: number
          score_breakdown: Json
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          audit?: Json
          city?: string | null
          contact_id: string
          country?: string | null
          created_at?: string
          deal_id?: string | null
          dismissed?: boolean
          google_place_id: string
          id?: string
          industry?: string | null
          maps_url?: string | null
          opportunities?: string[]
          postal_code?: string | null
          rating?: number | null
          region?: string | null
          researched_at?: string
          review_count?: number | null
          score: number
          score_breakdown?: Json
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          audit?: Json
          city?: string | null
          contact_id?: string
          country?: string | null
          created_at?: string
          deal_id?: string | null
          dismissed?: boolean
          google_place_id?: string
          id?: string
          industry?: string | null
          maps_url?: string | null
          opportunities?: string[]
          postal_code?: string | null
          rating?: number | null
          region?: string | null
          researched_at?: string
          review_count?: number | null
          score?: number
          score_breakdown?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_research_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_research_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      market_analyses: {
        Row: {
          analysis_date: string
          created_at: string
          daily_notes: string | null
          daily_sentiment: string | null
          h4_notes: string | null
          h4_sentiment: string | null
          id: string
          pair: string
          updated_at: string
          weekly_notes: string | null
          weekly_sentiment: string | null
        }
        Insert: {
          analysis_date?: string
          created_at?: string
          daily_notes?: string | null
          daily_sentiment?: string | null
          h4_notes?: string | null
          h4_sentiment?: string | null
          id?: string
          pair: string
          updated_at?: string
          weekly_notes?: string | null
          weekly_sentiment?: string | null
        }
        Update: {
          analysis_date?: string
          created_at?: string
          daily_notes?: string | null
          daily_sentiment?: string | null
          h4_notes?: string | null
          h4_sentiment?: string | null
          id?: string
          pair?: string
          updated_at?: string
          weekly_notes?: string | null
          weekly_sentiment?: string | null
        }
        Relationships: []
      }
      memory_entries: {
        Row: {
          body: string
          confidence: number | null
          created_at: string
          expires_at: string | null
          id: string
          pinned: boolean
          source: string
          tags: string[]
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          confidence?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          source?: string
          tags?: string[]
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          confidence?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          source?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentor_messages: {
        Row: {
          content: string
          context: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          context?: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          context?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      note_links: {
        Row: {
          created_at: string
          id: string
          link_text: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_text: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          link_text?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          description: string
          fat_g: number
          id: string
          logged_at: string
          meal_type: string
          protein_g: number
          source: string
          updated_at: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          created_at?: string
          description: string
          fat_g?: number
          id?: string
          logged_at?: string
          meal_type: string
          protein_g?: number
          source?: string
          updated_at?: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          description?: string
          fat_g?: number
          id?: string
          logged_at?: string
          meal_type?: string
          protein_g?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          created_at: string
          id: string
          target_calories: number
          target_carbs_g: number
          target_fat_g: number
          target_protein_g: number
          target_water_ml: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_calories?: number
          target_carbs_g?: number
          target_fat_g?: number
          target_protein_g?: number
          target_water_ml?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          target_calories?: number
          target_carbs_g?: number
          target_fat_g?: number
          target_protein_g?: number
          target_water_ml?: number
          updated_at?: string
        }
        Relationships: []
      }
      obsidian_sync_state: {
        Row: {
          last_synced_at: string
          last_synced_content_hash: string
          memory_entry_id: string
          vault_relative_path: string
        }
        Insert: {
          last_synced_at?: string
          last_synced_content_hash: string
          memory_entry_id: string
          vault_relative_path: string
        }
        Update: {
          last_synced_at?: string
          last_synced_content_hash?: string
          memory_entry_id?: string
          vault_relative_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "obsidian_sync_state_memory_entry_id_fkey"
            columns: ["memory_entry_id"]
            isOneToOne: true
            referencedRelation: "memory_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      prayer_logs: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          log_date: string
          logged_at: string | null
          prayer_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          log_date: string
          logged_at?: string | null
          prayer_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          log_date?: string
          logged_at?: string | null
          prayer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_logs_prayer_id_fkey"
            columns: ["prayer_id"]
            isOneToOne: false
            referencedRelation: "prayers"
            referencedColumns: ["id"]
          },
        ]
      }
      prayers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          created_at: string
          id: string
          route: string
        }
        Insert: {
          created_at?: string
          id?: string
          route: string
        }
        Update: {
          created_at?: string
          id?: string
          route?: string
        }
        Relationships: []
      }
      research_runs: {
        Row: {
          audited_count: number
          created_at: string
          current_label: string | null
          error_log: Json
          failed_count: number
          finished_at: string | null
          found_count: number
          id: string
          inserted_count: number
          params: Json
          skipped_cached_count: number
          started_at: string | null
          status: string
        }
        Insert: {
          audited_count?: number
          created_at?: string
          current_label?: string | null
          error_log?: Json
          failed_count?: number
          finished_at?: string | null
          found_count?: number
          id?: string
          inserted_count?: number
          params: Json
          skipped_cached_count?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          audited_count?: number
          created_at?: string
          current_label?: string | null
          error_log?: Json
          failed_count?: number
          finished_at?: string | null
          found_count?: number
          id?: string
          inserted_count?: number
          params?: Json
          skipped_cached_count?: number
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      saved_lead_searches: {
        Row: {
          cadence: string
          created_at: string
          enabled: boolean
          id: string
          label: string
          last_run_at: string | null
          params: Json
          updated_at: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          last_run_at?: string | null
          params: Json
          updated_at?: string
        }
        Update: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          last_run_at?: string | null
          params?: Json
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_runs: {
        Row: {
          created_at: string
          http_status: number | null
          id: string
          job_name: string
          message: string | null
          status: string
        }
        Insert: {
          created_at?: string
          http_status?: number | null
          id?: string
          job_name: string
          message?: string | null
          status: string
        }
        Update: {
          created_at?: string
          http_status?: number | null
          id?: string
          job_name?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          created_at: string
          hours_slept: number
          id: string
          log_date: string
          notes: string | null
          quality: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours_slept: number
          id?: string
          log_date?: string
          notes?: string | null
          quality?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours_slept?: number
          id?: string
          log_date?: string
          notes?: string | null
          quality?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          action_taken: string | null
          body: string
          created_at: string
          from_number: string
          id: string
          reply: string
          status: string
        }
        Insert: {
          action_taken?: string | null
          body: string
          created_at?: string
          from_number: string
          id?: string
          reply: string
          status?: string
        }
        Update: {
          action_taken?: string | null
          body?: string
          created_at?: string
          from_number?: string
          id?: string
          reply?: string
          status?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_checklist_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset_pair: string
          closed_at: string | null
          confluence_checked: boolean
          created_at: string
          direction: string
          entry_price: number
          exit_price: number | null
          fees: number
          id: string
          notes: string | null
          opened_at: string
          pnl: number | null
          quantity: number | null
          setup_category: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_pair: string
          closed_at?: string | null
          confluence_checked?: boolean
          created_at?: string
          direction: string
          entry_price: number
          exit_price?: number | null
          fees?: number
          id?: string
          notes?: string | null
          opened_at?: string
          pnl?: number | null
          quantity?: number | null
          setup_category?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_pair?: string
          closed_at?: string | null
          confluence_checked?: boolean
          created_at?: string
          direction?: string
          entry_price?: number
          exit_price?: number | null
          fees?: number
          id?: string
          notes?: string | null
          opened_at?: string
          pnl?: number | null
          quantity?: number | null
          setup_category?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          occurred_at: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_assessment_requirements: {
        Row: {
          assessment_id: string
          completed: boolean
          created_at: string
          id: string
          requirement: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          assessment_id: string
          completed?: boolean
          created_at?: string
          id?: string
          requirement: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          requirement?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uni_assessment_requirements_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "uni_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_assessments: {
        Row: {
          course_id: string
          created_at: string
          due_at: string | null
          difficulty: number | null
          earned_score: number | null
          estimated_hours: number | null
          id: string
          max_score: number
          notes: string | null
          source: string
          status: string
          title: string
          type: string
          updated_at: string
          weight_pct: number
        }
        Insert: {
          course_id: string
          created_at?: string
          due_at?: string | null
          difficulty?: number | null
          earned_score?: number | null
          estimated_hours?: number | null
          id?: string
          max_score?: number
          notes?: string | null
          source?: string
          status?: string
          title: string
          type: string
          updated_at?: string
          weight_pct: number
        }
        Update: {
          course_id?: string
          created_at?: string
          due_at?: string | null
          difficulty?: number | null
          earned_score?: number | null
          estimated_hours?: number | null
          id?: string
          max_score?: number
          notes?: string | null
          source?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "uni_assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "uni_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_courses: {
        Row: {
          archived: boolean
          code: string
          color: string | null
          created_at: string
          credit_weight: number
          description: string | null
          id: string
          name: string
          professor: string | null
          professor_email: string | null
          room: string | null
          target_grade: number | null
          term: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          code: string
          color?: string | null
          created_at?: string
          credit_weight?: number
          description?: string | null
          id?: string
          name: string
          professor?: string | null
          professor_email?: string | null
          room?: string | null
          target_grade?: number | null
          term: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          code?: string
          color?: string | null
          created_at?: string
          credit_weight?: number
          description?: string | null
          id?: string
          name?: string
          professor?: string | null
          professor_email?: string | null
          room?: string | null
          target_grade?: number | null
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      uni_deadlines: {
        Row: {
          category: string
          created_at: string
          due_at: string
          id: string
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          due_at: string
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          due_at?: string
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      uni_flashcards: {
        Row: {
          answer: string
          created_at: string
          ease: number
          id: string
          last_reviewed: string | null
          material_id: string
          next_review: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          ease?: number
          id?: string
          last_reviewed?: string | null
          material_id: string
          next_review?: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          ease?: number
          id?: string
          last_reviewed?: string | null
          material_id?: string
          next_review?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uni_flashcards_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "uni_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_materials: {
        Row: {
          body: string
          course_id: string
          created_at: string
          id: string
          title: string
          type: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          body: string
          course_id: string
          created_at?: string
          id?: string
          title: string
          type: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          title?: string
          type?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uni_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "uni_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_schedule_blocks: {
        Row: {
          course_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
          type: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          type: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uni_schedule_blocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "uni_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_study_sessions: {
        Row: {
          actual_minutes: number | null
          assessment_id: string | null
          completed: boolean
          course_id: string
          created_at: string
          id: string
          notes: string | null
          planned_minutes: number
          planned_start: string
          updated_at: string
        }
        Insert: {
          actual_minutes?: number | null
          assessment_id?: string | null
          completed?: boolean
          course_id: string
          created_at?: string
          id?: string
          notes?: string | null
          planned_minutes: number
          planned_start: string
          updated_at?: string
        }
        Update: {
          actual_minutes?: number | null
          assessment_id?: string | null
          completed?: boolean
          course_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          planned_minutes?: number
          planned_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uni_study_sessions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "uni_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uni_study_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "uni_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      water_logs: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          log_date: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          id?: string
          log_date?: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          log_date?: string
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          created_at: string
          focus_areas: string[]
          id: string
          markdown_body: string
          model_used: string | null
          strengths: string[]
          updated_at: string
          weaknesses: string[]
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          focus_areas?: string[]
          id?: string
          markdown_body: string
          model_used?: string | null
          strengths?: string[]
          updated_at?: string
          weaknesses?: string[]
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          focus_areas?: string[]
          id?: string
          markdown_body?: string
          model_used?: string | null
          strengths?: string[]
          updated_at?: string
          weaknesses?: string[]
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          reps: number | null
          set_number: number
          updated_at: string
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          reps?: number | null
          set_number?: number
          updated_at?: string
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          reps?: number | null
          set_number?: number
          updated_at?: string
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          completed: boolean
          created_at: string
          external_id: string | null
          id: string
          notes: string | null
          session_label: string
          source: string
          started_at: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          session_label?: string
          source?: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          session_label?: string
          source?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      yt_connections: {
        Row: {
          access_token: string
          channel_id: string | null
          channel_title: string | null
          connected_at: string
          id: boolean
          refresh_token: string
          scope: string
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          channel_id?: string | null
          channel_title?: string | null
          connected_at?: string
          id?: boolean
          refresh_token: string
          scope: string
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          channel_id?: string | null
          channel_title?: string | null
          connected_at?: string
          id?: boolean
          refresh_token?: string
          scope?: string
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      yt_scripts: {
        Row: {
          created_at: string
          estimated_runtime_sec: number | null
          hook: string | null
          id: string
          niche: string | null
          research_grounded: boolean
          research_summary: string | null
          script_body: string | null
          sections: Json
          status: string
          suggested_titles: string[]
          topic: string
          updated_at: string
          youtube_video_id: string | null
          youtube_privacy_status: string | null
        }
        Insert: {
          created_at?: string
          estimated_runtime_sec?: number | null
          hook?: string | null
          id?: string
          niche?: string | null
          research_grounded?: boolean
          research_summary?: string | null
          script_body?: string | null
          sections?: Json
          status?: string
          suggested_titles?: string[]
          topic: string
          updated_at?: string
          youtube_video_id?: string | null
          youtube_privacy_status?: string | null
        }
        Update: {
          created_at?: string
          estimated_runtime_sec?: number | null
          hook?: string | null
          id?: string
          niche?: string | null
          research_grounded?: boolean
          research_summary?: string | null
          script_body?: string | null
          sections?: Json
          status?: string
          suggested_titles?: string[]
          topic?: string
          updated_at?: string
          youtube_video_id?: string | null
          youtube_privacy_status?: string | null
        }
        Relationships: []
      }
      yt_thumbnails: {
        Row: {
          created_at: string
          id: string
          image_base64: string | null
          mime_type: string
          prompt: string
          script_id: string
          selected: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          image_base64?: string | null
          mime_type?: string
          prompt: string
          script_id: string
          selected?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          image_base64?: string | null
          mime_type?: string
          prompt?: string
          script_id?: string
          selected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "yt_thumbnails_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "yt_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_gemini_usage: {
        Args: { p_date: string; p_model: string }
        Returns: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
