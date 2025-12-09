import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MemberPolicyAreasProps {
  memberId: string;
}

interface PolicyAreaCount {
  policy_area: string;
  count: number;
}

export function MemberPolicyAreas({ memberId }: MemberPolicyAreasProps) {
  const { data: policyAreas, isLoading } = useQuery({
    queryKey: ["member-policy-areas", memberId],
    queryFn: async () => {
      // Get all bills this member has sponsored or cosponsored
      const { data: sponsorships, error: sponsorshipsError } = await supabase
        .from("bill_sponsorships")
        .select("bill_id")
        .eq("member_id", memberId);

      if (sponsorshipsError) throw sponsorshipsError;
      if (!sponsorships || sponsorships.length === 0) return [];

      const billIds = sponsorships.map((s) => s.bill_id);

      // Get policy areas from these bills
      const { data: bills, error: billsError } = await supabase
        .from("bills")
        .select("policy_area")
        .in("id", billIds)
        .not("policy_area", "is", null);

      if (billsError) throw billsError;
      if (!bills) return [];

      // Count occurrences of each policy area
      const counts: Record<string, number> = {};
      bills.forEach((bill) => {
        if (bill.policy_area) {
          counts[bill.policy_area] = (counts[bill.policy_area] || 0) + 1;
        }
      });

      // Convert to array and sort by count
      const sorted: PolicyAreaCount[] = Object.entries(counts)
        .map(([policy_area, count]) => ({ policy_area, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return sorted;
    },
    enabled: !!memberId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Top Policy Areas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!policyAreas || policyAreas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Top Policy Areas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No policy area data available for this member.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = policyAreas[0]?.count || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Top Policy Areas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {policyAreas.map((area, index) => (
            <div key={area.policy_area} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  {area.policy_area}
                </span>
                <Badge variant="secondary">{area.count} bills</Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(area.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
