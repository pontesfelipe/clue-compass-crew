import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, contributorTypeLabels, type Contribution } from "../types";

interface ContributorsListProps {
  contributions: Contribution[];
}

const typeColors: Record<Contribution["contributorType"], string> = {
  individual: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  pac: "bg-civic-gold/10 text-civic-gold border-civic-gold/30",
  organization: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
};

export function ContributorsList({ contributions }: ContributorsListProps) {
  if (contributions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No contribution data available.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Data will be synced from public records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contributions.map((contribution, index) => (
        <div
          key={contribution.id}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground truncate">
                {contribution.contributorName}
              </p>
              {contribution.contributorState && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {contribution.contributorState}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                variant="outline" 
                className={cn("text-xs", typeColors[contribution.contributorType])}
              >
                {contributorTypeLabels[contribution.contributorType]}
              </Badge>
              {contribution.industry && (
                <span className="text-xs text-muted-foreground truncate">
                  {contribution.industry}
                </span>
              )}
            </div>
          </div>
          <div className="text-right ml-4">
            <p className="font-semibold text-foreground">
              {formatCurrency(contribution.amount)}
            </p>
            <p className="text-xs text-muted-foreground">{contribution.cycle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
