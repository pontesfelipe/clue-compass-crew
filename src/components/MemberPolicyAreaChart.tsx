import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface Bill {
  policyArea: string | null;
}

interface MemberPolicyAreaChartProps {
  sponsoredBills: Bill[];
  cosponsoredBills: Bill[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
];

export function MemberPolicyAreaChart({ sponsoredBills, cosponsoredBills }: MemberPolicyAreaChartProps) {
  const chartData = useMemo(() => {
    const allBills = [...sponsoredBills, ...cosponsoredBills];
    const policyCounts: Record<string, number> = {};
    
    allBills.forEach((bill) => {
      if (bill.policyArea) {
        policyCounts[bill.policyArea] = (policyCounts[bill.policyArea] || 0) + 1;
      }
    });
    
    return Object.entries(policyCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 policy areas
  }, [sponsoredBills, cosponsoredBills]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
        <div className="flex items-center gap-2 mb-6">
          <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Legislative Focus
          </h2>
        </div>
        <p className="text-muted-foreground text-center py-8">
          No policy area data available yet.
        </p>
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
      <div className="flex items-center gap-2 mb-6">
        <PieChartIcon className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-serif text-xl font-semibold text-foreground">
          Legislative Focus
        </h2>
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="stroke-card stroke-2"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const percentage = ((data.value / total) * 100).toFixed(1);
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-foreground text-sm">{data.name}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {data.value} bill{data.value !== 1 ? 's' : ''} ({percentage}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-muted-foreground truncate" title={item.name}>
              {item.name}
            </span>
            <span className="text-foreground font-medium ml-auto">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
