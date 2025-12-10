import { useDataFreshness, formatTimeAgo } from "@/hooks/useDataFreshness";
import { Clock, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DataFreshnessIndicator() {
  const { data, isLoading, isError } = useDataFreshness();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const congressTime = data.congress_votes_last_synced_at || data.congress_bills_last_synced_at;
  const fundingTime = data.fec_funding_last_synced_at;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
            <Clock className="h-3 w-3" />
            <span>
              Congress: {formatTimeAgo(congressTime)}
              {fundingTime && ` · Funding: ${formatTimeAgo(fundingTime)}`}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <p className="font-medium">Data Freshness</p>
            <div className="space-y-0.5">
              <p>Members: {formatTimeAgo(data.congress_members_last_synced_at)}</p>
              <p>Bills: {formatTimeAgo(data.congress_bills_last_synced_at)} ({data.congress_bills_total} total)</p>
              <p>Votes: {formatTimeAgo(data.congress_votes_last_synced_at)} ({data.congress_votes_total} total)</p>
              <p>Funding: {formatTimeAgo(data.fec_funding_last_synced_at)} ({data.fec_funding_total} members)</p>
            </div>
            <p className="text-muted-foreground pt-1">Data syncs automatically</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
