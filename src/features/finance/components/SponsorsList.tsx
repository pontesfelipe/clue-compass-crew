import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, sponsorTypeLabels, relationshipTypeLabels, type Sponsor } from "../types";

interface SponsorsListProps {
  sponsors: Sponsor[];
}

const typeColors: Record<Sponsor["sponsorType"], string> = {
  corporation: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  nonprofit: "bg-score-good/10 text-score-good border-score-good/30",
  trade_association: "bg-civic-gold/10 text-civic-gold border-civic-gold/30",
  union: "bg-civic-red/10 text-civic-red border-civic-red/30",
};

export function SponsorsList({ sponsors }: SponsorsListProps) {
  if (sponsors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sponsor data available.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Data will be synced from public records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sponsors.map((sponsor, index) => (
        <div
          key={sponsor.id}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">
              {sponsor.sponsorName}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn("text-xs", typeColors[sponsor.sponsorType])}
              >
                {sponsorTypeLabels[sponsor.sponsorType]}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {relationshipTypeLabels[sponsor.relationshipType]}
              </Badge>
            </div>
          </div>
          <div className="text-right ml-4">
            <p className="font-semibold text-foreground">
              {formatCurrency(sponsor.totalSupport)}
            </p>
            <p className="text-xs text-muted-foreground">{sponsor.cycle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
