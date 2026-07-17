import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, PlayCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Job {
  id: string;
  job_type: string;
  provider: string | null;
  status: string | null;
  priority: number | null;
  frequency_minutes: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
  is_enabled: boolean | null;
  attempt_count: number | null;
  last_error: string | null;
}

interface Run {
  id: string;
  job_id: string;
  provider: string;
  job_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  records_fetched: number | null;
  records_upserted: number | null;
  api_calls: number | null;
  error: string | null;
}

export function JobsPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [j, r] = await Promise.all([
      supabase.from("sync_jobs").select("*").order("priority", { ascending: false }),
      supabase.from("sync_job_runs").select("*").order("started_at", { ascending: false }).limit(100),
    ]);
    setJobs((j.data as Job[]) || []);
    setRuns((r.data as Run[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const statusBadge = (s: string | null) => {
    if (s === "success" || s === "completed") return <Badge className="bg-green-500/20 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />{s}</Badge>;
    if (s === "failed" || s === "error") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{s}</Badge>;
    if (s === "running") return <Badge className="bg-blue-500/20 text-blue-700"><PlayCircle className="h-3 w-3 mr-1" />{s}</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{s || "idle"}</Badge>;
  };

  const successCount = runs.filter((r) => r.status === "success" || r.status === "completed").length;
  const failedCount = runs.filter((r) => r.status === "failed" || r.status === "error").length;
  const runningCount = runs.filter((r) => r.status === "running").length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Jobs</CardDescription><CardTitle className="text-2xl">{jobs.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Enabled</CardDescription><CardTitle className="text-2xl">{jobs.filter((j) => j.is_enabled).length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Recent Failures</CardDescription><CardTitle className="text-2xl text-destructive">{failedCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Running Now</CardDescription><CardTitle className="text-2xl">{runningCount}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div><CardTitle>Scheduled Jobs</CardTitle><CardDescription>Configured background syncs</CardDescription></div>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j.id} className="border rounded p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-mono text-sm font-semibold">{j.id}</div>
                    <div className="flex items-center gap-2">
                      {!j.is_enabled && <Badge variant="outline">disabled</Badge>}
                      {statusBadge(j.status)}
                      <Badge variant="secondary">every {j.frequency_minutes}m</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                    <span>Provider: {j.provider || "—"}</span>
                    <span>Priority: {j.priority}</span>
                    <span>Last: {j.last_run_at ? new Date(j.last_run_at).toLocaleString() : "never"}</span>
                    <span>Next: {j.next_run_at ? new Date(j.next_run_at).toLocaleString() : "—"}</span>
                    {j.attempt_count ? <span>Attempts: {j.attempt_count}</span> : null}
                  </div>
                  {j.last_error && <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-1 break-all">{j.last_error}</div>}
                </div>
              ))}
              {jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs configured.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>Last 100 executions · {successCount} success / {failedCount} failed</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {runs.map((r) => {
                const dur = r.started_at && r.finished_at ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000) : null;
                return (
                  <div key={r.id} className="border rounded p-2 text-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-mono text-xs">{r.job_id}</div>
                      <div className="flex items-center gap-2 text-xs">
                        {statusBadge(r.status)}
                        {dur !== null && <span className="text-muted-foreground">{dur}s</span>}
                        <span className="text-muted-foreground">{r.started_at ? new Date(r.started_at).toLocaleString() : ""}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Fetched {r.records_fetched ?? 0} · Upserted {r.records_upserted ?? 0} · API calls {r.api_calls ?? 0}
                    </div>
                    {r.error && <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-1 break-all">{r.error}</div>}
                  </div>
                );
              })}
              {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
