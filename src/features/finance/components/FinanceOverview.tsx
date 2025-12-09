import { DollarSign, TrendingUp, Building2, Users } from "lucide-react";
import { formatCurrency, type MemberFinance } from "../types";

interface FinanceOverviewProps {
  finance: MemberFinance;
}

export function FinanceOverview({ finance }: FinanceOverviewProps) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <div className="bg-muted/50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <DollarSign className="h-4 w-4" />
          <span className="text-xs font-medium">Total Contributions</span>
        </div>
        <p className="text-xl font-semibold text-foreground">
          {formatCurrency(finance.totalContributions)}
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
  );
}
