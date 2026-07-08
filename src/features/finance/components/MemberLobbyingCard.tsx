import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Building2 } from "lucide-react";
import { useMemberLobbying } from "../hooks/useMemberLobbying";

interface MemberLobbyingCardProps {
  memberId: string;
}

function formatUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function MemberLobbyingCard({ memberId }: MemberLobbyingCardProps) {
  const { data, isLoading } = useMemberLobbying(memberId);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg font-semibold text-foreground">
            Lobbying Context
          </h3>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Industry-level lobbying activity from the Senate LDA database.
                These figures reflect total lobbying spend by industry across
                Congress in the given cycle — not direct spending toward this
                member. Use as context for what interests are active around the
                member&apos;s policy areas.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No lobbying data available for this member yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {row.industry}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cycle {row.cycle}
                  {row.client_count ? ` · ${row.client_count.toLocaleString()} clients` : ""}
                </p>
              </div>
              <span className="ml-4 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {formatUsd(row.total_spent)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Source: Senate Lobbying Disclosure Act (LDA) filings, aggregated by
        industry.
      </p>
    </Card>
  );
}
