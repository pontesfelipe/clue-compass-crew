import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Bill {
  id: string;
  congress: number;
  bill_type: string;
  bill_number: number;
  title: string;
  short_title: string | null;
  summary: string | null;
  introduced_date: string | null;
  latest_action_date: string | null;
  latest_action_text: string | null;
  enacted: boolean;
  enacted_date: string | null;
  policy_area: string | null;
  subjects: string[] | null;
  url: string | null;
  bill_impact: string | null;
  impact_generated_at: string | null;
}

export interface BillSponsor {
  id: string;
  member_id: string;
  is_sponsor: boolean;
  cosponsored_date: string | null;
  member: {
    id: string;
    full_name: string;
    party: "D" | "R" | "I" | "L";
    state: string;
    chamber: "house" | "senate";
    image_url: string | null;
  };
}

export interface BillVote {
  id: string;
  congress: number;
  chamber: "house" | "senate";
  roll_number: number;
  vote_date: string;
  question: string | null;
  result: string | null;
  total_yea: number | null;
  total_nay: number | null;
  total_present: number | null;
  total_not_voting: number | null;
}

export function useBill(billId: string) {
  return useQuery({
    queryKey: ["bill", billId],
    queryFn: async () => {
      // Fetch bill data
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .select("*")
        .eq("id", billId)
        .maybeSingle();

      if (billError) throw billError;
      if (!bill) return null;

      // Fetch sponsors
      const { data: sponsorships, error: sponsorError } = await supabase
        .from("bill_sponsorships")
        .select(`
          id,
          is_sponsor,
          cosponsored_date,
          member_id,
          members (
            id,
            full_name,
            party,
            state,
            chamber,
            image_url
          )
        `)
        .eq("bill_id", billId)
        .order("is_sponsor", { ascending: false });

      if (sponsorError) throw sponsorError;

      // Fetch votes related to this bill
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("*")
        .eq("bill_id", billId)
        .order("vote_date", { ascending: false });

      if (votesError) throw votesError;

      // Transform sponsorships
      const sponsors = (sponsorships || [])
        .filter((s: any) => s.members)
        .map((s: any) => ({
          id: s.id,
          member_id: s.member_id,
          is_sponsor: s.is_sponsor,
          cosponsored_date: s.cosponsored_date,
          member: s.members,
        }));

      const primarySponsor = sponsors.find((s: BillSponsor) => s.is_sponsor);
      const cosponsors = sponsors.filter((s: BillSponsor) => !s.is_sponsor);

      return {
        ...bill,
        primarySponsor,
        cosponsors,
        votes: votes || [],
      };
    },
    enabled: !!billId,
  });
}

export function formatBillNumber(bill: { bill_type: string; bill_number: number }): string {
  const typeMap: Record<string, string> = {
    hr: "H.R.",
    s: "S.",
    hjres: "H.J.Res.",
    sjres: "S.J.Res.",
    hconres: "H.Con.Res.",
    sconres: "S.Con.Res.",
    hres: "H.Res.",
    sres: "S.Res.",
  };
  const prefix = typeMap[bill.bill_type] || bill.bill_type?.toUpperCase() || "";
  return `${prefix}${bill.bill_number}`;
}
