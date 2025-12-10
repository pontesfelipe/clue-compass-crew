import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, Play, CheckCircle2, AlertCircle, Clock, Pause, Users, FileText, Vote, DollarSign, Calculator, MapPin, Zap, Bell, Brain, BarChart3, Briefcase, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";
import { CronExpressionParser } from "cron-parser";

interface SyncProgressData {
  id: string;
  status: string | null;
  last_run_at: string | null;
  total_processed: number | null;
  current_offset: number;
  updated_at: string | null;
  metadata?: Json;
  last_matched_count?: number | null;
  error_message?: string | null;
}

interface SyncConfig {
  id: string;
  label: string;
  description: string;
  expectedTotal?: number;
  icon: React.ReactNode;
  functionName?: string;
  category: "congress" | "finance" | "scores";
  cronSchedule: string;
}

const SYNC_CONFIGS: SyncConfig[] = [
  // Congress data
  {
    id: "congress-members",
    label: "Congress Members",
    description: "Syncs all 539 members of Congress from Congress.gov",
    expectedTotal: 539,
    icon: <Users className="h-4 w-4" />,
    functionName: "sync-congress-members",
    category: "congress",
    cronSchedule: "0 0 * * *", // Daily at midnight
  },
  {
    id: "member-details",
    label: "Member Details",
    description: "Syncs committees & statements for all members",
    expectedTotal: 539,
    icon: <Briefcase className="h-4 w-4" />,
    functionName: "sync-member-details",
    category: "congress",
    cronSchedule: "0 1 * * *", // Daily at 1 AM
  },
  {
    id: "bills",
    label: "Bills & Sponsorships",
    description: "Syncs all bills from Congress 118 & 119 with sponsorship data",
    expectedTotal: 20000,
    icon: <FileText className="h-4 w-4" />,
    functionName: "sync-bills",
    category: "congress",
    cronSchedule: "0 */6 * * *", // Every 6 hours
  },
  {
    id: "votes",
    label: "Votes & Positions",
    description: "Syncs House and Senate votes with individual member positions",
    expectedTotal: 2000,
    icon: <Vote className="h-4 w-4" />,
    functionName: "sync-votes",
    category: "congress",
    cronSchedule: "0 */2 * * *", // Every 2 hours
  },
  // Finance data
  {
    id: "fec-finance",
    label: "FEC Contributions",
    description: "Syncs itemized contributions from FEC API",
    expectedTotal: 539,
    icon: <DollarSign className="h-4 w-4" />,
    functionName: "sync-fec-finance",
    category: "finance",
    cronSchedule: "*/5 * * * *", // Every 5 minutes
  },
  {
    id: "fec-funding",
    label: "FEC Funding Metrics",
    description: "Computes grassroots/PAC/local scores per cycle",
    expectedTotal: 539,
    icon: <DollarSign className="h-4 w-4" />,
    functionName: "sync-fec-funding",
    category: "finance",
    cronSchedule: "0 2 * * *", // Nightly at 2 AM
  },
  // Scores & Analysis
  {
    id: "member-scores",
    label: "Member Scores",
    description: "Recalculates all member scores from latest data",
    expectedTotal: 539,
    icon: <Calculator className="h-4 w-4" />,
    functionName: "calculate-member-scores",
    category: "scores",
    cronSchedule: "30 */2 * * *", // Every 2 hours at :30
  },
  {
    id: "state-scores",
    label: "State Aggregates",
    description: "Recalculates state-level score averages",
    expectedTotal: 50,
    icon: <MapPin className="h-4 w-4" />,
    functionName: "recalculate-state-scores",
    category: "scores",
    cronSchedule: "45 */2 * * *", // Every 2 hours at :45
  },
  {
    id: "issue-signals",
    label: "Issue Classification",
    description: "AI classifies bills/votes into political issues",
    expectedTotal: 5000,
    icon: <Brain className="h-4 w-4" />,
    functionName: "classify-issue-signals",
    category: "scores",
    cronSchedule: "15 */6 * * *", // Every 6 hours at :15
  },
  {
    id: "politician-positions",
    label: "Politician Positions",
    description: "Computes politician stances per issue from signals",
    expectedTotal: 539,
    icon: <BarChart3 className="h-4 w-4" />,
    functionName: "compute-politician-positions",
    category: "scores",
    cronSchedule: "30 */6 * * *", // Every 6 hours at :30
  },
  {
    id: "notifications",
    label: "Email Notifications",
    description: "Sends tracked member vote alerts to users",
    expectedTotal: 100,
    icon: <Bell className="h-4 w-4" />,
    functionName: "send-member-notifications",
    category: "scores",
    cronSchedule: "0 8 * * *", // Daily at 8 AM
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

function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  
  if (diffMs < 0) return "now";
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `in ${diffSecs}s`;
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h ${diffMins % 60}m`;
  return `in ${diffDays}d ${diffHours % 24}h`;
}

function getNextRunTime(cronSchedule: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronSchedule, {
      tz: "UTC",
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

function getCronDescription(cronSchedule: string): string {
  // Simple human-readable descriptions for common patterns
  if (cronSchedule === "*/5 * * * *") return "Every 5 min";
  if (cronSchedule === "0 */2 * * *") return "Every 2h";
  if (cronSchedule === "30 */2 * * *") return "Every 2h at :30";
  if (cronSchedule === "45 */2 * * *") return "Every 2h at :45";
  if (cronSchedule === "0 */6 * * *") return "Every 6h";
  if (cronSchedule === "15 */6 * * *") return "Every 6h at :15";
  if (cronSchedule === "30 */6 * * *") return "Every 6h at :30";
  if (cronSchedule === "0 0 * * *") return "Daily 00:00 UTC";
  if (cronSchedule === "0 1 * * *") return "Daily 01:00 UTC";
  if (cronSchedule === "0 2 * * *") return "Daily 02:00 UTC";
  if (cronSchedule === "0 8 * * *") return "Daily 08:00 UTC";
  return cronSchedule;
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
  const [activeCategory, setActiveCategory] = useState<"all" | "congress" | "finance" | "scores">("all");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for next run calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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
    
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchSyncProgress();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    const hasRunning = syncProgress.some((s) => s.status === "running");
    setAutoRefresh(hasRunning);
  }, [syncProgress]);

  const triggerSync = async (config: SyncConfig) => {
    setTriggeringSyncId(config.id);
    try {
      const functionName = config.functionName || `sync-${config.id}`;
      const { error } = await supabase.functions.invoke(functionName);

      if (error) throw error;

      toast({
        title: "Sync Started",
        description: `${config.label} sync has been triggered.`,
      });

      setAutoRefresh(true);
      setTimeout(fetchSyncProgress, 1000);
    } catch (error) {
      console.error("Error triggering sync:", error);
      toast({
        title: "Error",
        description: `Failed to trigger ${config.label} sync`,
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

  const filteredConfigs = SYNC_CONFIGS.filter(
    (c) => activeCategory === "all" || c.category === activeCategory
  );

  const getSyncStats = () => {
    const running = syncProgress.filter((s) => s.status === "running").length;
    const complete = syncProgress.filter((s) => s.status === "complete").length;
    const errors = syncProgress.filter((s) => s.status === "error").length;
    const total = SYNC_CONFIGS.length;
    return { running, complete, errors, total };
  };

  const stats = getSyncStats();

  // Memoize next run times to avoid recalculating on every render
  const nextRunTimes = useMemo(() => {
    const times: Record<string, Date | null> = {};
    SYNC_CONFIGS.forEach((config) => {
      times[config.id] = getNextRunTime(config.cronSchedule);
    });
    return times;
  }, [currentTime]);

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
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Running</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {stats.running > 0 && <Loader2 className="h-5 w-5 animate-spin text-amber-500" />}
              {stats.running}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Complete</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {stats.complete}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errors</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {stats.errors}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sources</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Sync Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Data Synchronization
              {autoRefresh && (
                <Badge variant="outline" className="text-xs ml-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1 animate-pulse" />
                  Live
                </Badge>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={fetchSyncProgress}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Monitor and trigger data sync from Congress.gov, FEC, and score calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Category Filter */}
          <div className="flex gap-2 mb-6">
            {(["all", "congress", "finance", "scores"] as const).map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat)}
              >
                {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredConfigs.map((config) => {
              const progress = syncProgress.find((s) => s.id === config.id);
              const percentage = getProgressPercentage(config, progress);
              const metadataInfo = getMetadataInfo(progress);
              const isRunning = progress?.status === "running";
              const isTriggering = triggeringSyncId === config.id;
              const nextRun = nextRunTimes[config.id];

              return (
                <div
                  key={config.id}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    isRunning ? "border-amber-500/50 bg-amber-500/5" : 
                    progress?.status === "error" ? "border-destructive/50 bg-destructive/5" :
                    "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1 p-2 rounded-md bg-muted">
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{config.label}</h3>
                          {getStatusBadge(progress?.status || null)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {config.category}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Timer className="h-3 w-3 mr-1" />
                            {getCronDescription(config.cronSchedule)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                        
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Processed: <span className="font-medium text-foreground">{(progress?.total_processed || 0).toLocaleString()}</span>
                              {config.expectedTotal && (
                                <span className="text-muted-foreground"> / ~{config.expectedTotal.toLocaleString()}</span>
                              )}
                              {progress?.last_matched_count != null && progress.last_matched_count > 0 && (
                                <span className="text-emerald-600 ml-2">
                                  (+{progress.last_matched_count} matched)
                                </span>
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

                          {progress?.error_message && (
                            <p className="text-xs text-destructive">
                              Error: {progress.error_message}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last: {formatTimeAgo(progress?.last_run_at || null)}
                            </span>
                            {nextRun && (
                              <span className="flex items-center gap-1 text-primary">
                                <Timer className="h-3 w-3" />
                                Next: {formatTimeUntil(nextRun)}
                              </span>
                            )}
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
                      onClick={() => triggerSync(config)}
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
                          Run
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
    </div>
  );
}