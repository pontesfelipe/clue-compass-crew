import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DataStatus {
  congress_members_last_synced_at: string | null;
  congress_members_status: string;
  congress_bills_last_synced_at: string | null;
  congress_bills_status: string;
  congress_bills_total: number;
  congress_votes_last_synced_at: string | null;
  congress_votes_status: string;
  congress_votes_total: number;
  fec_funding_last_synced_at: string | null;
  fec_funding_status: string;
  fec_funding_total: number;
  member_scores_last_synced_at: string | null;
  member_scores_status: string;
  classification?: {
    house: { total: number; classified: number };
    senate: { total: number; classified: number };
  };
  last_updated: string;
}

export function useDataStatus() {
  return useQuery({
    queryKey: ["data-status"],
    queryFn: async (): Promise<DataStatus | null> => {
      const { data, error } = await supabase.functions.invoke("data-status");
      if (error) throw error;
      return data as DataStatus;
    },
    staleTime: 60_000,
  });
}
