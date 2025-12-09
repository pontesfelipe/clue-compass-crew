/**
 * Member Hooks
 * Data fetching hooks for member-related data
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapApiMemberWithScores, mapApiBillToBill } from "@/lib/mappers";
import type { MemberWithScore, Bill } from "@/types/domain";
import type { MemberQueryOptions, VoteHistoryItem } from "../types";

/**
 * Fetch members with optional filters
 */
export function useMembers(options?: MemberQueryOptions) {
  return useQuery({
    queryKey: ["members", options],
    queryFn: async (): Promise<MemberWithScore[]> => {
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
        query = query.order("overall_score", { referencedTable: "member_scores", ascending: false });
      } else {
        query = query.order("full_name");
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((member) => 
        mapApiMemberWithScores(member as Record<string, unknown>)
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single member with full details
 */
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
          ),
          member_votes (
            position,
            votes (
              id,
              congress,
              chamber,
              roll_number,
              vote_date,
              question,
              description,
              result,
              total_yea,
              total_nay,
              bill_id
            )
          )
        `)
        .eq("id", memberId)
        .is("member_scores.user_id", null)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const memberData = data as Record<string, unknown>;
      const memberScoresArray = memberData.member_scores as Record<string, unknown>[];
      const scores = memberScoresArray?.[0] ?? null;
      
      // Get sponsored bills (most recent first)
      const sponsorships = (memberData.bill_sponsorships as Record<string, unknown>[]) || [];
      const sponsoredBills: Bill[] = sponsorships
        .filter((s) => s.is_sponsor && s.bills)
        .map((s) => mapApiBillToBill(s.bills as Record<string, unknown>))
        .sort((a, b) => {
          const dateA = new Date(a.latestActionDate || a.introducedDate || 0);
          const dateB = new Date(b.latestActionDate || b.introducedDate || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5);

      // Get cosponsored bills (most recent first)
      const cosponsoredBills: Bill[] = sponsorships
        .filter((s) => !s.is_sponsor && s.bills)
        .map((s) => {
          const bill = mapApiBillToBill(s.bills as Record<string, unknown>);
          return { ...bill, cosponsoredDate: s.cosponsored_date as string | null };
        })
        .sort((a, b) => {
          const dateA = new Date((a as unknown as { cosponsoredDate: string }).cosponsoredDate || a.introducedDate || 0);
          const dateB = new Date((b as unknown as { cosponsoredDate: string }).cosponsoredDate || b.introducedDate || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5);

      // Get vote history (most recent first)
      const memberVotes = (memberData.member_votes as Record<string, unknown>[]) || [];
      const voteHistory: VoteHistoryItem[] = memberVotes
        .filter((v) => v.votes)
        .map((v) => {
          const vote = v.votes as Record<string, unknown>;
          return {
            id: String(vote.id ?? ""),
            congress: Number(vote.congress) || 0,
            chamber: String(vote.chamber ?? ""),
            rollNumber: Number(vote.roll_number) || 0,
            voteDate: String(vote.vote_date ?? ""),
            question: vote.question ? String(vote.question) : null,
            description: vote.description ? String(vote.description) : null,
            result: vote.result ? String(vote.result) : null,
            totalYea: vote.total_yea != null ? Number(vote.total_yea) : null,
            totalNay: vote.total_nay != null ? Number(vote.total_nay) : null,
            position: String(v.position ?? ""),
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.voteDate || 0);
          const dateB = new Date(b.voteDate || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10);

      const member = mapApiMemberWithScores(memberData);

      return {
        ...member,
        scores: scores ? {
          overallScore: Number(scores.overall_score) || 0,
          productivityScore: Number(scores.productivity_score) || 0,
          attendanceScore: Number(scores.attendance_score) || 0,
          bipartisanshipScore: Number(scores.bipartisanship_score) || 0,
          issueAlignmentScore: Number(scores.issue_alignment_score) || 0,
          votesCast: Number(scores.votes_cast) || 0,
          votesMissed: Number(scores.votes_missed) || 0,
          billsSponsored: Number(scores.bills_sponsored) || 0,
          billsCosponsored: Number(scores.bills_cosponsored) || 0,
          billsEnacted: Number(scores.bills_enacted) || 0,
          bipartisanBills: Number(scores.bipartisan_bills) || 0,
        } : null,
        sponsoredBills,
        cosponsoredBills,
        voteHistory,
      };
    },
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch top performing members
 */
export function useTopMembers(limit = 4) {
  return useQuery({
    queryKey: ["top-members", limit],
    queryFn: async (): Promise<MemberWithScore[]> => {
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

      return (data || []).map((member) => 
        mapApiMemberWithScores(member as Record<string, unknown>)
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}
