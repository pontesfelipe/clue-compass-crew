import { cn } from "@/lib/utils";

interface PartyVoteData {
  party: "D" | "R" | "I" | "L";
  yea: number;
  nay: number;
}

interface CompactPartyBreakdownProps {
  partyData: PartyVoteData[];
}

const partyLabels: Record<string, string> = {
  D: "Dem",
  R: "Rep",
  I: "Ind",
  L: "Lib",
};

const partyColors: Record<string, string> = {
  D: "text-civic-blue",
  R: "text-civic-red",
  I: "text-civic-slate",
  L: "text-civic-gold",
};

export function CompactPartyBreakdown({ partyData }: CompactPartyBreakdownProps) {
  if (!partyData || partyData.length === 0) return null;

  // Only show D and R for compact view
  const mainParties = partyData.filter(p => p.party === "D" || p.party === "R");
  
  return (
    <div className="flex items-center gap-4 text-xs">
      {mainParties.map((stats) => {
        const total = stats.yea + stats.nay;
        if (total === 0) return null;
        
        const yeaPercent = Math.round((stats.yea / total) * 100);
        
        return (
          <div key={stats.party} className="flex items-center gap-2">
            <span className={cn("font-semibold", partyColors[stats.party])}>
              {partyLabels[stats.party]}
            </span>
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 rounded-full overflow-hidden bg-muted flex">
                <div 
                  className="bg-score-excellent"
                  style={{ width: `${yeaPercent}%` }}
                />
                <div 
                  className="bg-score-bad flex-1"
                />
              </div>
              <span className="text-muted-foreground whitespace-nowrap">
                {stats.yea}-{stats.nay}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}