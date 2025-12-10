import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAlignmentProfile } from "./useAlignmentProfile";

// Map state abbreviation to full name for comparison with members table
const stateAbbreviationToName: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", AS: "American Samoa", GU: "Guam", MP: "Northern Mariana Islands",
  PR: "Puerto Rico", VI: "Virgin Islands"
};

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
  const userStateFull = userStateAbbr ? stateAbbreviationToName[userStateAbbr] : null;

  return useQuery({
    queryKey: ["alignment", "top", user?.id, userStateAbbr, limit],
    queryFn: async (): Promise<{
      inState: MemberAlignment[];
      outOfState: MemberAlignment[];
    }> => {
      if (!user || !userStateFull) {
        return { inState: [], outOfState: [] };
      }

      // Get all cached alignments for this user
      const { data: alignments, error: alignError } = await supabase
        .from("user_politician_alignment")
        .select("politician_id, overall_alignment")
        .eq("user_id", user.id)
        .order("overall_alignment", { ascending: false });

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
