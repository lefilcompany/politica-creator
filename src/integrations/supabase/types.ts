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
      actions: {
        Row: {
          approved: boolean | null
          asset_path: string | null
          brand_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          result: Json | null
          revisions: number | null
          status: string
          team_id: string | null
          thumb_path: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved?: boolean | null
          asset_path?: string | null
          brand_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          result?: Json | null
          revisions?: number | null
          status?: string
          team_id?: string | null
          thumb_path?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved?: boolean | null
          asset_path?: string | null
          brand_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          result?: Json | null
          revisions?: number | null
          status?: string
          team_id?: string | null
          thumb_path?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          avatar_url: string | null
          brand_color: string | null
          brand_references: string | null
          collaborations: string | null
          color_palette: Json | null
          created_at: string | null
          crisis_info: string | null
          goals: string | null
          id: string
          inspirations: string | null
          keywords: string | null
          logo: Json | null
          milestones: string | null
          moodboard: Json | null
          name: string
          promise: string | null
          reference_image: Json | null
          responsible: string
          restrictions: string | null
          segment: string
          special_dates: string | null
          success_metrics: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string
          values: string | null
        }
        Insert: {
          avatar_url?: string | null
          brand_color?: string | null
          brand_references?: string | null
          collaborations?: string | null
          color_palette?: Json | null
          created_at?: string | null
          crisis_info?: string | null
          goals?: string | null
          id?: string
          inspirations?: string | null
          keywords?: string | null
          logo?: Json | null
          milestones?: string | null
          moodboard?: Json | null
          name: string
          promise?: string | null
          reference_image?: Json | null
          responsible: string
          restrictions?: string | null
          segment: string
          special_dates?: string | null
          success_metrics?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id: string
          values?: string | null
        }
        Update: {
          avatar_url?: string | null
          brand_color?: string | null
          brand_references?: string | null
          collaborations?: string | null
          color_palette?: Json | null
          created_at?: string | null
          crisis_info?: string | null
          goals?: string | null
          id?: string
          inspirations?: string | null
          keywords?: string | null
          logo?: Json | null
          milestones?: string | null
          moodboard?: Json | null
          name?: string
          promise?: string | null
          reference_image?: Json | null
          responsible?: string
          restrictions?: string | null
          segment?: string
          special_dates?: string | null
          success_metrics?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
          values?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons_used: {
        Row: {
          coupon_code: string
          coupon_prefix: string
          created_at: string
          id: string
          prize_type: string
          prize_value: number
          redeemed_at: string
          redeemed_by: string
          team_id: string | null
        }
        Insert: {
          coupon_code: string
          coupon_prefix: string
          created_at?: string
          id?: string
          prize_type: string
          prize_value: number
          redeemed_at?: string
          redeemed_by: string
          team_id?: string | null
        }
        Update: {
          coupon_code?: string
          coupon_prefix?: string
          created_at?: string
          id?: string
          prize_type?: string
          prize_value?: number
          redeemed_at?: string
          redeemed_by?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_used_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_history: {
        Row: {
          action_type: string
          created_at: string
          credits_after: number
          credits_before: number
          credits_used: number
          description: string | null
          id: string
          metadata: Json | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          credits_after: number
          credits_before: number
          credits_used: number
          description?: string | null
          id?: string
          metadata?: Json | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          credits_after?: number
          credits_before?: number
          credits_used?: number
          description?: string | null
          id?: string
          metadata?: Json | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          amount_paid: number
          completed_at: string | null
          created_at: string
          credits_purchased: number
          id: string
          metadata: Json | null
          plan_id: string | null
          purchase_type: string
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          amount_paid: number
          completed_at?: string | null
          created_at?: string
          credits_purchased: number
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          purchase_type: string
          status?: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          completed_at?: string | null
          created_at?: string
          credits_purchased?: number
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          purchase_type?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean
          team_id: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          team_id?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          team_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          age: string
          beliefs_and_interests: string
          brand_id: string
          challenges: string
          content_consumption_routine: string
          created_at: string | null
          gender: string
          id: string
          interest_triggers: string
          location: string
          main_goal: string
          name: string
          preferred_tone_of_voice: string
          professional_context: string
          purchase_journey_stage: string
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          age: string
          beliefs_and_interests: string
          brand_id: string
          challenges: string
          content_consumption_routine: string
          created_at?: string | null
          gender: string
          id?: string
          interest_triggers: string
          location: string
          main_goal: string
          name: string
          preferred_tone_of_voice: string
          professional_context: string
          purchase_journey_stage: string
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          age?: string
          beliefs_and_interests?: string
          brand_id?: string
          challenges?: string
          content_consumption_routine?: string
          created_at?: string | null
          gender?: string
          id?: string
          interest_triggers?: string
          location?: string
          main_goal?: string
          name?: string
          preferred_tone_of_voice?: string
          professional_context?: string
          purchase_journey_stage?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          can_subscribe_online: boolean | null
          created_at: string | null
          credits: number
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_brands: number
          max_members: number
          max_personas: number
          max_strategic_themes: number
          name: string
          price_monthly: number
          price_yearly: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          trial_days: number
          updated_at: string | null
        }
        Insert: {
          can_subscribe_online?: boolean | null
          created_at?: string | null
          credits?: number
          description?: string | null
          features?: Json | null
          id: string
          is_active?: boolean | null
          max_brands?: number
          max_members?: number
          max_personas?: number
          max_strategic_themes?: number
          name: string
          price_monthly: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string | null
        }
        Update: {
          can_subscribe_online?: boolean | null
          created_at?: string | null
          credits?: number
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_brands?: number
          max_members?: number
          max_personas?: number
          max_strategic_themes?: number
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          biography: string | null
          city: string | null
          created_at: string | null
          credits: number | null
          email: string
          evidence_history: string | null
          focus_areas: string[] | null
          force_password_change: boolean | null
          id: string
          main_social_networks: string[] | null
          mandate_stage: string | null
          migration_user: boolean | null
          name: string
          onboarding_brands_completed: boolean | null
          onboarding_create_content_completed: boolean | null
          onboarding_credits_completed: boolean | null
          onboarding_dashboard_completed: boolean | null
          onboarding_history_completed: boolean | null
          onboarding_navbar_completed: boolean | null
          onboarding_personas_completed: boolean | null
          onboarding_plan_content_completed: boolean | null
          onboarding_quick_content_completed: boolean | null
          onboarding_review_content_caption_completed: boolean | null
          onboarding_review_content_completed: boolean | null
          onboarding_review_content_image_completed: boolean | null
          onboarding_review_content_text_completed: boolean | null
          onboarding_themes_completed: boolean | null
          password_reset_sent_at: string | null
          phone: string | null
          plan_id: string | null
          political_experience: string | null
          political_level: string | null
          political_party: string | null
          political_role: string | null
          profile_detail_completed: boolean | null
          red_lines: string | null
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string | null
          target_audience_description: string | null
          team_id: string | null
          tone_of_voice: string | null
          tutorial_completed: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          biography?: string | null
          city?: string | null
          created_at?: string | null
          credits?: number | null
          email: string
          evidence_history?: string | null
          focus_areas?: string[] | null
          force_password_change?: boolean | null
          id: string
          main_social_networks?: string[] | null
          mandate_stage?: string | null
          migration_user?: boolean | null
          name: string
          onboarding_brands_completed?: boolean | null
          onboarding_create_content_completed?: boolean | null
          onboarding_credits_completed?: boolean | null
          onboarding_dashboard_completed?: boolean | null
          onboarding_history_completed?: boolean | null
          onboarding_navbar_completed?: boolean | null
          onboarding_personas_completed?: boolean | null
          onboarding_plan_content_completed?: boolean | null
          onboarding_quick_content_completed?: boolean | null
          onboarding_review_content_caption_completed?: boolean | null
          onboarding_review_content_completed?: boolean | null
          onboarding_review_content_image_completed?: boolean | null
          onboarding_review_content_text_completed?: boolean | null
          onboarding_themes_completed?: boolean | null
          password_reset_sent_at?: string | null
          phone?: string | null
          plan_id?: string | null
          political_experience?: string | null
          political_level?: string | null
          political_party?: string | null
          political_role?: string | null
          profile_detail_completed?: boolean | null
          red_lines?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          target_audience_description?: string | null
          team_id?: string | null
          tone_of_voice?: string | null
          tutorial_completed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          biography?: string | null
          city?: string | null
          created_at?: string | null
          credits?: number | null
          email?: string
          evidence_history?: string | null
          focus_areas?: string[] | null
          force_password_change?: boolean | null
          id?: string
          main_social_networks?: string[] | null
          mandate_stage?: string | null
          migration_user?: boolean | null
          name?: string
          onboarding_brands_completed?: boolean | null
          onboarding_create_content_completed?: boolean | null
          onboarding_credits_completed?: boolean | null
          onboarding_dashboard_completed?: boolean | null
          onboarding_history_completed?: boolean | null
          onboarding_navbar_completed?: boolean | null
          onboarding_personas_completed?: boolean | null
          onboarding_plan_content_completed?: boolean | null
          onboarding_quick_content_completed?: boolean | null
          onboarding_review_content_caption_completed?: boolean | null
          onboarding_review_content_completed?: boolean | null
          onboarding_review_content_image_completed?: boolean | null
          onboarding_review_content_text_completed?: boolean | null
          onboarding_themes_completed?: boolean | null
          password_reset_sent_at?: string | null
          phone?: string | null
          plan_id?: string | null
          political_experience?: string | null
          political_level?: string | null
          political_party?: string | null
          political_role?: string | null
          profile_detail_completed?: boolean | null
          red_lines?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          target_audience_description?: string | null
          team_id?: string | null
          tone_of_voice?: string | null
          tutorial_completed?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      strategic_themes: {
        Row: {
          additional_info: string | null
          best_formats: string
          brand_id: string
          color_palette: string
          content_format: string
          created_at: string | null
          description: string
          expected_action: string
          hashtags: string
          id: string
          macro_themes: string
          objectives: string
          platforms: string
          target_audience: string
          team_id: string | null
          title: string
          tone_of_voice: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_info?: string | null
          best_formats: string
          brand_id: string
          color_palette: string
          content_format: string
          created_at?: string | null
          description: string
          expected_action: string
          hashtags: string
          id?: string
          macro_themes: string
          objectives: string
          platforms: string
          target_audience: string
          team_id?: string | null
          title: string
          tone_of_voice: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_info?: string | null
          best_formats?: string
          brand_id?: string
          color_palette?: string
          content_format?: string
          created_at?: string | null
          description?: string
          expected_action?: string
          hashtags?: string
          id?: string
          macro_themes?: string
          objectives?: string
          platforms?: string
          target_audience?: string
          team_id?: string | null
          title?: string
          tone_of_voice?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_themes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_themes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          source: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          message: string
          metadata?: Json | null
          source?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          source?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_join_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          admin_id: string
          code: string | null
          created_at: string | null
          credits: number | null
          free_brands_used: number | null
          free_personas_used: number | null
          free_themes_used: number | null
          id: string
          name: string
          plan_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          code?: string | null
          created_at?: string | null
          credits?: number | null
          free_brands_used?: number | null
          free_personas_used?: number | null
          free_themes_used?: number | null
          id?: string
          name: string
          plan_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          code?: string | null
          created_at?: string | null
          credits?: number | null
          free_brands_used?: number | null
          free_personas_used?: number | null
          free_themes_used?: number | null
          id?: string
          name?: string
          plan_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_name: string
          event_type: string
          id: string
          page_url: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_name: string
          event_type: string
          id?: string
          page_url?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_name?: string
          event_type?: string
          id?: string
          page_url?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence_history: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      align_team_credits_and_setup_trial: {
        Args: never
        Returns: {
          action_taken: string
          plan_id: string
          team_id: string
          team_name: string
        }[]
      }
      can_access_resource: {
        Args: { resource_team_id: string; resource_user_id: string }
        Returns: boolean
      }
      check_team_access: { Args: { p_team_id: string }; Returns: boolean }
      create_team_for_user: {
        Args: {
          p_plan_id?: string
          p_team_code: string
          p_team_name: string
          p_user_id: string
        }
        Returns: {
          team_code: string
          team_id: string
          team_name: string
        }[]
      }
      get_action_summaries: {
        Args: {
          p_brand_filter?: string
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_limit?: number
          p_offset?: number
          p_team_id: string
          p_type_filter?: string
        }
        Returns: {
          approved: boolean
          brand_id: string
          brand_name: string
          created_at: string
          id: string
          image_url: string
          objective: string
          platform: string
          thumb_path: string
          title: string
          total_count: number
          type: string
        }[]
      }
      get_all_teams_admin: {
        Args: never
        Returns: {
          admin_id: string
          code: string
          created_at: string
          credits: number
          id: string
          name: string
          plan_id: string
          subscription_period_end: string
          subscription_status: string
        }[]
      }
      get_all_users_admin: {
        Args: never
        Returns: {
          avatar_url: string
          city: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          state: string
          team_id: string
          tutorial_completed: boolean
        }[]
      }
      get_team_id_by_code: { Args: { p_team_code: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_type:
        | "CRIAR_CONTEUDO"
        | "CRIAR_CONTEUDO_RAPIDO"
        | "REVISAR_CONTEUDO"
        | "PLANEJAR_CONTEUDO"
        | "GERAR_VIDEO"
      app_role: "admin" | "member" | "system"
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
    Enums: {
      action_type: [
        "CRIAR_CONTEUDO",
        "CRIAR_CONTEUDO_RAPIDO",
        "REVISAR_CONTEUDO",
        "PLANEJAR_CONTEUDO",
        "GERAR_VIDEO",
      ],
      app_role: ["admin", "member", "system"],
    },
  },
} as const
