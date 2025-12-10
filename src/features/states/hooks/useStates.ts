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
      const { data, error } = await supabase
        .from("members")
        .select(`
          party,
          member_scores!inner (
            overall_score
          )
        `)
        .eq("in_office", true)
        .is("member_scores.user_id", null);

      if (error) throw error;

      const partyAggregates: Record<string, { total: number; count: number }> = {
        D: { total: 0, count: 0 },
        R: { total: 0, count: 0 },
        I: { total: 0, count: 0 },
      };

      (data || []).forEach((member) => {
        const party = member.party as string;
        const memberScores = member.member_scores as { overall_score: number | null }[];
        const score = memberScores?.[0]?.overall_score;

        if (party && score != null && partyAggregates[party]) {
          partyAggregates[party].total += Number(score);
          partyAggregates[party].count += 1;
        }
      });

      return {
        democratic: {
          avg: partyAggregates.D.count > 0 ? Math.round(partyAggregates.D.total / partyAggregates.D.count) : 0,
          count: partyAggregates.D.count,
        },
        republican: {
          avg: partyAggregates.R.count > 0 ? Math.round(partyAggregates.R.total / partyAggregates.R.count) : 0,
          count: partyAggregates.R.count,
        },
        independent: {
          avg: partyAggregates.I.count > 0 ? Math.round(partyAggregates.I.total / partyAggregates.I.count) : 0,
          count: partyAggregates.I.count,
        },
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
      const { data, error } = await supabase
        .from("members")
        .select(`
          chamber,
          member_scores!inner (
            overall_score
          )
        `)
        .eq("in_office", true)
        .is("member_scores.user_id", null);

      if (error) throw error;

      const chamberAggregates: Record<string, { total: number; count: number }> = {
        house: { total: 0, count: 0 },
        senate: { total: 0, count: 0 },
      };

      (data || []).forEach((member) => {
        const chamber = member.chamber as string;
        const memberScores = member.member_scores as { overall_score: number | null }[];
        const score = memberScores?.[0]?.overall_score;

        if (chamber && score != null && chamberAggregates[chamber]) {
          chamberAggregates[chamber].total += Number(score);
          chamberAggregates[chamber].count += 1;
        }
      });

      return {
        house: {
          avg: chamberAggregates.house.count > 0 ? Math.round(chamberAggregates.house.total / chamberAggregates.house.count) : 0,
          count: chamberAggregates.house.count,
        },
        senate: {
          avg: chamberAggregates.senate.count > 0 ? Math.round(chamberAggregates.senate.total / chamberAggregates.senate.count) : 0,
          count: chamberAggregates.senate.count,
        },
      };
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
      // Try to fetch from pre-computed state_scores table first
      const { data: precomputed, error: precomputedError } = await supabase
        .from("state_scores")
        .select("state, avg_member_score, member_count");

      if (!precomputedError && precomputed && precomputed.length > 0) {
        // Use pre-computed data
        return precomputed.map((row) => ({
          abbr: getStateAbbr(row.state),
          name: row.state,
          score: Math.round(Number(row.avg_member_score) || 0),
          memberCount: row.member_count || 0,
        }));
      }

      // Fallback: aggregate from members table
      const { data, error } = await supabase
        .from("members")
        .select(`
          state,
          member_scores!inner (
            overall_score
          )
        `)
        .eq("in_office", true)
        .is("member_scores.user_id", null);

      if (error) throw error;

      // Aggregate scores by state
      const stateAggregates: Record<string, { total: number; count: number }> = {};
      
      (data || []).forEach((member) => {
        const stateName = member.state;
        const memberScores = member.member_scores as { overall_score: number | null }[];
        const score = memberScores?.[0]?.overall_score;
        
        if (stateName && score != null) {
          const abbr = getStateAbbr(stateName);
          if (!stateAggregates[abbr]) {
            stateAggregates[abbr] = { total: 0, count: 0 };
          }
          stateAggregates[abbr].total += Number(score);
          stateAggregates[abbr].count += 1;
        }
      });

      // Convert to array with averages
      return Object.entries(stateAggregates).map(([abbr, agg]) => ({
        abbr,
        name: stateNames[abbr] || abbr,
        score: Math.round(agg.total / agg.count),
        memberCount: agg.count,
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
export function useStateMembers(stateAbbr: string) {
  const stateName = getStateName(stateAbbr);
  
  return useQuery({
    queryKey: ["state-members", stateAbbr],
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
        .eq("state", stateName)
        .eq("in_office", true)
        .is("member_scores.user_id", null)
        .order("overall_score", { referencedTable: "member_scores", ascending: false });

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
      const { data, error } = await supabase
        .from("members")
        .select(`
          id,
          member_scores!inner (
            overall_score,
            attendance_score,
            bipartisanship_score,
            bills_sponsored,
            votes_cast,
            votes_missed
          )
        `)
        .eq("state", stateName)
        .eq("in_office", true)
        .is("member_scores.user_id", null);

      if (error) throw error;

      const members = data || [];
      const memberCount = members.length;
      
      if (memberCount === 0) {
        return {
          memberCount: 0,
          avgScore: 0,
          totalBillsSponsored: 0,
          avgAttendance: 0,
          avgBipartisanship: 0,
        };
      }

      let totalScore = 0;
      let totalBillsSponsored = 0;
      let totalAttendance = 0;
      let totalBipartisanship = 0;

      members.forEach((m) => {
        const scores = (m.member_scores as Record<string, unknown>[])?.[0];
        if (scores) {
          totalScore += Number(scores.overall_score) || 0;
          totalBillsSponsored += Number(scores.bills_sponsored) || 0;
          totalAttendance += Number(scores.attendance_score) || 0;
          totalBipartisanship += Number(scores.bipartisanship_score) || 0;
        }
      });

      return {
        memberCount,
        avgScore: Math.round(totalScore / memberCount),
        totalBillsSponsored,
        avgAttendance: Math.round(totalAttendance / memberCount),
        avgBipartisanship: Math.round(totalBipartisanship / memberCount),
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
