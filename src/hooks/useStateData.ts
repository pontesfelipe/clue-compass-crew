import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StateScore {
  abbr: string;
  name: string;
  score: number;
  memberCount: number;
}

const stateNames: { [key: string]: string } = {
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

// Reverse lookup: full name to abbreviation
const stateAbbreviations: { [key: string]: string } = Object.entries(stateNames).reduce(
  (acc, [abbr, name]) => ({ ...acc, [name]: abbr }),
  {}
);

// Helper to get full state name from abbreviation
function getStateName(abbr: string): string {
  return stateNames[abbr.toUpperCase()] || abbr;
}

// Helper to get abbreviation from full state name
function getStateAbbr(name: string): string {
  return stateAbbreviations[name] || name;
}

export function useStateScores() {
  return useQuery({
    queryKey: ["state-scores"],
    queryFn: async () => {
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

      // Aggregate scores by state (state is stored as full name in DB)
      const stateAggregates: { [key: string]: { total: number; count: number } } = {};
      
      (data || []).forEach((member: any) => {
        const stateName = member.state;
        const score = member.member_scores?.[0]?.overall_score;
        
        if (stateName && score != null) {
          // Convert full name to abbreviation for consistent keys
          const abbr = getStateAbbr(stateName);
          if (!stateAggregates[abbr]) {
            stateAggregates[abbr] = { total: 0, count: 0 };
          }
          stateAggregates[abbr].total += Number(score);
          stateAggregates[abbr].count += 1;
        }
      });

      // Convert to array with averages
      const stateScores: StateScore[] = Object.entries(stateAggregates).map(([abbr, agg]) => ({
        abbr,
        name: stateNames[abbr] || abbr,
        score: Math.round(agg.total / agg.count),
        memberCount: agg.count,
      }));

      return stateScores;
    },
  });
}

export function useStateMembers(stateAbbr: string) {
  const stateName = getStateName(stateAbbr);
  
  return useQuery({
    queryKey: ["state-members", stateAbbr],
    queryFn: async () => {
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

      return (data || []).map((member: any) => ({
        ...member,
        score: member.member_scores?.[0]?.overall_score ?? 0,
        scores: member.member_scores?.[0] ?? null,
      }));
    },
    enabled: !!stateAbbr,
  });
}

export function useStateStats(stateAbbr: string) {
  const stateName = getStateName(stateAbbr);
  
  return useQuery({
    queryKey: ["state-stats", stateAbbr],
    queryFn: async () => {
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

      members.forEach((m: any) => {
        const scores = m.member_scores?.[0];
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
  });
}

export function getNationalAverage(stateScores: StateScore[]) {
  if (!stateScores.length) return 0;
  const total = stateScores.reduce((sum, s) => sum + s.score * s.memberCount, 0);
  const count = stateScores.reduce((sum, s) => sum + s.memberCount, 0);
  return count > 0 ? Math.round(total / count) : 0;
}

export { stateNames, getStateName, getStateAbbr };
