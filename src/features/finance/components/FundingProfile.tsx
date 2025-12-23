import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, Users, Building2, MapPin, Leaf, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface FundingMetrics {
  id: string;
  member_id: string;
  cycle: number;
  total_receipts: number;
  pct_from_individuals: number | null;
  pct_from_committees: number | null;
  pct_from_small_donors: number | null;
  pct_from_in_state: number | null;
  pct_from_out_of_state: number | null;
  grassroots_support_score: number | null;
  pac_dependence_score: number | null;
  local_money_score: number | null;
  computed_at: string;
}

interface FundingProfileProps {
  memberId: string;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function ScoreGauge({ 
  label, 
  score, 
  tooltip, 
  color = "primary" 
}: { 
  label: string; 
  score: number | null; 
  tooltip: string;
  color?: "primary" | "success" | "warning" | "destructive";
}) {
  const displayScore = score ?? 50;
  
  const colorClasses = {
    primary: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    destructive: "bg-red-500",
  };

  const getScoreColor = (s: number) => {
    if (s >= 70) return colorClasses.success;
    if (s >= 40) return colorClasses.warning;
    return colorClasses.destructive;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-muted/50 rounded-xl p-4 cursor-help">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold">{displayScore}</span>
              <span className="text-sm text-muted-foreground mb-1">/100</span>
            </div>
            <Progress 
              value={displayScore} 
              className={cn("h-2 mt-2", getScoreColor(displayScore))}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StackedBar({ 
  leftLabel, 
  rightLabel, 
  leftValue, 
  rightValue,
  leftColor = "bg-civic-blue",
  rightColor = "bg-civic-red",
}: {
  leftLabel: string;
  rightLabel: string;
  leftValue: number | null;
  rightValue: number | null;
  leftColor?: string;
  rightColor?: string;
}) {
  const left = leftValue ?? 50;
  const right = rightValue ?? 50;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{leftLabel}: <span className="font-medium text-foreground">{left.toFixed(0)}%</span></span>
        <span className="text-muted-foreground">{rightLabel}: <span className="font-medium text-foreground">{right.toFixed(0)}%</span></span>
      </div>
      <div className="h-3 flex rounded-full overflow-hidden">
        <div className={cn(leftColor, "transition-all")} style={{ width: `${left}%` }} />
        <div className={cn(rightColor, "transition-all")} style={{ width: `${right}%` }} />
      </div>
    </div>
  );
}

export function FundingProfile({ memberId }: FundingProfileProps) {
  const [selectedCycle, setSelectedCycle] = useState<number | null>(null);

  // Fetch funding metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["funding-metrics", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_metrics")
        .select("*")
        .eq("member_id", memberId)
        .order("cycle", { ascending: false });

      if (error) throw error;
      return data as FundingMetrics[];
    },
    enabled: !!memberId,
  });

  // Fetch contributions as fallback when no funding_metrics exist
  const { data: contributionsData, isLoading: contributionsLoading } = useQuery({
    queryKey: ["member-contributions-summary", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_contributions")
        .select("cycle, amount, contributor_type, contributor_state, industry")
        .eq("member_id", memberId);

      if (error) throw error;
      return data;
    },
    enabled: !!memberId && (!metricsData || metricsData.length === 0),
  });

  const isLoading = metricsLoading || contributionsLoading;
  const data = metricsData;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show contribution-based summary if no funding_metrics but contributions exist
  if ((!data || data.length === 0) && contributionsData && contributionsData.length > 0) {
    // Calculate summary from contributions
    const cycles = [...new Set(contributionsData.map(c => c.cycle))].sort((a, b) => b - a);
    const currentCycle = selectedCycle ?? cycles[0];
    const cycleContributions = contributionsData.filter(c => c.cycle === currentCycle);
    
    const totalRaised = cycleContributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const individualCount = cycleContributions.filter(c => c.contributor_type === 'individual').length;
    const pacCount = cycleContributions.filter(c => c.contributor_type === 'committee' || c.contributor_type === 'pac').length;
    const totalCount = individualCount + pacCount;
    const pctIndividuals = totalCount > 0 ? (individualCount / totalCount) * 100 : 0;
    const pctPacs = totalCount > 0 ? (pacCount / totalCount) * 100 : 0;
    
    // Get top industries
    const industryTotals: Record<string, number> = {};
    cycleContributions.forEach(c => {
      if (c.industry) {
        industryTotals[c.industry] = (industryTotals[c.industry] || 0) + Number(c.amount || 0);
      }
    });
    const topIndustries = Object.entries(industryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                Funding Profile (FEC Data)
              </CardTitle>
              <CardDescription className="mt-1">
                Campaign finance data from the Federal Election Commission
              </CardDescription>
            </div>
            
            {/* Cycle Selector */}
            {cycles.length > 1 && (
              <div className="flex gap-1">
                {cycles.map((cycle) => (
                  <Badge
                    key={cycle}
                    variant={cycle === currentCycle ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => setSelectedCycle(cycle)}
                  >
                    {cycle}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Total Raised */}
          <div className="text-center p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Total Raised ({currentCycle} Cycle)</p>
            <p className="text-3xl font-bold">{formatCurrency(totalRaised)}</p>
          </div>

          {/* Funding Sources */}
          {totalCount > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Funding Sources (by count)</span>
              </div>
              <StackedBar
                leftLabel="Individuals"
                rightLabel="PACs/Committees"
                leftValue={pctIndividuals}
                rightValue={pctPacs}
                leftColor="bg-emerald-500"
                rightColor="bg-amber-500"
              />
            </div>
          )}

          {/* Top Industries */}
          {topIndustries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Top Industries</span>
              </div>
              <div className="space-y-2">
                {topIndustries.map(([industry, amount]) => (
                  <div key={industry} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{industry}</span>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Based on {cycleContributions.length} contribution records
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            Funding Profile (FEC Data)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              FEC funding data is not available for this member yet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Data will be synced during the next scheduled update.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableCycles = data.map((d) => d.cycle);
  const currentCycle = selectedCycle ?? availableCycles[0];
  const metrics = data.find((d) => d.cycle === currentCycle);

  if (!metrics) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Funding Profile (FEC Data)
            </CardTitle>
            <CardDescription className="mt-1">
              Campaign finance data from the Federal Election Commission
            </CardDescription>
          </div>
          
          {/* Cycle Selector */}
          <div className="flex gap-1">
            {availableCycles.map((cycle) => (
              <Badge
                key={cycle}
                variant={cycle === currentCycle ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => setSelectedCycle(cycle)}
              >
                {cycle}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Total Raised */}
        <div className="text-center p-4 bg-muted/50 rounded-xl">
          <p className="text-sm text-muted-foreground mb-1">Total Raised ({currentCycle} Cycle)</p>
          <p className="text-3xl font-bold">{formatCurrency(Number(metrics.total_receipts))}</p>
        </div>

        {/* Stacked Bars */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Funding Sources</span>
          </div>
          <StackedBar
            leftLabel="Individuals"
            rightLabel="PACs/Committees"
            leftValue={metrics.pct_from_individuals}
            rightValue={metrics.pct_from_committees}
            leftColor="bg-emerald-500"
            rightColor="bg-amber-500"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Geographic Distribution</span>
          </div>
          <StackedBar
            leftLabel="In-State"
            rightLabel="Out-of-State"
            leftValue={metrics.pct_from_in_state}
            rightValue={metrics.pct_from_out_of_state}
            leftColor="bg-civic-blue"
            rightColor="bg-civic-slate"
          />
        </div>

        {/* Small Donors Badge */}
        {metrics.pct_from_small_donors != null && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Leaf className="h-4 w-4 text-emerald-500" />
            <span className="text-sm">
              Estimated Small Donors: <span className="font-semibold">{metrics.pct_from_small_donors.toFixed(0)}%</span>
            </span>
          </div>
        )}

        {/* Score Cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <ScoreGauge
            label="Grassroots Support"
            score={metrics.grassroots_support_score ? Number(metrics.grassroots_support_score) : null}
            tooltip="Higher = more money from individuals, small donors, and in-state contributors."
            color="success"
          />
          <ScoreGauge
            label="PAC Dependence"
            score={metrics.pac_dependence_score ? Number(metrics.pac_dependence_score) : null}
            tooltip="Higher = larger share of money from PACs and committees."
            color="warning"
          />
          <ScoreGauge
            label="Local Money"
            score={metrics.local_money_score ? Number(metrics.local_money_score) : null}
            tooltip="Higher = more donations from within the politician's own state."
            color="primary"
          />
        </div>

        {/* Data freshness */}
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(metrics.computed_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}
