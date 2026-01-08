import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Contribution } from "../types";

interface ContributionTrendsChartProps {
  contributions: Contribution[];
}

const chartConfig = {
  individual: {
    label: "Individuals",
    color: "hsl(210, 70%, 50%)", // Blue
  },
  organization: {
    label: "Organizations",
    color: "hsl(160, 60%, 45%)", // Teal/Green
  },
} satisfies ChartConfig;

export function ContributionTrendsChart({ contributions }: ContributionTrendsChartProps) {
  const chartData = useMemo(() => {
    // Group contributions by cycle and type
    const cycleMap = new Map<number, { individual: number; organization: number }>();

    for (const c of contributions) {
      const cycle = c.cycle;
      if (!cycleMap.has(cycle)) {
        cycleMap.set(cycle, { individual: 0, organization: 0 });
      }
      const data = cycleMap.get(cycle)!;
      
      if (c.contributorType === "individual") {
        data.individual += c.amount;
      } else {
        data.organization += c.amount;
      }
    }

    // Convert to array and sort by cycle
    return Array.from(cycleMap.entries())
      .map(([cycle, data]) => ({
        cycle: cycle.toString(),
        individual: data.individual,
        organization: data.organization,
        total: data.individual + data.organization,
      }))
      .sort((a, b) => parseInt(a.cycle) - parseInt(b.cycle));
  }, [contributions]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        <h4 className="text-sm font-medium">Contributions by Election Cycle</h4>
      </div>
      
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                          <span className="text-muted-foreground">Organizations</span>
                        </div>
                        <span className="font-medium">{formatCurrency(organization)} <span className="text-muted-foreground">({orgPct}%)</span></span>
                      </div>
                      <div className="border-t pt-1.5 mt-1.5 flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-semibold">{formatCurrency(total)}</span>
                      </div>
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
              name="Organizations"
            />
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
