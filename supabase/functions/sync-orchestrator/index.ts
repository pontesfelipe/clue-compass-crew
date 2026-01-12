import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sync orchestrator: prevents overlapping jobs, manages job locks, runs data quality checks
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if syncs are globally paused
    const { data: pauseToggle } = await supabase
      .from("feature_toggles")
      .select("enabled")
      .eq("id", "sync_paused")
      .single();

    if (pauseToggle?.enabled === true) {
      console.log("Syncs globally paused - skipping orchestration");
      return new Response(
        JSON.stringify({ success: false, message: "Syncs are paused", paused: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all sync jobs and their current status (including dependencies)
    const { data: jobs } = await supabase
      .from("sync_jobs")
      .select("*, dependencies, wait_for_dependencies")
      .eq("is_enabled", true)
      .order("priority", { ascending: false });

    const { data: progressRecords } = await supabase
      .from("sync_progress")
      .select("*");

    const { data: syncStateRecords } = await supabase
      .from("sync_state")
      .select("*");

    const progressMap = new Map(progressRecords?.map((p: any) => [p.id, p]) || []);
    const syncStateMap = new Map(syncStateRecords?.map((s: any) => [`${s.provider}-${s.dataset}`, s]) || []);
    const now = new Date();
    const results: any[] = [];

    // Check each job
    for (const job of jobs || []) {
      const progress = progressMap.get(job.id);
      const lastRun = progress?.last_run_at ? new Date(progress.last_run_at) : null;
      const lockUntil = progress?.lock_until ? new Date(progress.lock_until) : null;

      // Check if job is locked
      if (lockUntil && lockUntil > now) {
        results.push({
          job_id: job.id,
          status: "locked",
          lock_expires: lockUntil.toISOString(),
        });
        continue;
      }

      // Check if job is currently running
      if (progress?.status === "running") {
        // If running for too long, consider it stale and unlock
        const maxDuration = job.max_duration_seconds || 300;
        const runningForSeconds = lastRun ? (now.getTime() - lastRun.getTime()) / 1000 : 0;

        if (runningForSeconds > maxDuration * 2) {
          console.log(`Job ${job.id} appears stale (running ${runningForSeconds}s), clearing lock`);
          await supabase
            .from("sync_progress")
            .update({
              status: "error",
              lock_until: null,
              error_message: "Job timed out - cleared by orchestrator",
            })
            .eq("id", job.id);

          // Log anomaly
          await supabase.from("data_anomalies").insert({
            anomaly_type: "job_timeout",
            entity_type: "sync_job",
            entity_id: job.id,
            severity: "warning",
            details_json: { running_seconds: runningForSeconds, max_duration: maxDuration },
          });
        } else {
          results.push({
            job_id: job.id,
            status: "running",
            running_seconds: runningForSeconds,
          });
        }
        continue;
      }

      // Check dependencies before marking as due
      const depCheck = await canRunJob(supabase, job, syncStateMap);

      // Check if job is due
      const frequencyMs = (job.frequency_minutes || 60) * 60 * 1000;
      const isDue = !lastRun || now.getTime() - lastRun.getTime() >= frequencyMs;

      if (!depCheck.canRun) {
        results.push({
          job_id: job.id,
          status: "blocked",
          reason: depCheck.reason,
          last_run: lastRun?.toISOString(),
        });
        continue;
      }

      results.push({
        job_id: job.id,
        status: isDue ? "due" : "waiting",
        last_run: lastRun?.toISOString(),
        next_run: lastRun ? new Date(lastRun.getTime() + frequencyMs).toISOString() : "now",
      });
    }

    // Run data quality checks
    const anomalies = await runDataQualityChecks(supabase);

    // Calculate overall health
    const healthStatus = {
      total_jobs: jobs?.length || 0,
      running: results.filter((r) => r.status === "running").length,
      due: results.filter((r) => r.status === "due").length,
      locked: results.filter((r) => r.status === "locked").length,
      anomalies_detected: anomalies.length,
      checked_at: now.toISOString(),
    };

    console.log("Orchestrator check complete:", healthStatus);

    return new Response(
      JSON.stringify({
        success: true,
        health: healthStatus,
        jobs: results,
        anomalies,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Orchestrator error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Check if a job can run based on its dependencies
async function canRunJob(
  supabase: any,
  job: any,
  syncStateMap: Map<string, any>
): Promise<{ canRun: boolean; reason?: string }> {
  // If job has no dependencies, can always run
  const dependencies = job.dependencies || [];
  if (dependencies.length === 0) {
    return { canRun: true };
  }

  // If job doesn't wait for dependencies, can run
  if (job.wait_for_dependencies === false) {
    return { canRun: true };
  }

  // Check if all dependencies have run successfully recently
  const checkInterval = new Date();
  checkInterval.setMinutes(checkInterval.getMinutes() - (job.frequency_minutes || 60) * 2); // 2x the interval

  for (const depName of dependencies) {
    // Try to find the sync state for this dependency
    let depState = null;
    
    // Check by progress ID first
    const { data: depProgress } = await supabase
      .from("sync_progress")
      .select("last_run_at, status")
      .eq("id", depName)
      .maybeSingle();

    if (depProgress) {
      depState = {
        last_sync_at: depProgress.last_run_at,
        status: depProgress.status
      };
    }

    if (!depState) {
      // Dependency has never run - allow job to proceed (might be first run)
      console.log(`Dependency '${depName}' has not run yet, allowing job to proceed`);
      continue;
    }

    if (depState.status === 'error' || depState.status === 'failed') {
      return {
        canRun: false,
        reason: `Dependency '${depName}' last sync failed`
      };
    }

    if (depState.last_sync_at && new Date(depState.last_sync_at) < checkInterval) {
      return {
        canRun: false,
        reason: `Dependency '${depName}' data is stale`
      };
    }
  }

  return { canRun: true };
}

async function runDataQualityChecks(supabase: any): Promise<any[]> {
  const anomalies: any[] = [];
  const now = new Date();

  try {
    // Check 1: All 50 states have state_scores
    const { count: stateCount } = await supabase
      .from("state_scores")
      .select("*", { count: "exact", head: true });

    if ((stateCount || 0) < 50) {
      anomalies.push({
        type: "missing_states",
        severity: "error",
        message: `Only ${stateCount} states have scores (expected 50+)`,
      });
    }

    // Check 2: Members have scores
    const { data: membersWithoutScores } = await supabase
      .from("members")
      .select("id")
      .eq("in_office", true)
      .not("id", "in", supabase.from("member_scores").select("member_id"));

    if (membersWithoutScores && membersWithoutScores.length > 10) {
      anomalies.push({
        type: "members_missing_scores",
        severity: "warning",
        message: `${membersWithoutScores.length} members have no scores`,
      });
    }

    // Check 3: Recent votes exist
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { count: recentVotes } = await supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .gte("vote_date", sevenDaysAgo.toISOString().split("T")[0]);

    if ((recentVotes || 0) === 0) {
      anomalies.push({
        type: "no_recent_votes",
        severity: "warning",
        message: "No votes recorded in the last 7 days",
      });
    }

    // Check 4: FEC contributions exist for tracked members
    const { count: contributionsCount } = await supabase
      .from("member_contributions")
      .select("*", { count: "exact", head: true })
      .eq("cycle", 2024);

    if ((contributionsCount || 0) < 100) {
      anomalies.push({
        type: "low_contributions",
        severity: "warning",
        message: `Only ${contributionsCount} FEC contributions for 2024 cycle`,
      });
    }

    // Check 5: No sync jobs have been failing repeatedly
    const { data: failingJobs } = await supabase
      .from("sync_progress")
      .select("id, status, last_failure_count")
      .gt("last_failure_count", 3);

    for (const job of failingJobs || []) {
      anomalies.push({
        type: "repeated_failures",
        severity: "error",
        message: `Job ${job.id} has failed ${job.last_failure_count} times`,
      });
    }

    // Store new anomalies in database
    for (const anomaly of anomalies) {
      // Check if similar anomaly already exists (not resolved)
      const { data: existing } = await supabase
        .from("data_anomalies")
        .select("id")
        .eq("anomaly_type", anomaly.type)
        .is("resolved_at", null)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("data_anomalies").insert({
          anomaly_type: anomaly.type,
          entity_type: "data_quality",
          severity: anomaly.severity,
          details_json: { message: anomaly.message },
        });
      }
    }
  } catch (error) {
    console.error("Data quality check error:", error);
  }

  return anomalies;
}
