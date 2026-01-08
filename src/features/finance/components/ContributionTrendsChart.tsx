import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import type { Contribution, Sponsor } from "../types";

interface ContributionTrendsChartProps {
  contributions: Contribution[];
  sponsors?: Sponsor[];
}

const chartConfig = {
  individual: {
    label: "Individuals",
    color: "hsl(210, 70%, 50%)", // Blue
  },
  organization: {
    label: "PACs & Organizations",
    color: "hsl(160, 60%, 45%)", // Teal/Green
  },
} satisfies ChartConfig;

export function ContributionTrendsChart({ contributions, sponsors = [] }: ContributionTrendsChartProps) {
  const chartData = useMemo(() => {
    // Group contributions by cycle and type
    const cycleMap = new Map<number, { individual: number; organization: number }>();

    // Process contributions
    for (const c of contributions) {
      const cycle = c.cycle;
      if (!cycleMap.has(cycle)) {
        cycleMap.set(cycle, { individual: 0, organization: 0 });
      }
      const data = cycleMap.get(cycle)!;
      
      if (c.contributorType === "individual") {
        data.individual += c.amount;
      } else {
        // PAC, organization, corporate, union all go to organization bucket
        data.organization += c.amount;
      }
    }

    // Process sponsors (PACs, trade associations, etc.) - add to organization bucket
    for (const s of sponsors) {
      const cycle = s.cycle;
      if (!cycleMap.has(cycle)) {
        cycleMap.set(cycle, { individual: 0, organization: 0 });
      }
      const data = cycleMap.get(cycle)!;
      data.organization += s.totalSupport;
    }

    // Convert to array and sort by cycle
    const sorted = Array.from(cycleMap.entries())
      .map(([cycle, data]) => ({
        cycle: cycle.toString(),
        individual: data.individual,
        organization: data.organization,
        total: data.individual + data.organization,
      }))
      .sort((a, b) => parseInt(a.cycle) - parseInt(b.cycle));

    // Calculate YoY growth
    return sorted.map((item, index) => {
      if (index === 0) {
        return { ...item, growth: null, growthPct: null };
      }
      const prevTotal = sorted[index - 1].total;
      const growth = item.total - prevTotal;
      const growthPct = prevTotal > 0 ? ((growth / prevTotal) * 100) : null;
      return { ...item, growth, growthPct };
    });
  }, [contributions, sponsors]);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No contribution trend data available.</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatGrowth = (pct: number | null) => {
    if (pct === null) return null;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(0)}%`;
  };

  // Calculate overall growth if we have multiple cycles
  const overallGrowth = chartData.length >= 2 
    ? chartData[chartData.length - 1].growthPct 
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <h4 className="text-sm font-medium">Contributions by Election Cycle</h4>
        </div>
        {overallGrowth !== null && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            overallGrowth > 0 ? "text-green-600" : overallGrowth < 0 ? "text-red-600" : "text-muted-foreground"
          }`}>
            {overallGrowth > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : overallGrowth < 0 ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span>{formatGrowth(overallGrowth)} vs prev cycle</span>
          </div>
        )}
      </div>
      
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="cycle"
              tickLine={false}
              axisLine={false}
              className="text-xs fill-muted-foreground"
            />
            <YAxis
              tickFormatter={formatCurrency}
              tickLine={false}
              axisLine={false}
              className="text-xs fill-muted-foreground"
              width={60}
            />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const individual = payload.find(p => p.dataKey === "individual")?.value as number || 0;
                const organization = payload.find(p => p.dataKey === "organization")?.value as number || 0;
                const total = individual + organization;
                const indPct = total > 0 ? ((individual / total) * 100).toFixed(1) : "0";
                const orgPct = total > 0 ? ((organization / total) * 100).toFixed(1) : "0";
                
                // Find growth data
                const cycleData = chartData.find(d => d.cycle === label);
                const growthPct = cycleData?.growthPct;
                
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md">
                    <p className="font-medium mb-2">Cycle {label}</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(210, 70%, 50%)" }} />
                          <span className="text-muted-foreground">Individuals</span>
                        </div>
                        <span className="font-medium">{formatCurrency(individual)} <span className="text-muted-foreground">({indPct}%)</span></span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(160, 60%, 45%)" }} />
                          <span className="text-muted-foreground">PACs & Orgs</span>
                        </div>
                        <span className="font-medium">{formatCurrency(organization)} <span className="text-muted-foreground">({orgPct}%)</span></span>
                      </div>
                      <div className="border-t pt-1.5 mt-1.5 flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-semibold">{formatCurrency(total)}</span>
                      </div>
                      {growthPct !== null && (
                        <div className={`flex items-center justify-between pt-1 ${
                          growthPct > 0 ? "text-green-600" : growthPct < 0 ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          <span className="text-muted-foreground">vs Prev Cycle</span>
                          <span className="font-medium flex items-center gap-1">
                            {growthPct > 0 ? <TrendingUp className="h-3 w-3" /> : growthPct < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                            {formatGrowth(growthPct)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-foreground capitalize">{value}</span>
              )}
            />
            <Bar
              dataKey="individual"
              stackId="a"
              fill="var(--color-individual)"
              radius={[0, 0, 0, 0]}
              name="Individuals"
            />
            <Bar
              dataKey="organization"
              stackId="a"
              fill="var(--color-organization)"
              radius={[4, 4, 0, 0]}
              name="PACs & Organizations"
            >
              <LabelList
                dataKey="growthPct"
                position="top"
                formatter={(value: number | null) => {
                  if (value === null) return "";
                  const sign = value >= 0 ? "+" : "";
                  return `${sign}${value.toFixed(0)}%`;
                }}
                className="fill-foreground text-xs font-medium"
                style={{ fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "hsl(210, 70%, 50%)" }} />
          <span className="text-muted-foreground">Individuals</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "hsl(160, 60%, 45%)" }} />
          <span className="text-muted-foreground">PACs & Organizations</span>
        </div>
      </div>
    </div>
  );
}
