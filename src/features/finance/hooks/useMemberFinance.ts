import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contribution, Lobbying, Sponsor, MemberFinance, ContributionCompleteness } from "../types";

export interface FundingMetrics {
  cycle: number;
  total_receipts: number | null;
  pct_from_individuals: number | null;
  pct_from_committees: number | null;
  pct_from_small_donors: number | null;
  pct_from_in_state: number | null;
  pct_from_out_of_state: number | null;
  grassroots_support_score: number | null;
  pac_dependence_score: number | null;
  local_money_score: number | null;
  computed_at: string;
  contributions_fetched: number | null;
  contributions_total: number | null;
}

export interface MemberFinanceExtended extends MemberFinance {
  fundingMetrics: FundingMetrics[];
  memberState: string | null;
}

export function useMemberFinance(memberId: string) {
  return useQuery({
    queryKey: ["member-finance", memberId],
    queryFn: async (): Promise<MemberFinanceExtended> => {
      // Fetch all finance data in parallel
      const [contributionsRes, lobbyingRes, sponsorsRes, metricsRes, memberRes] = await Promise.all([
        supabase
          .from("member_contributions")
          .select("*")
          .eq("member_id", memberId)
          .order("amount", { ascending: false })
          .limit(100),
        supabase
          .from("member_lobbying")
          .select("*")
          .eq("member_id", memberId)
          .order("total_spent", { ascending: false })
          .limit(50),
        supabase
          .from("member_sponsors")
          .select("*")
          .eq("member_id", memberId)
          .order("total_support", { ascending: false })
          .limit(50),
        supabase
          .from("funding_metrics")
          .select("*")
          .eq("member_id", memberId)
          .order("cycle", { ascending: false }),
        supabase
          .from("members")
          .select("state")
          .eq("id", memberId)
          .single(),
      ]);

      if (contributionsRes.error) throw contributionsRes.error;
      if (lobbyingRes.error) throw lobbyingRes.error;
      if (sponsorsRes.error) throw sponsorsRes.error;

      const contributions: Contribution[] = (contributionsRes.data || []).map((c) => ({
        id: c.id,
        memberId: c.member_id,
        contributorName: c.contributor_name,
        contributorType: c.contributor_type as Contribution["contributorType"],
        amount: Number(c.amount),
        cycle: c.cycle,
        industry: c.industry,
        contributorState: c.contributor_state || null,
        contributorEmployer: c.contributor_employer || null,
        contributorOccupation: c.contributor_occupation || null,
        entityType: c.entity_type || null,
        entityTypeDesc: c.entity_type_desc || null,
      }));

      const lobbying: Lobbying[] = (lobbyingRes.data || []).map((l) => ({
        id: l.id,
        memberId: l.member_id,
        industry: l.industry,
        totalSpent: Number(l.total_spent),
        clientCount: l.client_count || 0,
        cycle: l.cycle,
      }));

      const sponsors: Sponsor[] = (sponsorsRes.data || []).map((s) => ({
        id: s.id,
        memberId: s.member_id,
        sponsorName: s.sponsor_name,
        sponsorType: s.sponsor_type as Sponsor["sponsorType"],
        relationshipType: s.relationship_type as Sponsor["relationshipType"],
        totalSupport: Number(s.total_support),
        cycle: s.cycle,
      }));

      // Full funding metrics for analytics display
      const fundingMetrics: FundingMetrics[] = (metricsRes.data || []).map((m: any) => ({
        cycle: m.cycle,
        total_receipts: m.total_receipts,
        pct_from_individuals: m.pct_from_individuals,
        pct_from_committees: m.pct_from_committees,
        pct_from_small_donors: m.pct_from_small_donors,
        pct_from_in_state: m.pct_from_in_state,
        pct_from_out_of_state: m.pct_from_out_of_state,
        grassroots_support_score: m.grassroots_support_score,
        pac_dependence_score: m.pac_dependence_score,
        local_money_score: m.local_money_score,
        computed_at: m.computed_at,
        contributions_fetched: m.contributions_fetched,
        contributions_total: m.contributions_total,
      }));

      // Parse contribution completeness from funding_metrics
      const contributionCompleteness: ContributionCompleteness[] = fundingMetrics
        .filter((m) => m.contributions_fetched !== null && m.contributions_fetched > 0)
        .map((m) => ({
          cycle: m.cycle,
          fetched: m.contributions_fetched || 0,
          total: m.contributions_total,
        }));

      // Calculate totals
      const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
      const totalLobbying = lobbying.reduce((sum, l) => sum + l.totalSpent, 0);

      // Calculate top industries
      const industryAmounts = new Map<string, number>();
      contributions.forEach((c) => {
        if (c.industry) {
          industryAmounts.set(c.industry, (industryAmounts.get(c.industry) || 0) + c.amount);
        }
      });
      lobbying.forEach((l) => {
        industryAmounts.set(l.industry, (industryAmounts.get(l.industry) || 0) + l.totalSpent);
      });

      const topIndustries = Array.from(industryAmounts.entries())
        .map(([industry, amount]) => ({ industry, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        contributions,
        lobbying,
        sponsors,
        totalContributions,
        totalLobbying,
        topIndustries,
        contributionCompleteness,
        fundingMetrics,
        memberState: memberRes.data?.state || null,
      };
    },
    enabled: !!memberId,
  });
}
