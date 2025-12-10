import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DataFreshness {
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
  last_updated: string;
}

export function useDataFreshness() {
  return useQuery({
    queryKey: ["data-freshness"],
    queryFn: async (): Promise<DataFreshness> => {
      const { data, error } = await supabase.functions.invoke("data-status");
      
      if (error) {
        throw error;
      }
      
      return data;
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });
}

// Helper to format time ago
export function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
