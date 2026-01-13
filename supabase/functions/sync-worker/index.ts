import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sync worker: processes queued jobs one at a time
// Uses FOR UPDATE SKIP LOCKED pattern to prevent overlap

const MAX_JOBS_PER_INVOCATION = 3;
const MAX_RECORDS_PER_JOB = 500;
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 2000;

// Priority cycles: 2024+ first, then historical
const PRIORITY_CYCLES = [2026, 2024];
const HISTORICAL_CYCLES = [2022, 2020, 2018];

interface SyncJob {
  id: string;
  provider: string;
  job_type: string;
  scope: Record<string, unknown>;
  cursor: Record<string, unknown>;
  attempt_count: number;
  frequency_minutes: number;
  max_duration_seconds: number;
}

interface JobResult {
  success: boolean;
  records_fetched: number;
  records_upserted: number;
  api_calls: number;
  wait_time_ms: number;
  has_more: boolean;
  new_cursor?: Record<string, unknown>;
  error?: string;
}

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
      return new Response(
        JSON.stringify({ success: false, message: "Sync is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if syncs are paused
    const { data: syncPaused } = await supabase
      .from("feature_toggles")
      .select("enabled")
      .eq("id", "sync_paused")
      .single();

    if (syncPaused?.enabled === true) {
      return new Response(
        JSON.stringify({ success: false, message: "Syncs are paused" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get queued jobs (prioritized, with lock)
    const { data: queuedJobs, error: fetchError } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("is_enabled", true)
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .limit(MAX_JOBS_PER_INVOCATION);

    if (fetchError) {
      throw fetchError;
    }

    if (!queuedJobs || queuedJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No jobs in queue", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ job_id: string; result: JobResult }> = [];
    const now = new Date();

    for (const job of queuedJobs) {
      // Mark job as running
      const lockUntil = new Date(now.getTime() + (job.max_duration_seconds || 300) * 1000);
      
      await supabase
        .from("sync_jobs")
        .update({
          status: "running",
          last_run_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", job.id);

      await supabase
        .from("sync_progress")
        .upsert({
          id: job.id,
          status: "running",
          last_run_at: now.toISOString(),
          lock_until: lockUntil.toISOString(),
          error_message: null,
        });

      // Create job run record
      const { data: jobRun } = await supabase
        .from("sync_job_runs")
        .insert({
          job_id: job.id,
          provider: job.provider || getProvider(job.id),
          job_type: job.job_type,
          scope: job.scope || {},
          status: "running",
          started_at: now.toISOString(),
        })
        .select()
        .single();

      let result: JobResult;
      
      try {
        // Process the job based on type
        result = await processJob(supabase, job as SyncJob, supabaseUrl, supabaseKey);
        
        // Update job status
        if (result.has_more) {
          // Re-queue with new cursor
          await supabase
            .from("sync_jobs")
            .update({
              status: "queued",
              cursor: result.new_cursor || {},
              attempt_count: 0,
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } else {
          // Mark as idle (complete)
          await supabase
            .from("sync_jobs")
            .update({
              status: "idle",
              cursor: {},
              attempt_count: 0,
              last_error: null,
              next_run_at: new Date(Date.now() + (job.frequency_minutes || 60) * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }

        // Update sync_progress
        await supabase
          .from("sync_progress")
          .update({
            status: result.has_more ? "running" : "complete",
            lock_until: result.has_more ? new Date(Date.now() + 60000).toISOString() : null,
            last_success_count: (job.attempt_count || 0) === 0 ? result.records_upserted : undefined,
            total_processed: result.records_upserted,
            cursor_json: result.new_cursor || {},
            error_message: null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Update sync_state watermark
        if (result.success && !result.has_more) {
          await supabase
            .from("sync_state")
            .upsert({
              provider: job.provider || getProvider(job.id),
              dataset: job.job_type,
              scope_key: "global",
              last_success_at: new Date().toISOString(),
              last_cursor: result.new_cursor || {},
              records_total: result.records_upserted,
              updated_at: new Date().toISOString(),
            });
        }

      } catch (error) {
        result = {
          success: false,
          records_fetched: 0,
          records_upserted: 0,
          api_calls: 0,
          wait_time_ms: 0,
          has_more: false,
          error: String(error),
        };

        const newAttemptCount = (job.attempt_count || 0) + 1;
        
        if (newAttemptCount >= MAX_RETRIES) {
          // Mark as failed
          await supabase
            .from("sync_jobs")
            .update({
              status: "failed",
              attempt_count: newAttemptCount,
              last_error: String(error),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          await supabase
            .from("sync_progress")
            .update({
              status: "error",
              lock_until: null,
              last_failure_count: newAttemptCount,
              error_message: String(error),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } else {
          // Retry with backoff
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, newAttemptCount) * (1 + Math.random() * 0.3);
          const nextRunAt = new Date(Date.now() + backoffMs);
          
          await supabase
            .from("sync_jobs")
            .update({
              status: "queued",
              attempt_count: newAttemptCount,
              last_error: String(error),
              next_run_at: nextRunAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          await supabase
            .from("sync_progress")
            .update({
              status: "retrying",
              lock_until: nextRunAt.toISOString(),
              last_failure_count: newAttemptCount,
              error_message: String(error),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }
      }

      // Update job run record
      if (jobRun) {
        await supabase
          .from("sync_job_runs")
          .update({
            status: result.success ? "succeeded" : "failed",
            finished_at: new Date().toISOString(),
            records_fetched: result.records_fetched,
            records_upserted: result.records_upserted,
            api_calls: result.api_calls,
            wait_time_ms: result.wait_time_ms,
            error: result.error,
          })
          .eq("id", jobRun.id);
      }

      results.push({ job_id: job.id, result });
      console.log(`[sync-worker] Processed job ${job.id}: success=${result.success}, records=${result.records_upserted}`);
    }

    const duration = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-worker] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getProvider(jobId: string): string {
  if (jobId.startsWith('fec') || jobId.includes('fec')) return 'fec';
  if (jobId.startsWith('congress') || jobId.includes('congress') || jobId.includes('bills') || jobId.includes('votes') || jobId.includes('members')) return 'congress';
  return 'internal';
}

async function processJob(
  supabase: any,
  job: SyncJob,
  supabaseUrl: string,
  supabaseKey: string
): Promise<JobResult> {
  const provider = job.provider || getProvider(job.id);
  const jobType = job.job_type;
  
  // Get watermark from sync_state
  const { data: syncState } = await supabase
    .from("sync_state")
    .select("*")
    .eq("provider", provider)
    .eq("dataset", jobType)
    .eq("scope_key", "global")
    .single();

  const lastSuccessAt = (syncState as any)?.last_success_at;
  const lastCursor = job.cursor || (syncState as any)?.last_cursor || {};

  // Route to appropriate sync function
  switch (job.id) {
    case 'congress-members':
    case 'sync-congress-members':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-congress-members', {
        mode: 'incremental',
        since: lastSuccessAt,
        cursor: lastCursor,
        limit: MAX_RECORDS_PER_JOB,
      });

    case 'congress-bills':
    case 'sync-bills':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-bills', {
        mode: 'incremental',
        since: lastSuccessAt,
        cursor: lastCursor,
        limit: MAX_RECORDS_PER_JOB,
      });

    case 'congress-votes':
    case 'sync-votes':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-votes', {
        mode: 'incremental',
        since: lastSuccessAt,
        cursor: lastCursor,
        limit: MAX_RECORDS_PER_JOB,
      });

    case 'fec-funding':
    case 'sync-fec-funding':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-funding', {
        mode: 'incremental',
        since: lastSuccessAt,
        cursor: lastCursor,
        limit: MAX_RECORDS_PER_JOB,
      });

    // FEC Finance with cycle-specific prioritization
    case 'fec-finance':
    case 'sync-fec-finance':
      return await processFecFinanceJob(supabase, supabaseUrl, supabaseKey, job, lastCursor);

    // Cycle-specific FEC jobs (priority cycles: 2024, 2026)
    case 'fec-finance-2026':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
        cycle: 2026,
        limit: 10,
      });

    case 'fec-finance-2024':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
        cycle: 2024,
        limit: 10,
      });

    // Historical cycles (lower priority, processed later)
    case 'fec-finance-2022':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
        cycle: 2022,
        limit: 5,
      });

    case 'fec-finance-2020':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
        cycle: 2020,
        limit: 5,
      });

    case 'fec-finance-2018':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
        cycle: 2018,
        limit: 5,
      });

    case 'member-scores':
    case 'calculate-member-scores':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'calculate-member-scores', {
        mode: 'incremental',
        limit: MAX_RECORDS_PER_JOB,
      });

    case 'classify-issues':
    case 'classify-issue-signals':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'classify-issue-signals', {
        mode: 'incremental',
        batch_size: Math.min(50, MAX_RECORDS_PER_JOB),
      });

    case 'state-scores':
    case 'recalculate-state-scores':
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'recalculate-state-scores', {});

    default:
      console.log(`[sync-worker] Unknown job type: ${job.id}`);
      return {
        success: false,
        records_fetched: 0,
        records_upserted: 0,
        api_calls: 0,
        wait_time_ms: 0,
        has_more: false,
        error: `Unknown job type: ${job.id}`,
      };
  }
}

// FEC Finance job with intelligent cycle prioritization
async function processFecFinanceJob(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  job: SyncJob,
  lastCursor: Record<string, unknown>
): Promise<JobResult> {
  // Check completion status for each cycle
  const { data: syncStates } = await supabase
    .from("fec_sync_state")
    .select("cycle, is_complete")
    .eq("is_complete", false);

  const incompleteCycles = new Set((syncStates || []).map((s: any) => s.cycle));

  // Priority: 2024/2026 first, then historical
  for (const cycle of PRIORITY_CYCLES) {
    if (incompleteCycles.has(cycle) || incompleteCycles.size === 0) {
      console.log(`[sync-worker] Processing priority cycle ${cycle}`);
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
        cycle,
        limit: 10,
      });
    }
  }

  // Check if priority cycles are complete before processing historical
  const { data: priorityComplete } = await supabase
    .from("fec_sync_state")
    .select("cycle")
    .in("cycle", PRIORITY_CYCLES)
    .eq("is_complete", false);

  if (priorityComplete && priorityComplete.length > 0) {
    // Still have incomplete priority cycles
    const nextCycle = priorityComplete[0].cycle;
    console.log(`[sync-worker] Continuing priority cycle ${nextCycle}`);
    return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
      cycle: nextCycle,
      limit: 10,
    });
  }

  // Process historical cycles only after priority cycles are complete
  for (const cycle of HISTORICAL_CYCLES) {
    if (incompleteCycles.has(cycle)) {
      console.log(`[sync-worker] Processing historical cycle ${cycle}`);
      return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
        cycle,
        limit: 5, // Slower rate for historical data
      });
    }
  }

  // All cycles complete, run general sync
  console.log(`[sync-worker] All cycles complete, running general FEC sync`);
  return await callEdgeFunction(supabaseUrl, supabaseKey, 'sync-fec-finance', {
    mode: 'incremental',
    limit: 10,
  });
}

async function callEdgeFunction(
  supabaseUrl: string,
  supabaseKey: string,
  functionName: string,
  body: Record<string, unknown>
): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        records_fetched: 0,
        records_upserted: 0,
        api_calls: 1,
        wait_time_ms: duration,
        has_more: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: data.success !== false,
      records_fetched: data.records_fetched || data.processed || 0,
      records_upserted: data.records_upserted || data.upserted || data.processed || 0,
      api_calls: data.api_calls || 1,
      wait_time_ms: data.wait_time_ms || duration,
      has_more: data.has_more || false,
      new_cursor: data.cursor || data.new_cursor,
      error: data.error,
    };
  } catch (error) {
    return {
      success: false,
      records_fetched: 0,
      records_upserted: 0,
      api_calls: 1,
      wait_time_ms: Date.now() - startTime,
      has_more: false,
      error: String(error),
    };
  }
}
