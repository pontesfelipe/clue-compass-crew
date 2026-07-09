import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStateName } from "@/features/states/types";
import { useAlignmentProfile } from "./useAlignmentProfile";

interface MemberAlignment {
  id: string;
  full_name: string;
  party: string;
  chamber: string;
  state: string;
  image_url: string | null;
  overall_alignment: number;
}

export function useTopAlignments(limit = 5) {
  const { user } = useAuth();
  const { data: profile } = useAlignmentProfile();
  const userStateAbbr = profile?.state;
  const userStateFull = userStateAbbr ? getStateName(userStateAbbr) : null;

  return useQuery({
    queryKey: ["alignment", "top", user?.id, userStateAbbr, limit],
    queryFn: async (): Promise<{
      inState: MemberAlignment[];
      outOfState: MemberAlignment[];
    }> => {
      if (!user || !userStateFull) {
        return { inState: [], outOfState: [] };
      }

      // Get top cached alignments for this user (server-side ordered + capped)
      const { data: alignments, error: alignError } = await supabase
        .from("user_politician_alignment")
        .select("politician_id, overall_alignment")
        .eq("user_id", user.id)
        .order("overall_alignment", { ascending: false })
        .limit(200);

      if (alignError) throw alignError;
      if (!alignments?.length) {
        return { inState: [], outOfState: [] };
      }

      // Get member details for all aligned politicians
      const politicianIds = alignments.map((a) => a.politician_id);
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select("id, full_name, party, chamber, state, image_url")
        .in("id", politicianIds)
        .eq("in_office", true);

      if (membersError) throw membersError;
      if (!members?.length) {
        return { inState: [], outOfState: [] };
      }

      // Create a map for quick lookup
      const alignmentMap = new Map(
        alignments.map((a) => [a.politician_id, Number(a.overall_alignment)])
      );

      // Merge and sort
      const merged: MemberAlignment[] = members
        .map((m) => ({
          id: m.id,
          full_name: m.full_name,
          party: m.party,
          chamber: m.chamber,
          state: m.state,
          image_url: m.image_url,
          overall_alignment: alignmentMap.get(m.id) ?? 0,
        }))
        .sort((a, b) => b.overall_alignment - a.overall_alignment);

      // Split by state - compare full state names
      const inState = merged.filter((m) => m.state === userStateFull).slice(0, limit);
      const outOfState = merged.filter((m) => m.state !== userStateFull).slice(0, limit);

      return { inState, outOfState };
    },
    enabled: !!user && !!profile?.profile_complete && !!userStateFull,
  });
}
