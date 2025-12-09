import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Member {
  id: string;
  bioguide_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  state: string;
  district: string | null;
  party: "D" | "R" | "I";
  chamber: "senate" | "house";
  image_url: string | null;
  website_url: string | null;
  twitter_handle: string | null;
  in_office: boolean;
  start_date: string | null;
  end_date: string | null;
  score?: number;
}

export interface MemberWithScore extends Member {
  member_scores: {
    overall_score: number | null;
    productivity_score: number | null;
    attendance_score: number | null;
    bipartisanship_score: number | null;
    issue_alignment_score: number | null;
    votes_cast: number | null;
    votes_missed: number | null;
    bills_sponsored: number | null;
    bills_cosponsored: number | null;
    bills_enacted: number | null;
    bipartisan_bills: number | null;
  }[];
}

export function useMembers(options?: { 
  chamber?: "senate" | "house";
  state?: string;
  party?: "D" | "R" | "I";
  limit?: number;
  orderBy?: "score" | "name";
}) {
  return useQuery({
    queryKey: ["members", options],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select(`
          *,
          member_scores!inner (
            overall_score,
            productivity_score,
            attendance_score,
            bipartisanship_score,
            issue_alignment_score,
            votes_cast,
            votes_missed,
            bills_sponsored,
            bills_cosponsored,
            bills_enacted,
            bipartisan_bills
          )
        `)
        .eq("in_office", true)
        .is("member_scores.user_id", null);

      if (options?.chamber) {
        query = query.eq("chamber", options.chamber);
      }

      if (options?.state) {
        query = query.eq("state", options.state);
      }

      if (options?.party) {
        query = query.eq("party", options.party);
      }

      if (options?.orderBy === "score") {
        query = query.order("member_scores.overall_score", { ascending: false });
      } else {
        query = query.order("full_name");
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform to include score at top level
      return (data as MemberWithScore[]).map((member) => ({
        ...member,
        score: member.member_scores?.[0]?.overall_score ?? 0,
      }));
    },
  });
}

export function useMember(memberId: string) {
  return useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(`
          *,
          member_scores (
            overall_score,
            productivity_score,
            attendance_score,
            bipartisanship_score,
            issue_alignment_score,
            votes_cast,
            votes_missed,
            bills_sponsored,
            bills_cosponsored,
            bills_enacted,
            bipartisan_bills
          ),
          bill_sponsorships (
            is_sponsor,
            cosponsored_date,
            bills (
              id,
              title,
              short_title,
              bill_type,
              bill_number,
              congress,
              introduced_date,
              latest_action_text,
              latest_action_date,
              enacted,
              enacted_date,
              policy_area
            )
          )
        `)
        .eq("id", memberId)
        .is("member_scores.user_id", null)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const memberData = data as any;
      const scores = memberData.member_scores?.[0] ?? null;
      
      // Get sponsored bills (most recent first)
      const sponsorships = memberData.bill_sponsorships || [];
      const sponsoredBills = sponsorships
        .filter((s: any) => s.is_sponsor && s.bills)
        .map((s: any) => s.bills)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.latest_action_date || a.introduced_date || 0);
          const dateB = new Date(b.latest_action_date || b.introduced_date || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5);

      return {
        ...memberData,
        score: scores?.overall_score ?? 0,
        scores,
        sponsoredBills,
      };
    },
    enabled: !!memberId,
  });
}

export function useTopMembers(limit = 4) {
  return useQuery({
    queryKey: ["top-members", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(`
          *,
          member_scores!inner (
            overall_score,
            productivity_score,
            attendance_score,
            bipartisanship_score,
            issue_alignment_score,
            votes_cast,
            votes_missed,
            bills_sponsored,
            bills_cosponsored,
            bills_enacted,
            bipartisan_bills
          )
        `)
        .eq("in_office", true)
        .is("member_scores.user_id", null)
        .order("overall_score", { referencedTable: "member_scores", ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data as unknown as MemberWithScore[]).map((member) => ({
        ...member,
        score: member.member_scores?.[0]?.overall_score ?? 0,
      }));
    },
  });
}
