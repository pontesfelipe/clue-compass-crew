import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  RefreshCw, 
  Users, 
  FileText, 
  Vote, 
  Calculator,
  DollarSign,
  CheckCircle,
  Clock,
  Brain
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface SyncItem {
  id: string;
  status: string | null;
  last_run_at: string | null;
  total_processed: number | null;
}

interface ClassificationProgress {
  house: { total: number; classified: number };
  senate: { total: number; classified: number };
}

interface DataStatus {
  classification?: ClassificationProgress;
}

const syncConfig: Record<string, { label: string; icon: typeof Users }> = {
  "congress-members": { label: "Members", icon: Users },
  "bills": { label: "Bills", icon: FileText },
  "votes": { label: "Votes", icon: Vote },
  "member-scores": { label: "Scores", icon: Calculator },
  "fec-finance": { label: "Finance", icon: DollarSign },
};

export function SyncStatus() {
  const { data: syncProgress, isLoading } = useQuery({
    queryKey: ["sync-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_progress")
        .select("*")
        .order("id");
      
      if (error) throw error;
      return data as SyncItem[];
    },
    refetchInterval: 60000,
  });

  const { data: dataStatus } = useQuery({
    queryKey: ["data-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("data-status");
      if (error) throw error;
      return data as DataStatus;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Loading sync status...</span>
      </div>
    );
  }

  const classification = dataStatus?.classification;
  const houseProgress = classification ? (classification.house.classified / Math.max(classification.house.total, 1)) * 100 : 0;
  const senateProgress = classification ? (classification.senate.classified / Math.max(classification.senate.total, 1)) * 100 : 0;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium">Data Sync:</span>
        {syncProgress?.map((item) => {
          const config = syncConfig[item.id];
          if (!config) return null;
          
          const Icon = config.icon;
          const lastRun = item.last_run_at 
            ? formatDistanceToNow(new Date(item.last_run_at), { addSuffix: true })
            : "Never";
          const isRecent = item.last_run_at && 
            (Date.now() - new Date(item.last_run_at).getTime()) < 24 * 60 * 60 * 1000;
          
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                  isRecent 
                    ? "bg-score-excellent/10 text-score-excellent" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{config.label}</span>
                  {isRecent ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{config.label}</p>
                <p className="text-muted-foreground">Last updated: {lastRun}</p>
                {item.total_processed !== null && item.total_processed > 0 && (
                  <p className="text-muted-foreground">Processed: {item.total_processed} items</p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Classification Progress Indicator */}
        {classification && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-primary/10 text-primary">
                <Brain className="h-3 w-3" />
                <span className="hidden sm:inline">AI</span>
                <span className="text-[10px] font-medium">
                  {Math.round((houseProgress + senateProgress) / 2)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs w-56">
              <p className="font-medium mb-2">Bill Classification Progress</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-muted-foreground mb-1">
                    <span>House (HR)</span>
                    <span>{classification.house.classified}/{classification.house.total}</span>
                  </div>
                  <Progress value={houseProgress} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-muted-foreground mb-1">
                    <span>Senate (S)</span>
                    <span>{classification.senate.classified}/{classification.senate.total}</span>
                  </div>
                  <Progress value={senateProgress} className="h-1.5" />
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
