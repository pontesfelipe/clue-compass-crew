import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scheduled sync: runs every 10 minutes, enqueues due jobs, never does heavy work
// Uses advisory lock to prevent overlapping scheduler runs

const SCHEDULER_LOCK_ID = 123456789; // Arbitrary unique ID for advisory lock
const MAX_JOBS_PER_RUN = 10; // Limit jobs enqueued per scheduler run

interface JobConfig {
  id: string;
  provider: string;
  job_type: string;
  frequency_minutes: number;
  priority: number;
  scope?: Record<string, unknown>;
}

// Default job configurations if not in database
const DEFAULT_JOBS: JobConfig[] = [
  { id: 'congress-members', provider: 'congress', job_type: 'members', frequency_minutes: 1440, priority: 100 },
  { id: 'congress-bills', provider: 'congress', job_type: 'bills', frequency_minutes: 360, priority: 80 },
  { id: 'congress-votes', provider: 'congress', job_type: 'votes', frequency_minutes: 120, priority: 90 },
  { id: 'fec-funding', provider: 'fec', job_type: 'funding', frequency_minutes: 1440, priority: 70 },
  { id: 'fec-finance', provider: 'fec', job_type: 'finance', frequency_minutes: 300, priority: 60 },
  { id: 'member-scores', provider: 'internal', job_type: 'scores', frequency_minutes: 120, priority: 50 },
  { id: 'classify-issues', provider: 'internal', job_type: 'classification', frequency_minutes: 360, priority: 40 },
  { id: 'state-scores', provider: 'internal', job_type: 'state_scores', frequency_minutes: 120, priority: 30 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if sync is enabled
    const { data: syncEnabled } = await supabase
      .from("feature_toggles")
      .select("enabled")
      .eq("id", "sync_enabled")
      .single();

    if (!syncEnabled?.enabled) {
      console.log("[scheduled-sync] Sync is disabled, skipping");
      return new Response(
        JSON.stringify({ success: false, message: "Sync is disabled", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if syncs are paused (separate from enabled)
    const { data: syncPaused } = await supabase
      .from("feature_toggles")
      .select("enabled")
      .eq("id", "sync_paused")
      .single();

    if (syncPaused?.enabled === true) {
      console.log("[scheduled-sync] Syncs are paused, skipping");
      return new Response(
        JSON.stringify({ success: false, message: "Syncs are paused", paused: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to acquire advisory lock to prevent overlapping scheduler runs
    const { data: lockResult } = await supabase.rpc('pg_try_advisory_lock', { 
      lock_id: SCHEDULER_LOCK_ID 
    }).single();

    // If we can't get the lock via RPC, use a simpler approach with sync_progress
    const { data: schedulerProgress, error: progressError } = await supabase
      .from("sync_progress")
      .select("*")
      .eq("id", "scheduler")
      .single();

    const now = new Date();
    
    if (schedulerProgress?.status === 'running') {
      const lastRun = schedulerProgress.last_run_at ? new Date(schedulerProgress.last_run_at) : null;
      const runningForMs = lastRun ? now.getTime() - lastRun.getTime() : 0;
      
      // If running for more than 5 minutes, consider it stale
      if (runningForMs < 5 * 60 * 1000) {
        console.log("[scheduled-sync] Scheduler already running, skipping");
        return new Response(
          JSON.stringify({ success: false, message: "Scheduler already running", locked: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("[scheduled-sync] Stale scheduler lock detected, proceeding");
    }

    // Mark scheduler as running
    await supabase
      .from("sync_progress")
      .upsert({
        id: "scheduler",
        status: "running",
        last_run_at: now.toISOString(),
        lock_until: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      });

    // Get all enabled jobs from database
    const { data: dbJobs } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("is_enabled", true)
      .order("priority", { ascending: false });

    // Merge with defaults for any missing jobs
    const existingIds = new Set(dbJobs?.map(j => j.id) || []);
    const jobs = [
      ...(dbJobs || []),
      ...DEFAULT_JOBS.filter(j => !existingIds.has(j.id)),
    ];

    // Get current progress for all jobs
    const jobIds = jobs.map(j => j.id);
    const { data: progressRecords } = await supabase
      .from("sync_progress")
      .select("*")
      .in("id", jobIds);

    const progressMap = new Map(progressRecords?.map((p: any) => [p.id, p]) || []);

    // Find jobs that are due to run
    const dueJobs: Array<{ job: any; progress: any }> = [];

    for (const job of jobs) {
      const progress = progressMap.get(job.id);
      const lastRun = progress?.last_run_at ? new Date(progress.last_run_at) : null;
      const frequencyMs = (job.frequency_minutes || 60) * 60 * 1000;
      
      // Check if job is locked
      if (progress?.lock_until && new Date(progress.lock_until) > now) {
        continue;
      }
      
      // Check if job is currently running
      if (progress?.status === 'running') {
        const runningForMs = lastRun ? now.getTime() - lastRun.getTime() : 0;
        // Skip if running for less than 2x max duration
        if (runningForMs < (job.max_duration_seconds || 300) * 2000) {
          continue;
        }
        // Stale job, will be cleaned up
      }
      
      // Check if due
      const isDue = !lastRun || now.getTime() - lastRun.getTime() >= frequencyMs;
      
      if (isDue) {
        dueJobs.push({ job, progress: progress || null });
      }
    }

    // Sort by priority and limit
    dueJobs.sort((a, b) => (b.job.priority || 50) - (a.job.priority || 50));
    const jobsToEnqueue = dueJobs.slice(0, MAX_JOBS_PER_RUN);

    // Enqueue due jobs
    const enqueuedJobs: string[] = [];
    
    for (const { job, progress } of jobsToEnqueue) {
      // Update job status to queued
      await supabase
        .from("sync_jobs")
        .update({
          status: 'queued',
          next_run_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", job.id);

      // Create sync_progress entry if needed
      await supabase
        .from("sync_progress")
        .upsert({
          id: job.id,
          status: 'queued',
          updated_at: now.toISOString(),
        });

      enqueuedJobs.push(job.id);
      console.log(`[scheduled-sync] Enqueued job: ${job.id}`);
    }

    // Mark scheduler as complete
    await supabase
      .from("sync_progress")
      .update({
        status: "complete",
        lock_until: null,
        last_success_count: enqueuedJobs.length,
        updated_at: now.toISOString(),
      })
      .eq("id", "scheduler");

    const duration = Date.now() - startTime;
    console.log(`[scheduled-sync] Completed in ${duration}ms, enqueued ${enqueuedJobs.length} jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        enqueued: enqueuedJobs,
        total_due: dueJobs.length,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[scheduled-sync] Error:", error);
    
    // Try to release lock on error
    await supabase
      .from("sync_progress")
      .update({
        status: "error",
        lock_until: null,
        error_message: String(error),
      })
      .eq("id", "scheduler");

    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
