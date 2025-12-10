import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, Play, CheckCircle2, AlertCircle, Clock, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

interface SyncProgressData {
  id: string;
  status: string | null;
  last_run_at: string | null;
  total_processed: number | null;
  current_offset: number;
  updated_at: string | null;
  metadata?: Json;
}

interface SyncConfig {
  id: string;
  label: string;
  description: string;
  expectedTotal?: number;
  icon: React.ReactNode;
}

const SYNC_CONFIGS: SyncConfig[] = [
  {
    id: "congress-members",
    label: "Congress Members",
    description: "Syncs all 539 members of Congress from Congress.gov",
    expectedTotal: 539,
    icon: <span className="text-lg">👥</span>,
  },
  {
    id: "bills",
    label: "Bills & Sponsorships",
    description: "Syncs all bills from Congress 118 & 119 with sponsorship data",
    expectedTotal: 20000,
    icon: <span className="text-lg">📜</span>,
  },
  {
    id: "votes",
    label: "Votes & Positions",
    description: "Syncs House and Senate votes with individual member positions",
    expectedTotal: 2000,
    icon: <span className="text-lg">🗳️</span>,
  },
  {
    id: "fec-finance",
    label: "FEC Finance (Legacy)",
    description: "Syncs campaign finance data from FEC API (old)",
    expectedTotal: 539,
    icon: <span className="text-lg">💵</span>,
  },
  {
    id: "fec-funding",
    label: "FEC Funding Metrics",
    description: "Syncs funding metrics with grassroots/PAC/local scores per cycle",
    expectedTotal: 539,
    icon: <span className="text-lg">💰</span>,
  },
  {
    id: "member-details",
    label: "Member Details",
    description: "Syncs additional member details and committee assignments",
    expectedTotal: 539,
    icon: <span className="text-lg">📋</span>,
  },
];

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "running":
      return (
        <Badge variant="default" className="bg-amber-500 hover:bg-amber-500 animate-pulse">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "complete":
      return (
        <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    case "partial":
      return (
        <Badge variant="secondary">
          <Pause className="h-3 w-3 mr-1" />
          Partial
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          Idle
        </Badge>
      );
  }
}

export function SyncStatusCard() {
  const { toast } = useToast();
  const [syncProgress, setSyncProgress] = useState<SyncProgressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [triggeringSyncId, setTriggeringSyncId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSyncProgress = async () => {
    try {
      const { data, error } = await supabase
        .from("sync_progress")
        .select("*")
        .order("id");

      if (error) throw error;
      setSyncProgress((data || []) as SyncProgressData[]);
    } catch (error) {
      console.error("Error fetching sync progress:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncProgress();
    
    // Auto-refresh every 5 seconds if any sync is running
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchSyncProgress();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Check if any sync is running to enable auto-refresh
  useEffect(() => {
    const hasRunning = syncProgress.some((s) => s.status === "running");
    setAutoRefresh(hasRunning);
  }, [syncProgress]);

  const triggerSync = async (syncType: string) => {
    setTriggeringSyncId(syncType);
    try {
      const functionName = `sync-${syncType}`;
      const { error } = await supabase.functions.invoke(functionName);

      if (error) throw error;

      toast({
        title: "Sync Started",
        description: `${syncType.replace(/-/g, " ")} sync has been triggered.`,
      });

      // Start auto-refresh
      setAutoRefresh(true);
      setTimeout(fetchSyncProgress, 1000);
    } catch (error) {
      console.error("Error triggering sync:", error);
      toast({
        title: "Error",
        description: `Failed to trigger ${syncType} sync`,
        variant: "destructive",
      });
    } finally {
      setTriggeringSyncId(null);
    }
  };

  const getProgressPercentage = (config: SyncConfig, progress: SyncProgressData | undefined): number => {
    if (!progress || !config.expectedTotal) return 0;
    const processed = progress.total_processed || 0;
    return Math.min(100, Math.round((processed / config.expectedTotal) * 100));
  };

  const getMetadataInfo = (progress: SyncProgressData | undefined): string | null => {
    if (!progress?.metadata || typeof progress.metadata !== 'object') return null;
    
    const metadata = progress.metadata as Record<string, unknown>;
    
    if (metadata.currentCongress && metadata.currentBillType) {
      return `Congress ${metadata.currentCongress}, ${String(metadata.currentBillType).toUpperCase()} bills, offset ${metadata.currentOffset || 0}`;
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Data Synchronization Status
            {autoRefresh && (
              <Badge variant="outline" className="text-xs">
                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1 animate-pulse" />
                Live
              </Badge>
            )}
          </span>
          <Button variant="outline" size="sm" onClick={fetchSyncProgress} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Monitor and trigger data sync operations from external APIs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {SYNC_CONFIGS.map((config) => {
            const progress = syncProgress.find((s) => s.id === config.id);
            const percentage = getProgressPercentage(config, progress);
            const metadataInfo = getMetadataInfo(progress);
            const isRunning = progress?.status === "running";
            const isTriggering = triggeringSyncId === config.id;

            return (
              <div
                key={config.id}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  isRunning ? "border-amber-500/50 bg-amber-500/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{config.label}</h3>
                        {getStatusBadge(progress?.status || null)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                      
                      {/* Progress info */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Processed: <span className="font-medium text-foreground">{(progress?.total_processed || 0).toLocaleString()}</span>
                            {config.expectedTotal && (
                              <span className="text-muted-foreground"> / ~{config.expectedTotal.toLocaleString()}</span>
                            )}
                          </span>
                          <span className="font-medium">{percentage}%</span>
                        </div>
                        
                        <Progress 
                          value={percentage} 
                          className={`h-2 ${isRunning ? "animate-pulse" : ""}`}
                        />
                        
                        {metadataInfo && (
                          <p className="text-xs text-muted-foreground italic">
                            Current: {metadataInfo}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last run: {formatTimeAgo(progress?.last_run_at || null)}
                          </span>
                          {progress?.updated_at && progress.status === "running" && (
                            <span className="flex items-center gap-1">
                              Updated: {formatTimeAgo(progress.updated_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant={isRunning ? "outline" : "default"}
                    size="sm"
                    onClick={() => triggerSync(config.id)}
                    disabled={isTriggering || isRunning}
                    className="shrink-0"
                  >
                    {isTriggering ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Starting...
                      </>
                    ) : isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        Run Sync
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
