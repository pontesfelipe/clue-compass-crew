import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MemberPolicyAreasProps {
  memberId: string;
  memberState?: string;
  memberParty?: string;
}

interface PolicyAreaCount {
  policy_area: string;
  count: number;
  percentage?: number;
}

interface ComparisonData {
  memberAreas: PolicyAreaCount[];
  stateAreas: PolicyAreaCount[];
  partyAreas: PolicyAreaCount[];
}

async function fetchPolicyAreasForMember(memberId: string): Promise<PolicyAreaCount[]> {
  const { data: sponsorships, error: sponsorshipsError } = await supabase
    .from("bill_sponsorships")
    .select("bill_id")
    .eq("member_id", memberId);

  if (sponsorshipsError) throw sponsorshipsError;
  if (!sponsorships || sponsorships.length === 0) return [];

  const billIds = sponsorships.map((s) => s.bill_id);

  const { data: bills, error: billsError } = await supabase
    .from("bills")
    .select("policy_area")
    .in("id", billIds)
    .not("policy_area", "is", null);

  if (billsError) throw billsError;
  if (!bills) return [];

  const counts: Record<string, number> = {};
  bills.forEach((bill) => {
    if (bill.policy_area) {
      counts[bill.policy_area] = (counts[bill.policy_area] || 0) + 1;
    }
  });

  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return Object.entries(counts)
    .map(([policy_area, count]) => ({ 
      policy_area, 
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function fetchPolicyAreasForGroup(
  filterColumn: "state" | "party",
  filterValue: string,
  excludeMemberId: string
): Promise<PolicyAreaCount[]> {
  // Get all members in this group except the current one
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id")
    .eq(filterColumn, filterValue)
    .neq("id", excludeMemberId);

  if (membersError) throw membersError;
  if (!members || members.length === 0) return [];

  const memberIds = members.map((m) => m.id);

  // Get all sponsorships for these members
  const { data: sponsorships, error: sponsorshipsError } = await supabase
    .from("bill_sponsorships")
    .select("bill_id")
    .in("member_id", memberIds);

  if (sponsorshipsError) throw sponsorshipsError;
  if (!sponsorships || sponsorships.length === 0) return [];

  const billIds = [...new Set(sponsorships.map((s) => s.bill_id))];

  // Fetch bills in batches to avoid query limits
  const batchSize = 500;
  const allBills: { policy_area: string | null }[] = [];
  
  for (let i = 0; i < billIds.length; i += batchSize) {
    const batch = billIds.slice(i, i + batchSize);
    const { data: bills, error: billsError } = await supabase
      .from("bills")
      .select("policy_area")
      .in("id", batch)
      .not("policy_area", "is", null);

    if (billsError) throw billsError;
    if (bills) allBills.push(...bills);
  }

  const counts: Record<string, number> = {};
  allBills.forEach((bill) => {
    if (bill.policy_area) {
      counts[bill.policy_area] = (counts[bill.policy_area] || 0) + 1;
    }
  });

  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return Object.entries(counts)
    .map(([policy_area, count]) => ({ 
      policy_area, 
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function MemberPolicyAreas({ memberId, memberState, memberParty }: MemberPolicyAreasProps) {
  // Fetch member info if not provided
  const { data: memberInfo } = useQuery({
    queryKey: ["member-info-for-policy", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("state, party")
        .eq("id", memberId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !memberState || !memberParty,
  });

  const state = memberState || memberInfo?.state;
  const party = memberParty || memberInfo?.party;

  const { data, isLoading } = useQuery({
    queryKey: ["member-policy-comparison", memberId, state, party],
    queryFn: async (): Promise<ComparisonData> => {
      const [memberAreas, stateAreas, partyAreas] = await Promise.all([
        fetchPolicyAreasForMember(memberId),
        state ? fetchPolicyAreasForGroup("state", state, memberId) : Promise.resolve([]),
        party ? fetchPolicyAreasForGroup("party", party, memberId) : Promise.resolve([]),
      ]);

      return { memberAreas, stateAreas, partyAreas };
    },
    enabled: !!memberId && (!!state || !!party),
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

  if (!data || data.memberAreas.length === 0) {
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

  const partyName = party === "D" ? "Democrats" : party === "R" ? "Republicans" : "Independents";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Top Policy Areas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="member" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="member">This Member</TabsTrigger>
            <TabsTrigger value="state">vs State</TabsTrigger>
            <TabsTrigger value="party">vs Party</TabsTrigger>
          </TabsList>

          <TabsContent value="member" className="mt-0">
            <PolicyAreaList areas={data.memberAreas} />
          </TabsContent>

          <TabsContent value="state" className="mt-0">
            <ComparisonView
              memberAreas={data.memberAreas}
              compareAreas={data.stateAreas}
              label="state delegation"
            />
          </TabsContent>

          <TabsContent value="party" className="mt-0">
            <ComparisonView
              memberAreas={data.memberAreas}
              compareAreas={data.partyAreas}
              label={partyName}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PolicyAreaList({ areas }: { areas: PolicyAreaCount[] }) {
  const maxCount = areas[0]?.count || 1;

  return (
    <div className="space-y-3">
      {areas.map((area, index) => (
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
  );
}

function ComparisonView({ 
  memberAreas, 
  compareAreas, 
  label 
}: { 
  memberAreas: PolicyAreaCount[]; 
  compareAreas: PolicyAreaCount[];
  label: string;
}) {
  // Create a map of compare areas for quick lookup
  const compareMap = new Map(compareAreas.map(a => [a.policy_area, a.percentage || 0]));
  
  // Calculate differences
  const comparisons = memberAreas.map(area => {
    const memberPct = area.percentage || 0;
    const comparePct = compareMap.get(area.policy_area) || 0;
    const diff = memberPct - comparePct;
    
    return {
      ...area,
      memberPct,
      comparePct,
      diff,
    };
  });

  if (compareAreas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4 text-center">
        No comparison data available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-3">
        Showing focus compared to other {label} members
      </p>
      {comparisons.map((area, index) => (
        <div key={area.policy_area} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium flex items-center gap-2 truncate">
              <span className="text-muted-foreground">{index + 1}.</span>
              <span className="truncate">{area.policy_area}</span>
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <DiffIndicator diff={area.diff} />
            </div>
          </div>
          <div className="flex gap-1 h-2">
            <div className="flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${area.memberPct}%` }}
              />
            </div>
            <div className="flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-muted-foreground/40 rounded-full transition-all"
                style={{ width: `${area.comparePct}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Member: {area.memberPct.toFixed(1)}%</span>
            <span>{label}: {area.comparePct.toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffIndicator({ diff }: { diff: number }) {
  if (Math.abs(diff) < 1) {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Minus className="h-3 w-3" />
        Similar
      </Badge>
    );
  }
  
  if (diff > 0) {
    return (
      <Badge variant="outline" className={cn("text-xs gap-1 border-green-500/50 text-green-600 dark:text-green-400")}>
        <TrendingUp className="h-3 w-3" />
        +{diff.toFixed(0)}%
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className={cn("text-xs gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400")}>
      <TrendingDown className="h-3 w-3" />
      {diff.toFixed(0)}%
    </Badge>
  );
}
