import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Users, 
  FileText, 
  DollarSign,
  Building2,
  Target,
  Loader2,
  Clock,
  AlertCircle,
  Check,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SyncHealthItem {
  job_id: string;
  status: string;
  last_run_at: string | null;
  total_processed: number;
  health_status: string;
  is_enabled: boolean;
  frequency_minutes: number | null;
  minutes_since_last_run: number | null;
  last_success_count: number | null;
  last_failure_count: number | null;
}

interface DataAnomaly {
  id: string;
  anomaly_type: string;
  entity_type: string;
  entity_id: string | null;
  severity: string;
  details_json: unknown;
  detected_at: string;
  resolved_at: string | null;
}

interface DataGaps {
  members_missing_contributions: number;
  members_missing_scores: number;
  members_missing_committees: number;
  members_missing_positions: number;
  total_members: number;
  total_bills: number;
  bills_classified: number;
}

interface JobRun {
  id: string;
  job_id: string;
  job_type: string;
  provider: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  records_fetched: number | null;
  records_upserted: number | null;
  api_calls: number | null;
  wait_time_ms: number | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

interface ApiErrorSummary {
  job_id: string;
  error_count: number;
  last_error: string | null;
  last_error_at: string | null;
}

export function DataHealthPanel() {
  const { toast } = useToast();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showRecentRuns, setShowRecentRuns] = useState(false);
  const [showApiErrors, setShowApiErrors] = useState(false);

  // Fetch sync health
  const { data: syncHealth, isLoading: loadingSyncHealth, refetch: refetchSyncHealth } = useQuery({
    queryKey: ["admin-sync-health"],
    queryFn: async (): Promise<SyncHealthItem[]> => {
      const { data, error } = await supabase
        .from("sync_health")
        .select("*")
        .order("job_id");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch data anomalies
  const { data: anomalies, isLoading: loadingAnomalies, refetch: refetchAnomalies } = useQuery({
    queryKey: ["admin-data-anomalies"],
    queryFn: async (): Promise<DataAnomaly[]> => {
      const { data, error } = await supabase
        .from("data_anomalies")
        .select("*")
        .is("resolved_at", null)
        .order("detected_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch data gaps
  const { data: dataGaps, isLoading: loadingGaps, refetch: refetchGaps } = useQuery({
    queryKey: ["admin-data-gaps"],
    queryFn: async (): Promise<DataGaps> => {
      // Run multiple queries in parallel
      const [
        missingContributions,
        missingScores,
        missingCommittees,
        missingPositions,
        totalMembers,
        totalBills,
        billsClassified
      ] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true })
          .not("fec_candidate_id", "is", null)
          .not("id", "in", `(SELECT DISTINCT member_id FROM member_contributions)`),
        supabase.from("members").select("id", { count: "exact", head: true })
          .not("id", "in", `(SELECT DISTINCT member_id FROM member_scores WHERE user_id IS NULL)`),
        supabase.from("members").select("id", { count: "exact", head: true })
          .not("id", "in", `(SELECT DISTINCT member_id FROM member_committees)`),
        supabase.from("members").select("id", { count: "exact", head: true })
          .not("id", "in", `(SELECT DISTINCT politician_id FROM politician_issue_positions)`),
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("bills").select("id", { count: "exact", head: true }),
        supabase.from("issue_signals").select("id", { count: "exact", head: true })
          .eq("signal_type", "bill_sponsorship"),
      ]);

      // Fallback: use RPC or direct counts if subquery doesn't work
      const { count: contribMembersCount } = await supabase
        .from("member_contributions")
        .select("member_id", { count: "exact", head: true });
      
      const { count: committeeMembersCount } = await supabase
        .from("member_committees")
        .select("member_id", { count: "exact", head: true });
      
      const { count: positionMembersCount } = await supabase
        .from("politician_issue_positions")
        .select("politician_id", { count: "exact", head: true });

      const { count: scoredMembersCount } = await supabase
        .from("member_scores")
        .select("member_id", { count: "exact", head: true })
        .is("user_id", null);

      const { count: fecMembersCount } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .not("fec_candidate_id", "is", null);

      const totalMembersCount = totalMembers.count || 539;
      
      return {
        members_missing_contributions: Math.max(0, (fecMembersCount || 0) - (contribMembersCount || 0)),
        members_missing_scores: Math.max(0, totalMembersCount - (scoredMembersCount || 0)),
        members_missing_committees: Math.max(0, totalMembersCount - (committeeMembersCount || 0)),
        members_missing_positions: Math.max(0, totalMembersCount - (positionMembersCount || 0)),
        total_members: totalMembersCount,
        total_bills: totalBills.count || 0,
        bills_classified: billsClassified.count || 0,
      };
    },
    staleTime: 60000,
  });

  // Fetch recent job runs
  const { data: recentJobRuns, isLoading: loadingJobRuns, refetch: refetchJobRuns } = useQuery({
    queryKey: ["admin-recent-job-runs"],
    queryFn: async (): Promise<JobRun[]> => {
      const { data, error } = await supabase
        .from("sync_job_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(25);
      
      if (error) throw error;
      return (data || []) as JobRun[];
    },
    staleTime: 30000,
  });

  // Calculate API error summary from recent job runs
  const apiErrorSummary: ApiErrorSummary[] = recentJobRuns
    ? Object.values(
        recentJobRuns
          .filter(run => run.error)
          .reduce((acc, run) => {
            if (!acc[run.job_id]) {
              acc[run.job_id] = {
                job_id: run.job_id,
                error_count: 0,
                last_error: run.error,
                last_error_at: run.started_at,
              };
            }
            acc[run.job_id].error_count++;
            if (run.started_at && (!acc[run.job_id].last_error_at || run.started_at > acc[run.job_id].last_error_at)) {
              acc[run.job_id].last_error = run.error;
              acc[run.job_id].last_error_at = run.started_at;
            }
            return acc;
          }, {} as Record<string, ApiErrorSummary>)
      )
    : [];

  // Calculate API call stats from recent runs
  const apiStats = recentJobRuns
    ? {
        totalCalls: recentJobRuns.reduce((sum, run) => sum + (run.api_calls || 0), 0),
        totalWaitTime: recentJobRuns.reduce((sum, run) => sum + (run.wait_time_ms || 0), 0),
        totalRecordsFetched: recentJobRuns.reduce((sum, run) => sum + (run.records_fetched || 0), 0),
        totalRecordsUpserted: recentJobRuns.reduce((sum, run) => sum + (run.records_upserted || 0), 0),
        errorCount: recentJobRuns.filter(run => run.error).length,
        successCount: recentJobRuns.filter(run => run.status === 'complete' && !run.error).length,
      }
    : null;

  const handleRefresh = () => {
    refetchSyncHealth();
    refetchAnomalies();
    refetchGaps();
    refetchJobRuns();
  };

  const handleResolveAnomaly = async (anomalyId: string) => {
    setResolvingId(anomalyId);
    try {
      const { error } = await supabase
        .from("data_anomalies")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", anomalyId);
      
      if (error) throw error;
      
      toast({
        title: "Anomaly Resolved",
        description: "The data anomaly has been marked as resolved.",
      });
      
      refetchAnomalies();
    } catch (error) {
      console.error("Error resolving anomaly:", error);
      toast({
        title: "Error",
        description: "Failed to resolve anomaly. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResolvingId(null);
    }
  };

  const isLoading = loadingSyncHealth || loadingAnomalies || loadingGaps || loadingJobRuns;

  // Calculate overall health score
  const healthyJobs = syncHealth?.filter(j => j.health_status === "healthy").length || 0;
  const totalJobs = syncHealth?.length || 1;
  const syncHealthScore = Math.round((healthyJobs / totalJobs) * 100);

  // Calculate data completeness
  const dataCompleteness = dataGaps ? {
    contributions: Math.round(((dataGaps.total_members - dataGaps.members_missing_contributions) / dataGaps.total_members) * 100),
    committees: Math.round(((dataGaps.total_members - dataGaps.members_missing_committees) / dataGaps.total_members) * 100),
    positions: Math.round(((dataGaps.total_members - dataGaps.members_missing_positions) / dataGaps.total_members) * 100),
    billClassification: Math.round((dataGaps.bills_classified / dataGaps.total_bills) * 100),
  } : null;

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "stale":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "never_run":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Health Dashboard</h2>
          <p className="text-muted-foreground">Monitor data quality, sync status, and identify gaps</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Health Score */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sync Health</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  {syncHealthScore}%
                  {syncHealthScore >= 80 ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : syncHealthScore >= 50 ? (
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-destructive" />
                  )}
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {healthyJobs}/{totalJobs} jobs healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Anomalies</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  {anomalies?.length || 0}
                  {(anomalies?.length || 0) === 0 ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-amber-500" />
                  )}
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Unresolved data issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bill Classification</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `${dataCompleteness?.billClassification || 0}%`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={dataCompleteness?.billClassification || 0} className="h-2" />
            <p className="text-sm text-muted-foreground mt-1">
              {dataGaps?.bills_classified || 0}/{dataGaps?.total_bills || 0} bills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Position Coverage</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `${dataCompleteness?.positions || 0}%`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={dataCompleteness?.positions || 0} className="h-2" />
            <p className="text-sm text-muted-foreground mt-1">
              Members with calculated positions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Gaps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Data Coverage Gaps
          </CardTitle>
          <CardDescription>
            Areas where data is incomplete or missing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Finance Data</span>
                </div>
                <Progress value={dataCompleteness?.contributions || 0} className="h-2 mb-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="font-medium">{dataCompleteness?.contributions || 0}%</span>
                </div>
                {(dataGaps?.members_missing_contributions || 0) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {dataGaps?.members_missing_contributions} members missing
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Committees</span>
                </div>
                <Progress value={dataCompleteness?.committees || 0} className="h-2 mb-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="font-medium">{dataCompleteness?.committees || 0}%</span>
                </div>
                {(dataGaps?.members_missing_committees || 0) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {dataGaps?.members_missing_committees} members missing
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Issue Positions</span>
                </div>
                <Progress value={dataCompleteness?.positions || 0} className="h-2 mb-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="font-medium">{dataCompleteness?.positions || 0}%</span>
                </div>
                {(dataGaps?.members_missing_positions || 0) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {dataGaps?.members_missing_positions} members missing
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Bill Classification</span>
                </div>
                <Progress value={dataCompleteness?.billClassification || 0} className="h-2 mb-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Classified</span>
                  <span className="font-medium">{dataCompleteness?.billClassification || 0}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(dataGaps?.total_bills || 0) - (dataGaps?.bills_classified || 0)} bills pending
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Health Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync Job Health
          </CardTitle>
          <CardDescription>
            Status of all background data synchronization jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSyncHealth ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-2">
              {syncHealth?.map((job) => (
                <div
                  key={job.job_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getHealthIcon(job.health_status)}
                    <div>
                      <p className="font-medium">{job.job_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.last_run_at 
                          ? `Last run ${formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true })}`
                          : "Never run"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant={job.status === "complete" ? "default" : job.status === "partial" ? "secondary" : "outline"}>
                        {job.status}
                      </Badge>
                      {job.total_processed > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {job.total_processed.toLocaleString()} processed
                        </p>
                      )}
                    </div>
                    {job.is_enabled === false && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Disabled
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Data Anomalies
          </CardTitle>
          <CardDescription>
            Detected data quality issues that need attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAnomalies ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (anomalies?.length || 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
              <p className="font-medium">No Active Anomalies</p>
              <p className="text-sm text-muted-foreground">All data quality checks are passing</p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalies?.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  {anomaly.severity === "critical" ? (
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{anomaly.anomaly_type}</p>
                      <Badge variant={getSeverityColor(anomaly.severity) as "destructive" | "secondary" | "outline"}>
                        {anomaly.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {anomaly.entity_type}
                      {anomaly.entity_id && `: ${anomaly.entity_id}`}
                    </p>
                    {anomaly.details_json && (
                      <pre className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded overflow-x-auto">
                        {JSON.stringify(anomaly.details_json, null, 2)}
                      </pre>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Detected {formatDistanceToNow(new Date(anomaly.detected_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolveAnomaly(anomaly.id)}
                    disabled={resolvingId === anomaly.id}
                    className="shrink-0"
                  >
                    {resolvingId === anomaly.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Resolve
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
