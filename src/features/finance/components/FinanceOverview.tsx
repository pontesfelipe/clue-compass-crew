import { useMemo } from "react";
import { DollarSign, TrendingUp, Building2, Users, MapPin, Leaf, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, type MemberFinance } from "../types";
import type { FundingMetrics } from "../hooks/useMemberFinance";
import { cn } from "@/lib/utils";
import { getStateAbbr } from "@/features/states/types";

interface FinanceOverviewProps {
  finance: MemberFinance;
  fundingMetrics?: FundingMetrics[];
  memberState?: string | null;
  selectedCycle?: number | null;
}


function ScoreGauge({ label, score, tooltip }: { label: string; score: number | null; tooltip: string }) {
  const displayScore = score ?? 50;
  const getColor = (s: number) => {
    if (s >= 70) return "bg-emerald-500";
    if (s >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-muted/50 rounded-xl p-3 cursor-help">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-xl font-bold">{displayScore}</span>
              <span className="text-xs text-muted-foreground mb-0.5">/100</span>
            </div>
            <Progress value={displayScore} className={cn("h-1.5 mt-1.5", getColor(displayScore))} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs"><p>{tooltip}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StackedBar({ leftLabel, rightLabel, leftValue, rightValue, leftColor, rightColor }: {
  leftLabel: string; rightLabel: string;
  leftValue: number | null; rightValue: number | null;
  leftColor: string; rightColor: string;
}) {
  const left = leftValue ?? 50;
  const right = rightValue ?? 50;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{leftLabel}: <span className="font-medium text-foreground">{left.toFixed(0)}%</span></span>
        <span className="text-muted-foreground">{rightLabel}: <span className="font-medium text-foreground">{right.toFixed(0)}%</span></span>
      </div>
      <div className="h-2.5 flex rounded-full overflow-hidden">
        <div className={cn(leftColor, "transition-all")} style={{ width: `${left}%` }} />
        <div className={cn(rightColor, "transition-all")} style={{ width: `${right}%` }} />
      </div>
    </div>
  );
}

export function FinanceOverview({ finance, fundingMetrics = [], memberState, selectedCycle }: FinanceOverviewProps) {
  // Find metrics for the selected cycle (or latest)
  const metrics = useMemo(() => {
    if (fundingMetrics.length === 0) return null;
    if (selectedCycle) return fundingMetrics.find(m => m.cycle === selectedCycle) || null;
    return fundingMetrics[0]; // already sorted desc
  }, [fundingMetrics, selectedCycle]);

  // Calculate contribution-based analytics as fallback when no funding_metrics
  const derivedAnalytics = useMemo(() => {
    if (metrics) return null; // prefer pre-computed metrics
    if (finance.contributions.length === 0) return null;

    const cycleContributions = selectedCycle
      ? finance.contributions.filter(c => c.cycle === selectedCycle)
      : finance.contributions;

    const total = cycleContributions.reduce((sum, c) => sum + c.amount, 0);
    if (total === 0) return null;

    const individualAmt = cycleContributions.filter(c => c.contributorType === "individual").reduce((s, c) => s + c.amount, 0);
    const pacAmt = cycleContributions.filter(c => ["committee", "pac", "organization", "corporate", "union"].includes(c.contributorType)).reduce((s, c) => s + c.amount, 0);
    const pctIndividuals = (individualAmt / total) * 100;
    const pctPacs = (pacAmt / total) * 100;

    const stateAbbr = memberState ? (stateAbbreviations[memberState] || memberState) : null;
    const inStateAmt = stateAbbr ? cycleContributions.filter(c => c.contributorState?.toUpperCase() === stateAbbr.toUpperCase()).reduce((s, c) => s + c.amount, 0) : 0;
    const outStateAmt = stateAbbr ? cycleContributions.filter(c => c.contributorState && c.contributorState.toUpperCase() !== stateAbbr.toUpperCase()).reduce((s, c) => s + c.amount, 0) : 0;
    const geoTotal = inStateAmt + outStateAmt;
    const pctInState = geoTotal > 0 ? (inStateAmt / geoTotal) * 100 : null;
    const pctOutState = geoTotal > 0 ? (outStateAmt / geoTotal) * 100 : null;

    const smallDonorAmt = cycleContributions.filter(c => c.contributorType === "individual" && c.amount < 200).reduce((s, c) => s + c.amount, 0);
    const pctSmallDonors = individualAmt > 0 ? (smallDonorAmt / individualAmt) * 100 : 0;

    const grassroots = Math.round((pctIndividuals * 0.5) + (pctSmallDonors * 0.3) + ((pctInState ?? 50) * 0.2));
    const pacDep = Math.round(pctPacs);
    const localMoney = pctInState != null ? Math.round(pctInState) : null;

    return {
      pctIndividuals, pctPacs, pctInState, pctOutState,
      pctSmallDonors, grassroots, pacDep, localMoney,
      hasGeo: geoTotal > 0 && stateAbbr != null,
      isEstimated: true,
    };
  }, [metrics, finance.contributions, selectedCycle, memberState]);

  // Use pre-computed metrics or derived fallback
  const pctIndividuals = metrics?.pct_from_individuals ?? derivedAnalytics?.pctIndividuals ?? null;
  const pctPacs = metrics?.pct_from_committees ?? derivedAnalytics?.pctPacs ?? null;
  const pctInState = metrics?.pct_from_in_state ?? derivedAnalytics?.pctInState ?? null;
  const pctOutState = metrics?.pct_from_out_of_state ?? derivedAnalytics?.pctOutState ?? null;
  const pctSmallDonors = metrics?.pct_from_small_donors ?? derivedAnalytics?.pctSmallDonors ?? null;
  const grassroots = metrics?.grassroots_support_score ?? derivedAnalytics?.grassroots ?? null;
  const pacDep = metrics?.pac_dependence_score ?? derivedAnalytics?.pacDep ?? null;
  const localMoney = metrics?.local_money_score ?? derivedAnalytics?.localMoney ?? null;
  const hasGeo = pctInState != null && pctOutState != null && (metrics != null || derivedAnalytics?.hasGeo);
  const hasSourceBreakdown = pctIndividuals != null && pctPacs != null;

  const totalRaised = metrics?.total_receipts ? Number(metrics.total_receipts) : finance.totalContributions;

  return (
    <div className="space-y-5">
      {/* Summary stats row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Total Raised</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {formatCurrency(totalRaised)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Lobbying Spending</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {formatCurrency(finance.totalLobbying)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-medium">Top Sponsors</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {finance.sponsors.length}
          </p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Top Donors</span>
          </div>
          <p className="text-xl font-semibold text-foreground">
            {finance.contributions.length}
          </p>
        </div>
      </div>

      {/* Funding source & geographic distribution */}
      {(hasSourceBreakdown || hasGeo) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {hasSourceBreakdown && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Funding Sources</span>
              </div>
              <StackedBar
                leftLabel="Individuals" rightLabel="PACs/Committees"
                leftValue={pctIndividuals} rightValue={pctPacs}
                leftColor="bg-emerald-500" rightColor="bg-amber-500"
              />
            </div>
          )}
          {hasGeo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Geographic Distribution</span>
              </div>
              <StackedBar
                leftLabel="In-State" rightLabel="Out-of-State"
                leftValue={pctInState} rightValue={pctOutState}
                leftColor="bg-civic-blue" rightColor="bg-civic-slate"
              />
            </div>
          )}
        </div>
      )}

      {/* Small donors badge */}
      {pctSmallDonors != null && pctSmallDonors > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
          <Leaf className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs">
            Estimated Small Donors: <span className="font-semibold">{pctSmallDonors.toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* Score gauges */}
      {(grassroots != null || pacDep != null || localMoney != null) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <ScoreGauge
            label="Grassroots Support"
            score={grassroots != null ? Number(grassroots) : null}
            tooltip="Higher = more money from individuals, small donors, and in-state contributors."
          />
          <ScoreGauge
            label="PAC Dependence"
            score={pacDep != null ? Number(pacDep) : null}
            tooltip="Higher = larger share of money from PACs and committees."
          />
          <ScoreGauge
            label="Local Money"
            score={localMoney != null ? Number(localMoney) : null}
            tooltip="Higher = more donations from within the politician's own state."
          />
        </div>
      )}

      {/* Data source note */}
      {(metrics || derivedAnalytics) && (
        <p className="text-xs text-muted-foreground text-center">
          {metrics
            ? `FEC data last updated: ${new Date(metrics.computed_at).toLocaleDateString()}`
            : `Estimated from ${finance.contributions.length} contribution records`}
        </p>
      )}
    </div>
  );
}
