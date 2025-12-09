import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PartyVoteBreakdownProps {
  voteId: string;
}

interface PartyStats {
  party: "D" | "R" | "I" | "L";
  yea: number;
  nay: number;
  present: number;
  not_voting: number;
}

const partyLabels: Record<string, string> = {
  D: "Democrats",
  R: "Republicans",
  I: "Independents",
  L: "Libertarians",
};

const partyColors: Record<string, { bg: string; text: string }> = {
  D: { bg: "bg-civic-blue", text: "text-civic-blue" },
  R: { bg: "bg-civic-red", text: "text-civic-red" },
  I: { bg: "bg-civic-slate", text: "text-civic-slate" },
  L: { bg: "bg-civic-gold", text: "text-civic-gold" },
};

export function PartyVoteBreakdown({ voteId }: PartyVoteBreakdownProps) {
  const { data: partyStats, isLoading } = useQuery({
    queryKey: ["vote-party-breakdown", voteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_votes")
        .select(`
          position,
          members (
            party
          )
        `)
        .eq("vote_id", voteId);

      if (error) throw error;

      // Aggregate by party
      const stats: Record<string, PartyStats> = {};
      
      for (const vote of data || []) {
        const party = (vote.members as any)?.party as string;
        if (!party) continue;
        
        if (!stats[party]) {
          stats[party] = { party: party as any, yea: 0, nay: 0, present: 0, not_voting: 0 };
        }
        
        switch (vote.position) {
          case "yea":
            stats[party].yea++;
            break;
          case "nay":
            stats[party].nay++;
            break;
          case "present":
            stats[party].present++;
            break;
          case "not_voting":
            stats[party].not_voting++;
            break;
        }
      }

      // Sort by total votes (D and R first)
      return Object.values(stats).sort((a, b) => {
        const order = { D: 0, R: 1, I: 2, L: 3 };
        return (order[a.party] ?? 4) - (order[b.party] ?? 4);
      });
    },
    enabled: !!voteId,
  });

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        <div className="h-4 bg-muted animate-pulse rounded" />
        <div className="h-4 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!partyStats || partyStats.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Party Breakdown
      </p>
      <div className="space-y-2">
        {partyStats.map((stats) => {
          const total = stats.yea + stats.nay + stats.present + stats.not_voting;
          if (total === 0) return null;
          
          const yeaPercent = (stats.yea / total) * 100;
          const nayPercent = (stats.nay / total) * 100;
          const presentPercent = (stats.present / total) * 100;
          
          return (
            <div key={stats.party} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className={cn("font-medium", partyColors[stats.party]?.text)}>
                  {partyLabels[stats.party] || stats.party}
                </span>
                <span className="text-muted-foreground text-xs">
                  {stats.yea}Y - {stats.nay}N
                  {stats.present > 0 && ` - ${stats.present}P`}
                </span>
              </div>
              <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
                {yeaPercent > 0 && (
                  <div 
                    className="bg-score-excellent transition-all"
                    style={{ width: `${yeaPercent}%` }}
                  />
                )}
                {nayPercent > 0 && (
                  <div 
                    className="bg-score-bad transition-all"
                    style={{ width: `${nayPercent}%` }}
                  />
                )}
                {presentPercent > 0 && (
                  <div 
                    className="bg-score-average transition-all"
                    style={{ width: `${presentPercent}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
