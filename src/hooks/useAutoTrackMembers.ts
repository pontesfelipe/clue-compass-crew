import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

// Map state abbreviation to full name
const STATE_ABBR_TO_NAME: Record<string, string> = {
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
  DC: "District of Columbia", PR: "Puerto Rico", VI: "Virgin Islands", GU: "Guam",
  AS: "American Samoa", MP: "Northern Mariana Islands"
};

interface DistrictLookupResult {
  state: string;
  district: string | null;
  source: string;
  error?: string;
}

async function lookupDistrictFromZip(zipCode: string): Promise<DistrictLookupResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("lookup-district", {
      body: { zipCode }
    });
    
    if (error) {
      console.error("District lookup error:", error);
      return null;
    }
    
    return data as DistrictLookupResult;
  } catch (err) {
    console.error("Failed to lookup district:", err);
    return null;
  }
}

interface AutoTrackParams {
  stateAbbr?: string;
  zipCode?: string;
}

export function useAutoTrackMembers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stateAbbr, zipCode }: AutoTrackParams) => {
      if (!user) throw new Error("Not authenticated");
      
      let resolvedState = stateAbbr;
      let resolvedDistrict: string | null = null;
      
      // If we have a ZIP code, use the Census API to get the exact district
      if (zipCode) {
        const districtInfo = await lookupDistrictFromZip(zipCode);
        if (districtInfo && districtInfo.state) {
          resolvedState = districtInfo.state;
          resolvedDistrict = districtInfo.district;
          console.log(`Resolved ZIP ${zipCode} to ${resolvedState}-${resolvedDistrict}`);
        }
      }
      
      if (!resolvedState) {
        console.error("No state could be determined");
        return { tracked: 0 };
      }

      const stateName = STATE_ABBR_TO_NAME[resolvedState];
      if (!stateName) {
        console.error("Unknown state abbreviation:", resolvedState);
        return { tracked: 0 };
      }

      // 1) Always track the 2 senators
      const { data: senators, error: senatorsError } = await supabase
        .from("members")
        .select("id, full_name, chamber, district")
        .eq("state", stateName)
        .eq("chamber", "senate")
        .eq("in_office", true) as { data: { id: string; full_name: string; chamber: "house" | "senate"; district: string | null }[] | null; error: any };

      if (senatorsError) throw senatorsError;

      // 2) Track specific representative based on district
      let representative: { id: string; full_name: string; chamber: "house" | "senate"; district: string | null } | null = null;
      
      if (resolvedDistrict) {
        const { data: rep } = await supabase
          .from("members")
          .select("id, full_name, chamber, district")
          .eq("state", stateName)
          .eq("chamber", "house")
          .eq("district", resolvedDistrict)
          .eq("in_office", true)
          .maybeSingle() as { data: { id: string; full_name: string; chamber: "house" | "senate"; district: string | null } | null };
        
        if (rep) representative = rep;
      }

      // Combine unique members to track
      const membersToConsider = [...(senators || [])];
      if (representative) membersToConsider.push(representative);

      if (membersToConsider.length === 0) {
        console.log("No members found for state:", stateName);
        return { tracked: 0 };
      }

      // Get already tracked
      const { data: existing } = await supabase
        .from("member_tracking")
        .select("member_id")
        .eq("user_id", user.id);

      const existingIds = new Set((existing || []).map(e => e.member_id));
      const toTrack = membersToConsider.filter(m => !existingIds.has(m.id));

      if (toTrack.length === 0) {
        return { tracked: 0, message: "Your representatives are already being tracked" };
      }

      const { error: insertError } = await supabase
        .from("member_tracking")
        .insert(toTrack.map(m => ({
          user_id: user.id,
          member_id: m.id,
        })));

      if (insertError) throw insertError;

      const senatorCount = toTrack.filter(m => m.chamber === "senate").length;
      const repCount = toTrack.filter(m => m.chamber === "house").length;

      return { 
        tracked: toTrack.length, 
        senators: senatorCount,
        representatives: repCount,
        members: toTrack.map(m => m.full_name)
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tracked-members"] });
      if (data.tracked > 0) {
        const parts = [];
        if (data.senators && data.senators > 0) parts.push(`${data.senators} senator${data.senators > 1 ? "s" : ""}`);
        if (data.representatives && data.representatives > 0) parts.push(`${data.representatives} representative`);
        
        toast({ 
          title: "Now tracking your representatives",
          description: data.members?.join(", ")
        });
      } else if (data.message) {
        toast({ title: data.message });
      }
    },
    onError: (error) => {
      console.error("Auto-track error:", error);
      toast({
        title: "Could not auto-track members",
        description: String(error),
        variant: "destructive"
      });
    }
  });
}
