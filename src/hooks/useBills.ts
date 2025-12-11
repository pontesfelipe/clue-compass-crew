import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillListItem {
  id: string;
  congress: number;
  bill_type: string;
  bill_number: number;
  title: string;
  short_title: string | null;
  introduced_date: string | null;
  latest_action_date: string | null;
  latest_action_text: string | null;
  enacted: boolean;
  policy_area: string | null;
  summary: string | null;
  bill_impact: string | null;
}

interface UseBillsOptions {
  search?: string;
  policyArea?: string;
  congress?: number;
  enacted?: boolean | null;
  limit?: number;
  offset?: number;
}

export function useBills(options: UseBillsOptions = {}) {
  const { search, policyArea, congress, enacted, limit = 20, offset = 0 } = options;

  return useQuery({
    queryKey: ["bills", search, policyArea, congress, enacted, limit, offset],
    queryFn: async () => {
      let query = supabase
        .from("bills")
        .select("id, congress, bill_type, bill_number, title, short_title, introduced_date, latest_action_date, latest_action_text, enacted, policy_area, summary, bill_impact", { count: "exact" });

      if (search) {
        query = query.or(`title.ilike.%${search}%,short_title.ilike.%${search}%`);
      }

      if (policyArea && policyArea !== "all") {
        query = query.eq("policy_area", policyArea);
      }

      if (congress) {
        query = query.eq("congress", congress);
      }

      if (enacted !== null && enacted !== undefined) {
        query = query.eq("enacted", enacted);
      }

      const { data, error, count } = await query
        .order("latest_action_date", { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        bills: data as BillListItem[],
        totalCount: count || 0,
      };
    },
  });
}

export function usePolicyAreas() {
  return useQuery({
    queryKey: ["policy-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("policy_area")
        .not("policy_area", "is", null);

      if (error) throw error;

      // Get unique policy areas
      const uniqueAreas = [...new Set(data.map((b) => b.policy_area))].filter(Boolean).sort();
      return uniqueAreas as string[];
    },
  });
}

export function useCongressSessions() {
  return useQuery({
    queryKey: ["congress-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("congress")
        .order("congress", { ascending: false });

      if (error) throw error;

      // Get unique congress sessions
      const uniqueSessions = [...new Set(data.map((b) => b.congress))];
      return uniqueSessions;
    },
  });
}
