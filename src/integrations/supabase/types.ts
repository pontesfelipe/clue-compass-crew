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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          model: string | null
          operation_type: string
          success: boolean | null
          tokens_used: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          operation_type: string
          success?: boolean | null
          tokens_used?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          operation_type?: string
          success?: boolean | null
          tokens_used?: number | null
        }
        Relationships: []
      }
      api_sources: {
        Row: {
          base_url: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          base_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      api_sync_runs: {
        Row: {
          created_at: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_processed: number | null
          job_type: string
          metadata: Json | null
          source_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_processed?: number | null
          job_type: string
          metadata?: Json | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_processed?: number | null
          job_type?: string
          metadata?: Json | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_sync_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "api_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_sponsorships: {
        Row: {
          bill_id: string
          cosponsored_date: string | null
          created_at: string | null
          id: string
          is_original_cosponsor: boolean | null
          is_sponsor: boolean | null
          member_id: string
        }
        Insert: {
          bill_id: string
          cosponsored_date?: string | null
          created_at?: string | null
          id?: string
          is_original_cosponsor?: boolean | null
          is_sponsor?: boolean | null
          member_id: string
        }
        Update: {
          bill_id?: string
          cosponsored_date?: string | null
          created_at?: string | null
          id?: string
          is_original_cosponsor?: boolean | null
          is_sponsor?: boolean | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_sponsorships_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_sponsorships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_impact: string | null
          bill_number: number
          bill_type: Database["public"]["Enums"]["bill_type"]
          congress: number
          created_at: string | null
          enacted: boolean | null
          enacted_date: string | null
          id: string
          impact_generated_at: string | null
          introduced_date: string | null
          latest_action_date: string | null
          latest_action_text: string | null
          policy_area: string | null
          raw: Json | null
          short_title: string | null
          subjects: string[] | null
          summary: string | null
          title: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          bill_impact?: string | null
          bill_number: number
          bill_type: Database["public"]["Enums"]["bill_type"]
          congress: number
          created_at?: string | null
          enacted?: boolean | null
          enacted_date?: string | null
          id?: string
          impact_generated_at?: string | null
          introduced_date?: string | null
          latest_action_date?: string | null
          latest_action_text?: string | null
          policy_area?: string | null
          raw?: Json | null
          short_title?: string | null
          subjects?: string[] | null
          summary?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          bill_impact?: string | null
          bill_number?: number
          bill_type?: Database["public"]["Enums"]["bill_type"]
          congress?: number
          created_at?: string | null
          enacted?: boolean | null
          enacted_date?: string | null
          id?: string
          impact_generated_at?: string | null
          introduced_date?: string | null
          latest_action_date?: string | null
          latest_action_text?: string | null
          policy_area?: string | null
          raw?: Json | null
          short_title?: string | null
          subjects?: string[] | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      data_anomalies: {
        Row: {
          anomaly_type: string
          created_at: string
          details_json: Json | null
          detected_at: string
          entity_id: string | null
          entity_type: string
          id: string
          resolved_at: string | null
          severity: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string
          details_json?: Json | null
          detected_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string
          details_json?: Json | null
          detected_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          resolved_at?: string | null
          severity?: string
        }
        Relationships: []
      }
      feature_toggles: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      funding_metrics: {
        Row: {
          computed_at: string
          created_at: string | null
          cycle: number
          grassroots_support_score: number | null
          id: string
          local_money_score: number | null
          member_id: string
          pac_dependence_score: number | null
          pct_from_committees: number | null
          pct_from_in_state: number | null
          pct_from_individuals: number | null
          pct_from_out_of_state: number | null
          pct_from_small_donors: number | null
          total_receipts: number | null
          updated_at: string | null
        }
        Insert: {
          computed_at?: string
          created_at?: string | null
          cycle: number
          grassroots_support_score?: number | null
          id?: string
          local_money_score?: number | null
          member_id: string
          pac_dependence_score?: number | null
          pct_from_committees?: number | null
          pct_from_in_state?: number | null
          pct_from_individuals?: number | null
          pct_from_out_of_state?: number | null
          pct_from_small_donors?: number | null
          total_receipts?: number | null
          updated_at?: string | null
        }
        Update: {
          computed_at?: string
          created_at?: string | null
          cycle?: number
          grassroots_support_score?: number | null
          id?: string
          local_money_score?: number | null
          member_id?: string
          pac_dependence_score?: number | null
          pct_from_committees?: number | null
          pct_from_in_state?: number | null
          pct_from_individuals?: number | null
          pct_from_out_of_state?: number | null
          pct_from_small_donors?: number | null
          total_receipts?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_metrics_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      governors: {
        Row: {
          capitol_address: string | null
          capitol_phone: string | null
          created_at: string | null
          email: string | null
          facebook_url: string | null
          first_name: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          is_current: boolean | null
          last_name: string | null
          name: string
          openstates_id: string | null
          party: string
          raw: Json | null
          state: string
          term_end: string | null
          term_start: string | null
          twitter_handle: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          capitol_address?: string | null
          capitol_phone?: string | null
          created_at?: string | null
          email?: string | null
          facebook_url?: string | null
          first_name?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_current?: boolean | null
          last_name?: string | null
          name: string
          openstates_id?: string | null
          party: string
          raw?: Json | null
          state: string
          term_end?: string | null
          term_start?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          capitol_address?: string | null
          capitol_phone?: string | null
          created_at?: string | null
          email?: string | null
          facebook_url?: string | null
          first_name?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_current?: boolean | null
          last_name?: string | null
          name?: string
          openstates_id?: string | null
          party?: string
          raw?: Json | null
          state?: string
          term_end?: string | null
          term_start?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      issue_questions: {
        Row: {
          created_at: string
          dimension: string | null
          id: string
          is_active: boolean
          issue_id: string
          question_text: string
          sort_order: number
          weight: number
        }
        Insert: {
          created_at?: string
          dimension?: string | null
          id?: string
          is_active?: boolean
          issue_id: string
          question_text: string
          sort_order?: number
          weight?: number
        }
        Update: {
          created_at?: string
          dimension?: string | null
          id?: string
          is_active?: boolean
          issue_id?: string
          question_text?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "issue_questions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_signals: {
        Row: {
          created_at: string
          description: string | null
          direction: number
          external_ref: string
          id: string
          issue_id: string
          signal_type: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          direction: number
          external_ref: string
          id?: string
          issue_id: string
          signal_type: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          direction?: number
          external_ref?: string
          id?: string
          issue_id?: string
          signal_type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "issue_signals_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          description: string | null
          icon_name: string | null
          id: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      member_committees: {
        Row: {
          chamber: string
          committee_code: string
          committee_name: string
          congress: number
          created_at: string | null
          id: string
          is_chair: boolean | null
          is_ranking_member: boolean | null
          member_id: string
          rank: number | null
          updated_at: string | null
        }
        Insert: {
          chamber: string
          committee_code: string
          committee_name: string
          congress: number
          created_at?: string | null
          id?: string
          is_chair?: boolean | null
          is_ranking_member?: boolean | null
          member_id: string
          rank?: number | null
          updated_at?: string | null
        }
        Update: {
          chamber?: string
          committee_code?: string
          committee_name?: string
          congress?: number
          created_at?: string | null
          id?: string
          is_chair?: boolean | null
          is_ranking_member?: boolean | null
          member_id?: string
          rank?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_committees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contributions: {
        Row: {
          amount: number
          committee_id: string | null
          committee_name: string | null
          contribution_uid: string | null
          contributor_city: string | null
          contributor_employer: string | null
          contributor_name: string
          contributor_occupation: string | null
          contributor_state: string | null
          contributor_type: string
          contributor_zip: string | null
          created_at: string | null
          cycle: number
          id: string
          industry: string | null
          member_id: string
          memo_text: string | null
          receipt_date: string | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          committee_id?: string | null
          committee_name?: string | null
          contribution_uid?: string | null
          contributor_city?: string | null
          contributor_employer?: string | null
          contributor_name: string
          contributor_occupation?: string | null
          contributor_state?: string | null
          contributor_type: string
          contributor_zip?: string | null
          created_at?: string | null
          cycle: number
          id?: string
          industry?: string | null
          member_id: string
          memo_text?: string | null
          receipt_date?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          committee_id?: string | null
          committee_name?: string | null
          contribution_uid?: string | null
          contributor_city?: string | null
          contributor_employer?: string | null
          contributor_name?: string
          contributor_occupation?: string | null
          contributor_state?: string | null
          contributor_type?: string
          contributor_zip?: string | null
          created_at?: string | null
          cycle?: number
          id?: string
          industry?: string | null
          member_id?: string
          memo_text?: string | null
          receipt_date?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_lobbying: {
        Row: {
          client_count: number | null
          created_at: string | null
          cycle: number
          id: string
          industry: string
          member_id: string
          total_spent: number
          updated_at: string | null
        }
        Insert: {
          client_count?: number | null
          created_at?: string | null
          cycle: number
          id?: string
          industry: string
          member_id: string
          total_spent?: number
          updated_at?: string | null
        }
        Update: {
          client_count?: number | null
          created_at?: string | null
          cycle?: number
          id?: string
          industry?: string
          member_id?: string
          total_spent?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_lobbying_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_scores: {
        Row: {
          attendance_score: number | null
          bills_cosponsored: number | null
          bills_enacted: number | null
          bills_sponsored: number | null
          bipartisan_bills: number | null
          bipartisanship_score: number | null
          calculated_at: string | null
          finance_influence_score: number | null
          governance_score: number | null
          id: string
          issue_alignment_score: number | null
          lobbying_alignment_score: number | null
          member_id: string
          overall_score: number | null
          productivity_score: number | null
          transparency_score: number | null
          user_id: string | null
          votes_cast: number | null
          votes_missed: number | null
        }
        Insert: {
          attendance_score?: number | null
          bills_cosponsored?: number | null
          bills_enacted?: number | null
          bills_sponsored?: number | null
          bipartisan_bills?: number | null
          bipartisanship_score?: number | null
          calculated_at?: string | null
          finance_influence_score?: number | null
          governance_score?: number | null
          id?: string
          issue_alignment_score?: number | null
          lobbying_alignment_score?: number | null
          member_id: string
          overall_score?: number | null
          productivity_score?: number | null
          transparency_score?: number | null
          user_id?: string | null
          votes_cast?: number | null
          votes_missed?: number | null
        }
        Update: {
          attendance_score?: number | null
          bills_cosponsored?: number | null
          bills_enacted?: number | null
          bills_sponsored?: number | null
          bipartisan_bills?: number | null
          bipartisanship_score?: number | null
          calculated_at?: string | null
          finance_influence_score?: number | null
          governance_score?: number | null
          id?: string
          issue_alignment_score?: number | null
          lobbying_alignment_score?: number | null
          member_id?: string
          overall_score?: number | null
          productivity_score?: number | null
          transparency_score?: number | null
          user_id?: string | null
          votes_cast?: number | null
          votes_missed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_sponsors: {
        Row: {
          created_at: string | null
          cycle: number
          id: string
          member_id: string
          relationship_type: string
          sponsor_name: string
          sponsor_type: string
          total_support: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cycle: number
          id?: string
          member_id: string
          relationship_type: string
          sponsor_name: string
          sponsor_type: string
          total_support?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cycle?: number
          id?: string
          member_id?: string
          relationship_type?: string
          sponsor_name?: string
          sponsor_type?: string
          total_support?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_sponsors_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_statements: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          statement_date: string
          statement_type: string | null
          subjects: string[] | null
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          statement_date: string
          statement_type?: string | null
          subjects?: string[] | null
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          statement_date?: string
          statement_type?: string | null
          subjects?: string[] | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_statements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_summaries: {
        Row: {
          generated_at: string
          id: string
          member_id: string
          summary: string
        }
        Insert: {
          generated_at?: string
          id?: string
          member_id: string
          summary: string
        }
        Update: {
          generated_at?: string
          id?: string
          member_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_summaries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_tracking: {
        Row: {
          created_at: string
          id: string
          member_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_tracking_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_votes: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          position: Database["public"]["Enums"]["vote_position"]
          position_normalized: string | null
          vote_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          position: Database["public"]["Enums"]["vote_position"]
          position_normalized?: string | null
          vote_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          position?: Database["public"]["Enums"]["vote_position"]
          position_normalized?: string | null
          vote_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_votes_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          bioguide_id: string
          chamber: Database["public"]["Enums"]["chamber_type"]
          created_at: string | null
          district: string | null
          end_date: string | null
          fec_candidate_id: string | null
          fec_committee_ids: string[] | null
          fec_last_synced_at: string | null
          first_name: string
          full_name: string
          id: string
          image_url: string | null
          in_office: boolean | null
          last_name: string
          office_address: string | null
          office_city: string | null
          office_state: string | null
          office_zip: string | null
          party: Database["public"]["Enums"]["party_type"]
          phone: string | null
          start_date: string | null
          state: string
          twitter_handle: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          bioguide_id: string
          chamber: Database["public"]["Enums"]["chamber_type"]
          created_at?: string | null
          district?: string | null
          end_date?: string | null
          fec_candidate_id?: string | null
          fec_committee_ids?: string[] | null
          fec_last_synced_at?: string | null
          first_name: string
          full_name: string
          id?: string
          image_url?: string | null
          in_office?: boolean | null
          last_name: string
          office_address?: string | null
          office_city?: string | null
          office_state?: string | null
          office_zip?: string | null
          party: Database["public"]["Enums"]["party_type"]
          phone?: string | null
          start_date?: string | null
          state: string
          twitter_handle?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          bioguide_id?: string
          chamber?: Database["public"]["Enums"]["chamber_type"]
          created_at?: string | null
          district?: string | null
          end_date?: string | null
          fec_candidate_id?: string | null
          fec_committee_ids?: string[] | null
          fec_last_synced_at?: string | null
          first_name?: string
          full_name?: string
          id?: string
          image_url?: string | null
          in_office?: boolean | null
          last_name?: string
          office_address?: string | null
          office_city?: string | null
          office_state?: string | null
          office_zip?: string | null
          party?: Database["public"]["Enums"]["party_type"]
          phone?: string | null
          start_date?: string | null
          state?: string
          twitter_handle?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          bill_notifications: boolean
          created_at: string
          email_enabled: boolean
          id: string
          score_change_notifications: boolean
          updated_at: string
          user_id: string
          vote_notifications: boolean
          weekly_digest: boolean
        }
        Insert: {
          bill_notifications?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          score_change_notifications?: boolean
          updated_at?: string
          user_id: string
          vote_notifications?: boolean
          weekly_digest?: boolean
        }
        Update: {
          bill_notifications?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          score_change_notifications?: boolean
          updated_at?: string
          user_id?: string
          vote_notifications?: boolean
          weekly_digest?: boolean
        }
        Relationships: []
      }
      policy_area_mappings: {
        Row: {
          created_at: string
          id: string
          issue_id: string | null
          policy_area: string
          relevance_weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id?: string | null
          policy_area: string
          relevance_weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string | null
          policy_area?: string
          relevance_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_area_mappings_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      politician_issue_positions: {
        Row: {
          data_points_count: number
          id: string
          issue_id: string
          politician_id: string
          score_value: number
          source_version: number
          updated_at: string
        }
        Insert: {
          data_points_count?: number
          id?: string
          issue_id: string
          politician_id: string
          score_value?: number
          source_version?: number
          updated_at?: string
        }
        Update: {
          data_points_count?: number
          id?: string
          issue_id?: string
          politician_id?: string
          score_value?: number
          source_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "politician_issue_positions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "politician_issue_positions_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_range: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          home_state: string | null
          id: string
          last_name: string | null
          profile_complete: boolean | null
          profile_version: number | null
          updated_at: string | null
          user_id: string
          zip_code: string | null
        }
        Insert: {
          age_range?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          home_state?: string | null
          id?: string
          last_name?: string | null
          profile_complete?: boolean | null
          profile_version?: number | null
          updated_at?: string | null
          user_id: string
          zip_code?: string | null
        }
        Update: {
          age_range?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          home_state?: string | null
          id?: string
          last_name?: string | null
          profile_complete?: boolean | null
          profile_version?: number | null
          updated_at?: string | null
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      sent_notifications: {
        Row: {
          id: string
          notification_type: string
          reference_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_type: string
          reference_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_type?: string
          reference_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      state_scores: {
        Row: {
          avg_attendance: number | null
          avg_bipartisanship: number | null
          avg_grassroots_support: number | null
          avg_issue_alignment: number | null
          avg_local_money: number | null
          avg_member_score: number | null
          avg_pac_dependence: number | null
          avg_pct_out_of_state: number | null
          avg_productivity: number | null
          created_at: string | null
          democrat_count: number | null
          house_count: number | null
          id: string
          independent_count: number | null
          last_calculated_at: string | null
          member_count: number | null
          republican_count: number | null
          senate_count: number | null
          state: string
          updated_at: string | null
        }
        Insert: {
          avg_attendance?: number | null
          avg_bipartisanship?: number | null
          avg_grassroots_support?: number | null
          avg_issue_alignment?: number | null
          avg_local_money?: number | null
          avg_member_score?: number | null
          avg_pac_dependence?: number | null
          avg_pct_out_of_state?: number | null
          avg_productivity?: number | null
          created_at?: string | null
          democrat_count?: number | null
          house_count?: number | null
          id?: string
          independent_count?: number | null
          last_calculated_at?: string | null
          member_count?: number | null
          republican_count?: number | null
          senate_count?: number | null
          state: string
          updated_at?: string | null
        }
        Update: {
          avg_attendance?: number | null
          avg_bipartisanship?: number | null
          avg_grassroots_support?: number | null
          avg_issue_alignment?: number | null
          avg_local_money?: number | null
          avg_member_score?: number | null
          avg_pac_dependence?: number | null
          avg_pct_out_of_state?: number | null
          avg_productivity?: number | null
          created_at?: string | null
          democrat_count?: number | null
          house_count?: number | null
          id?: string
          independent_count?: number | null
          last_calculated_at?: string | null
          member_count?: number | null
          republican_count?: number | null
          senate_count?: number | null
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_job_runs: {
        Row: {
          api_calls: number | null
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          job_id: string
          job_type: string
          metadata: Json | null
          provider: string
          records_fetched: number | null
          records_upserted: number | null
          scope: Json | null
          started_at: string | null
          status: string
          wait_time_ms: number | null
        }
        Insert: {
          api_calls?: number | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          job_type: string
          metadata?: Json | null
          provider: string
          records_fetched?: number | null
          records_upserted?: number | null
          scope?: Json | null
          started_at?: string | null
          status?: string
          wait_time_ms?: number | null
        }
        Update: {
          api_calls?: number | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          job_type?: string
          metadata?: Json | null
          provider?: string
          records_fetched?: number | null
          records_upserted?: number | null
          scope?: Json | null
          started_at?: string | null
          status?: string
          wait_time_ms?: number | null
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          attempt_count: number | null
          created_at: string
          cursor: Json | null
          frequency_minutes: number | null
          id: string
          is_enabled: boolean | null
          job_type: string
          last_error: string | null
          last_run_at: string | null
          max_duration_seconds: number | null
          next_run_at: string | null
          priority: number | null
          provider: string | null
          scope: Json | null
          status: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string
          cursor?: Json | null
          frequency_minutes?: number | null
          id: string
          is_enabled?: boolean | null
          job_type: string
          last_error?: string | null
          last_run_at?: string | null
          max_duration_seconds?: number | null
          next_run_at?: string | null
          priority?: number | null
          provider?: string | null
          scope?: Json | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string
          cursor?: Json | null
          frequency_minutes?: number | null
          id?: string
          is_enabled?: boolean | null
          job_type?: string
          last_error?: string | null
          last_run_at?: string | null
          max_duration_seconds?: number | null
          next_run_at?: string | null
          priority?: number | null
          provider?: string | null
          scope?: Json | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_progress: {
        Row: {
          created_at: string | null
          current_offset: number
          cursor: string | null
          cursor_json: Json | null
          error_message: string | null
          id: string
          last_failure_count: number | null
          last_matched_count: number | null
          last_run_at: string | null
          last_success_count: number | null
          last_synced_at: string | null
          lock_until: string | null
          metadata: Json | null
          status: string | null
          total_processed: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_offset?: number
          cursor?: string | null
          cursor_json?: Json | null
          error_message?: string | null
          id: string
          last_failure_count?: number | null
          last_matched_count?: number | null
          last_run_at?: string | null
          last_success_count?: number | null
          last_synced_at?: string | null
          lock_until?: string | null
          metadata?: Json | null
          status?: string | null
          total_processed?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_offset?: number
          cursor?: string | null
          cursor_json?: Json | null
          error_message?: string | null
          id?: string
          last_failure_count?: number | null
          last_matched_count?: number | null
          last_run_at?: string | null
          last_success_count?: number | null
          last_synced_at?: string | null
          lock_until?: string | null
          metadata?: Json | null
          status?: string | null
          total_processed?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          created_at: string | null
          dataset: string
          id: string
          last_cursor: Json | null
          last_modified: string | null
          last_success_at: string | null
          provider: string
          records_total: number | null
          scope_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dataset: string
          id?: string
          last_cursor?: Json | null
          last_modified?: string | null
          last_success_at?: string | null
          provider: string
          records_total?: number | null
          scope_key?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dataset?: string
          id?: string
          last_cursor?: Json | null
          last_modified?: string | null
          last_success_at?: string | null
          provider?: string
          records_total?: number | null
          scope_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          created_at: string | null
          id: string
          ip_address: string | null
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          terms_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_answers: {
        Row: {
          answer_value: number
          created_at: string
          id: string
          question_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_value: number
          created_at?: string
          id?: string
          question_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_value?: number
          created_at?: string
          id?: string
          question_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "issue_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_issue_priorities: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          priority_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          priority_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          priority_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_issue_priorities_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_politician_alignment: {
        Row: {
          breakdown: Json
          id: string
          last_computed_at: string
          overall_alignment: number
          politician_id: string
          profile_version: number
          user_id: string
        }
        Insert: {
          breakdown?: Json
          id?: string
          last_computed_at?: string
          overall_alignment: number
          politician_id: string
          profile_version?: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          id?: string
          last_computed_at?: string
          overall_alignment?: number
          politician_id?: string
          profile_version?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_politician_alignment_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
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
      user_scoring_preferences: {
        Row: {
          attendance_weight: number | null
          bipartisanship_weight: number | null
          created_at: string | null
          id: string
          issue_alignment_weight: number | null
          priority_issues: string[] | null
          productivity_weight: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_weight?: number | null
          bipartisanship_weight?: number | null
          created_at?: string | null
          id?: string
          issue_alignment_weight?: number | null
          priority_issues?: string[] | null
          productivity_weight?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_weight?: number | null
          bipartisanship_weight?: number | null
          created_at?: string | null
          id?: string
          issue_alignment_weight?: number | null
          priority_issues?: string[] | null
          productivity_weight?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          bill_id: string | null
          chamber: Database["public"]["Enums"]["chamber_type"]
          congress: number
          created_at: string | null
          description: string | null
          id: string
          question: string | null
          raw: Json | null
          result: string | null
          roll_number: number
          session: number
          total_nay: number | null
          total_not_voting: number | null
          total_present: number | null
          total_yea: number | null
          vote_date: string
        }
        Insert: {
          bill_id?: string | null
          chamber: Database["public"]["Enums"]["chamber_type"]
          congress: number
          created_at?: string | null
          description?: string | null
          id?: string
          question?: string | null
          raw?: Json | null
          result?: string | null
          roll_number: number
          session: number
          total_nay?: number | null
          total_not_voting?: number | null
          total_present?: number | null
          total_yea?: number | null
          vote_date: string
        }
        Update: {
          bill_id?: string | null
          chamber?: Database["public"]["Enums"]["chamber_type"]
          congress?: number
          created_at?: string | null
          description?: string | null
          id?: string
          question?: string | null
          raw?: Json | null
          result?: string | null
          roll_number?: number
          session?: number
          total_nay?: number | null
          total_not_voting?: number | null
          total_present?: number | null
          total_yea?: number | null
          vote_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      sync_health: {
        Row: {
          frequency_minutes: number | null
          health_status: string | null
          is_enabled: boolean | null
          job_id: string | null
          last_failure_count: number | null
          last_run_at: string | null
          last_success_count: number | null
          lock_until: string | null
          minutes_since_last_run: number | null
          status: string | null
          total_processed: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      age_range: "18-29" | "30-44" | "45-64" | "65+"
      app_role: "admin" | "moderator" | "user"
      bill_type:
        | "hr"
        | "s"
        | "hjres"
        | "sjres"
        | "hconres"
        | "sconres"
        | "hres"
        | "sres"
      chamber_type: "house" | "senate"
      party_type: "D" | "R" | "I" | "L"
      vote_position: "yea" | "nay" | "present" | "not_voting"
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
      age_range: ["18-29", "30-44", "45-64", "65+"],
      app_role: ["admin", "moderator", "user"],
      bill_type: [
        "hr",
        "s",
        "hjres",
        "sjres",
        "hconres",
        "sconres",
        "hres",
        "sres",
      ],
      chamber_type: ["house", "senate"],
      party_type: ["D", "R", "I", "L"],
      vote_position: ["yea", "nay", "present", "not_voting"],
    },
  },
} as const
