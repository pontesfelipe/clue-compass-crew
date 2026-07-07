/**
 * State Hooks
 * Data fetching hooks for state-related data
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapApiMemberWithScores } from "@/lib/mappers";
import { getStateName, getStateAbbr, stateNames } from "../types";
import type { StateScore, StateStats } from "@/types/domain";
import type { MemberWithScore } from "@/types/domain";

/**
 * Fetch party-based score breakdown
 */
export function usePartyScores() {
  return useQuery({
    queryKey: ["party-scores"],
    queryFn: async () => {
      // Server-side aggregation via RPC — avoids PostgREST's 1000-row cap that
      // was silently sampling the members/member_scores join.
      const { data, error } = await supabase.rpc("get_party_score_aggregates");
      if (error) throw error;

      const byParty: Record<string, { avg: number; count: number }> = {
        D: { avg: 0, count: 0 },
        R: { avg: 0, count: 0 },
        I: { avg: 0, count: 0 },
      };
      for (const row of (data as { party: string; avg_score: number | null; member_count: number }[] | null) || []) {
        if (byParty[row.party]) {
          byParty[row.party] = {
            avg: Math.round(Number(row.avg_score) || 0),
            count: Number(row.member_count) || 0,
          };
        }
      }
      return {
        democratic: byParty.D,
        republican: byParty.R,
        independent: byParty.I,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch chamber-based score breakdown (House vs Senate)
 */
export function useChamberScores() {
  return useQuery({
    queryKey: ["chamber-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chamber_score_aggregates");
      if (error) throw error;

      const byChamber: Record<string, { avg: number; count: number }> = {
        house: { avg: 0, count: 0 },
        senate: { avg: 0, count: 0 },
      };
      for (const row of (data as { chamber: string; avg_score: number | null; member_count: number }[] | null) || []) {
        if (byChamber[row.chamber]) {
          byChamber[row.chamber] = {
            avg: Math.round(Number(row.avg_score) || 0),
            count: Number(row.member_count) || 0,
          };
        }
      }
      return { house: byChamber.house, senate: byChamber.senate };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all state scores for the map
 * Uses pre-computed state_scores table when available, falls back to member aggregation
 */
export function useStateScores() {
  return useQuery({
    queryKey: ["state-scores"],
    queryFn: async (): Promise<StateScore[]> => {
      // Try pre-computed state_scores first
      const { data: precomputed, error: precomputedError } = await supabase
        .from("state_scores")
        .select("state, avg_member_score, member_count");

      if (!precomputedError && precomputed && precomputed.length > 0) {
        return precomputed.map((row) => ({
          abbr: getStateAbbr(row.state),
          name: row.state,
          score: Math.round(Number(row.avg_member_score) || 0),
          memberCount: row.member_count || 0,
        }));
      }

      // Fallback: server-side aggregation via RPC (never client-side to avoid
      // the PostgREST 1000-row silent truncation on the join).
      const { data, error } = await supabase.rpc("get_state_score_aggregates");
      if (error) throw error;

      return ((data as { state: string; avg_score: number | null; member_count: number }[] | null) || []).map((row) => ({
        abbr: getStateAbbr(row.state),
        name: stateNames[getStateAbbr(row.state)] || row.state,
        score: Math.round(Number(row.avg_score) || 0),
        memberCount: Number(row.member_count) || 0,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * State funding scores interface
 */
export interface StateFundingScore {
  abbr: string;
  name: string;
  avgGrassrootsSupport: number | null;
  avgPacDependence: number | null;
  avgLocalMoney: number | null;
  avgPctOutOfState: number | null;
  memberCount: number;
}

/**
 * Fetch state funding scores for the funding layer
 */
export function useStateFundingScores() {
  return useQuery({
    queryKey: ["state-funding-scores"],
    queryFn: async (): Promise<StateFundingScore[]> => {
      const { data, error } = await supabase
        .from("state_scores")
        .select("state, avg_grassroots_support, avg_pac_dependence, avg_local_money, avg_pct_out_of_state, member_count");

      if (error) throw error;

      return (data || [])
        .filter((row) => row.avg_pac_dependence != null)
        .map((row) => ({
          abbr: getStateAbbr(row.state),
          name: row.state,
          avgGrassrootsSupport: row.avg_grassroots_support != null ? Math.round(Number(row.avg_grassroots_support)) : null,
          avgPacDependence: row.avg_pac_dependence != null ? Math.round(Number(row.avg_pac_dependence)) : null,
          avgLocalMoney: row.avg_local_money != null ? Math.round(Number(row.avg_local_money)) : null,
          avgPctOutOfState: row.avg_pct_out_of_state != null ? Math.round(Number(row.avg_pct_out_of_state)) : null,
          memberCount: row.member_count || 0,
        }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch members for a specific state
 */
export function useStateMembers(stateAbbr: string, level: "federal" | "state" = "federal") {
  const stateName = getStateName(stateAbbr);

  return useQuery({
    queryKey: ["state-members", stateAbbr, level],
    queryFn: async (): Promise<MemberWithScore[]> => {
      // Federal members are stored with the full state name; state legislators with the abbreviation.
      const stateValue = level === "state" ? stateAbbr.toUpperCase() : stateName;

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
        .eq("state", stateValue)
        .eq("level", level)
        .eq("in_office", true)
        .is("member_scores.user_id", null)
        .order("overall_score", { referencedTable: "member_scores", ascending: false });

      if (level === "state") {
        // State legislatures are large — raise the cap above the default 1000
        query = query.limit(5000);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((member) =>
        mapApiMemberWithScores(member as Record<string, unknown>)
      );
    },
    enabled: !!stateAbbr,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch statistics for a specific state
 */
export function useStateStats(stateAbbr: string) {
  const stateName = getStateName(stateAbbr);

  return useQuery({
    queryKey: ["state-stats", stateAbbr],
    queryFn: async (): Promise<StateStats> => {
      // Server-side aggregation via RPC — avoids silent 1000-row truncation.
      const { data, error } = await supabase.rpc("get_state_stat_aggregates", {
        p_state: stateName,
      });
      if (error) throw error;

      const row = (data as Array<{
        member_count: number;
        avg_score: number | null;
        total_bills_sponsored: number;
        avg_attendance: number | null;
        avg_bipartisanship: number | null;
      }> | null)?.[0];

      const memberCount = Number(row?.member_count) || 0;
      if (memberCount === 0) {
        return {
          memberCount: 0,
          avgScore: 0,
          totalBillsSponsored: 0,
          avgAttendance: 0,
          avgBipartisanship: 0,
        };
      }

      return {
        memberCount,
        avgScore: Math.round(Number(row?.avg_score) || 0),
        totalBillsSponsored: Number(row?.total_bills_sponsored) || 0,
        avgAttendance: Math.round(Number(row?.avg_attendance) || 0),
        avgBipartisanship: Math.round(Number(row?.avg_bipartisanship) || 0),
      };
    },
    enabled: !!stateAbbr,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Calculate national average from state scores
 */
export function getNationalAverage(stateScores: StateScore[]): number {
  if (!stateScores.length) return 0;
  const total = stateScores.reduce((sum, s) => sum + s.score * s.memberCount, 0);
  const count = stateScores.reduce((sum, s) => sum + s.memberCount, 0);
  return count > 0 ? Math.round(total / count) : 0;
}

// Re-export types and utilities for backward compatibility
export { stateNames, getStateName, getStateAbbr } from "../types";
