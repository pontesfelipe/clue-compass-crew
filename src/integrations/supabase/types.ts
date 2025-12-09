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
          short_title?: string | null
          subjects?: string[] | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      member_contributions: {
        Row: {
          amount: number
          contributor_name: string
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
          id: string
          issue_alignment_score: number | null
          member_id: string
          overall_score: number | null
          productivity_score: number | null
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
          id?: string
          issue_alignment_score?: number | null
          member_id: string
          overall_score?: number | null
          productivity_score?: number | null
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
          id?: string
          issue_alignment_score?: number | null
          member_id?: string
          overall_score?: number | null
          productivity_score?: number | null
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
          vote_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          position: Database["public"]["Enums"]["vote_position"]
          vote_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          position?: Database["public"]["Enums"]["vote_position"]
          vote_id?: string
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
          home_state: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          home_state?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          home_state?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_progress: {
        Row: {
          created_at: string | null
          current_offset: number
          id: string
          last_matched_count: number | null
          last_run_at: string | null
          status: string | null
          total_processed: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_offset?: number
          id: string
          last_matched_count?: number | null
          last_run_at?: string | null
          status?: string | null
          total_processed?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_offset?: number
          id?: string
          last_matched_count?: number | null
          last_run_at?: string | null
          status?: string | null
          total_processed?: number | null
          updated_at?: string | null
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
      [_ in never]: never
    }
    Enums: {
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
