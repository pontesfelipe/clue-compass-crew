import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemberLobbyingRecord {
  id: string;
  industry: string;
  cycle: number;
  total_spent: number | null;
  client_count: number | null;
  updated_at: string | null;
}

export function useMemberLobbying(memberId: string | undefined, cycle?: number) {
  return useQuery({
    queryKey: ["member-lobbying", memberId, cycle ?? "latest"],
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MemberLobbyingRecord[]> => {
      if (!memberId) return [];
      let query = supabase
        .from("member_lobbying")
        .select("id, industry, cycle, total_spent, client_count, updated_at")
        .eq("member_id", memberId)
        .order("total_spent", { ascending: false })
        .limit(10);
      if (cycle) query = query.eq("cycle", cycle);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as MemberLobbyingRecord[];
    },
  });
}

