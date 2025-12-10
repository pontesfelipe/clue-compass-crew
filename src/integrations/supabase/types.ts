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
          bill_number: number
          bill_type: Database["public"]["Enums"]["bill_type"]
          congress: number
          created_at: string | null
          enacted: boolean | null
          enacted_date: string | null
          id: string
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
          bill_number: number
          bill_type: Database["public"]["Enums"]["bill_type"]
          congress: number
          created_at?: string | null
          enacted?: boolean | null
          enacted_date?: string | null
          id?: string
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
          bill_number?: number
          bill_type?: Database["public"]["Enums"]["bill_type"]
          congress?: number
          created_at?: string | null
          enacted?: boolean | null
          enacted_date?: string | null
          id?: string
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
          contributor_name: string
          contributor_state: string | null
          contributor_type: string
          created_at: string | null
          cycle: number
          id: string
          industry: string | null
          member_id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          contributor_name: string
          contributor_state?: string | null
          contributor_type: string
          created_at?: string | null
          cycle: number
          id?: string
          industry?: string | null
          member_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          contributor_name?: string
          contributor_state?: string | null
          contributor_type?: string
          created_at?: string | null
          cycle?: number
          id?: string
          industry?: string | null
          member_id?: string
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
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          home_state: string | null
          id: string
          last_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          home_state?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          home_state?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
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
      sync_progress: {
        Row: {
          created_at: string | null
          current_offset: number
          cursor: string | null
          error_message: string | null
          id: string
          last_matched_count: number | null
          last_run_at: string | null
          last_synced_at: string | null
          metadata: Json | null
          status: string | null
          total_processed: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_offset?: number
          cursor?: string | null
          error_message?: string | null
          id: string
          last_matched_count?: number | null
          last_run_at?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          status?: string | null
          total_processed?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_offset?: number
          cursor?: string | null
          error_message?: string | null
          id?: string
          last_matched_count?: number | null
          last_run_at?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          status?: string | null
          total_processed?: number | null
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
      [_ in never]: never
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
