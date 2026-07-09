// Sync state bills from OpenStates API
// Resumable per-state cursor with updated_since incremental watermark

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { fetchJson, TimeBudget } from "../_shared/httpClient.ts";
import { STATE_JURISDICTIONS } from "../_shared/states.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDER = "openstates";
const SYNC_ID = "sync-state-bills";
const BASE_URL = "https://v3.openstates.org";

interface OSBill {
  id: string;
  identifier: string;
  title: string;
  classification?: string[];
  subject?: string[];
  session: string;
  jurisdiction: { id: string; name: string };
  from_organization?: { classification?: string };
  first_action_date?: string;
  latest_action_date?: string;
  latest_action_description?: string;
  latest_passage_date?: string;
  updated_at?: string;
  abstracts?: Array<{ abstract: string }>;
  openstates_url?: string;
}

async function isSyncPaused(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("feature_toggles")
      .select("enabled")
      .eq("id", "sync_paused")
      .single();
    return data?.enabled === true;
  } catch {
    return false;
  }
}

function billTypeFromIdentifier(identifier: string): string {
  // e.g. "HB 123", "SB 45", "AB 100" — extract prefix
  const match = identifier.trim().match(/^([A-Z]+)/i);
  const prefix = (match?.[1] || "hr").toLowerCase();
  // Map to existing enum-friendly codes (lowercase). Existing federal bill_type enum is HR/S/HJRES etc.
  // We accept any text — column is USER-DEFINED enum but state bills might fail. We'll store as 'hr' fallback if unknown.
  // Our enum likely contains: hr, s, hjres, sjres, hconres, sconres, hres, sres
  const knownFederal = new Set(["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"]);
  if (knownFederal.has(prefix)) return prefix;
  // Map common state prefixes to closest federal-like code so the enum accepts it
  if (prefix === "hb" || prefix === "ab") return "hr";
  if (prefix === "sb") return "s";
  if (prefix === "hr") return "hres";
  if (prefix === "sr") return "sres";
  if (prefix === "hjr") return "hjres";
  if (prefix === "sjr") return "sjres";
  return "hr";
}

function billNumberFromIdentifier(identifier: string): number {
  const m = identifier.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function processStateBills(
  supabase: any,
  apiKey: string,
  state: { abbr: string; name: string; ocd: string },
  budget: TimeBudget,
  startPage: number,
  updatedSince: string | null,
): Promise<{ upserted: number; nextPage: number | null; latestUpdate: string | null }> {
  let upserted = 0;
  let page = startPage;
  let maxPage = 1;
  let latestUpdate: string | null = null;

  while (budget.shouldContinue()) {
    // NOTE: OpenStates v3 /bills currently 502s when using OCD jurisdiction id or
    // sort=updated_desc / updated_since. Use the jurisdiction *name* and
    // sort=latest_action_desc, which are responsive. Stop early once we page
    // past our watermark (latest_action_date <= updatedSince).
    const params = new URLSearchParams({
      jurisdiction: state.name,
      sort: "latest_action_desc",
      page: String(page),
      per_page: "20",
      apikey: apiKey,
    });
    const url = `${BASE_URL}/bills?${params.toString()}`;

    const data = await fetchJson<any>(url, {}, PROVIDER, {}, budget);
    if (!data || !Array.isArray(data.results)) {
      throw new Error(`OpenStates returned malformed response for ${state.abbr} p${page}: ${JSON.stringify(data).slice(0, 200)}`);
    }
    maxPage = data.pagination?.max_page ?? 1;
    const results = data.results as OSBill[];
    console.log(`[${state.abbr}] page=${page} results=${results.length} maxPage=${maxPage}`);

    let hitWatermark = false;
    const rows = results.map((b) => {
      if (b.updated_at && (!latestUpdate || b.updated_at > latestUpdate)) {
        latestUpdate = b.updated_at;
      }
      if (updatedSince && b.latest_action_date && b.latest_action_date < updatedSince.slice(0, 10)) {
        hitWatermark = true;
      }
      return {
        openstates_id: b.id,
        bill_type: billTypeFromIdentifier(b.identifier),
        bill_number: billNumberFromIdentifier(b.identifier),
        title: b.title,
        summary: b.abstracts?.[0]?.abstract || null,
        introduced_date: b.first_action_date || null,
        latest_action_date: b.latest_action_date || null,
        latest_action_text: b.latest_action_description || null,
        enacted: !!b.latest_passage_date,
        enacted_date: b.latest_passage_date || null,
        subjects: b.subject || null,
        url: b.openstates_url || null,
        level: "state" as const,
        state: state.abbr,
        session: b.session,
        congress: null,
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      const { error } = await supabase
        .from("bills")
        .upsert(rows, { onConflict: "openstates_id" });
      if (error) throw new Error(`Bills upsert failed for ${state.abbr}: ${error.message}`);
      upserted += rows.length;
    }

    if (page >= maxPage || hitWatermark || results.length === 0) {
      return { upserted, nextPage: null, latestUpdate };
    }
    page++;
  }

  return { upserted, nextPage: page, latestUpdate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENSTATES_API_KEY");
    if (!apiKey) throw new Error("OPENSTATES_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (await isSyncPaused(supabase)) {
      return new Response(
        JSON.stringify({ success: false, paused: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const forcedState = url.searchParams.get("state");
    const maxDurationSeconds = Number(url.searchParams.get("budget") ?? "120");

    const { data: progress } = await supabase
      .from("sync_progress")
      .select("cursor_json, total_processed")
      .eq("id", SYNC_ID)
      .maybeSingle();

    const cursor = (progress?.cursor_json ?? {}) as {
      stateIndex?: number;
      page?: number;
      perStateUpdatedSince?: Record<string, string>;
    };
    let stateIndex = forcedState
      ? STATE_JURISDICTIONS.findIndex((s) => s.abbr === forcedState.toUpperCase())
      : cursor.stateIndex ?? 0;
    let page = cursor.page ?? 1;
    const perStateUpdatedSince = cursor.perStateUpdatedSince ?? {};

    if (stateIndex < 0) stateIndex = 0;

    const budget = new TimeBudget(maxDurationSeconds);
    let totalUpserted = 0;
    const statesProcessed: string[] = [];

    await supabase.from("sync_progress").upsert(
      { id: SYNC_ID, status: "running", last_run_at: new Date().toISOString() },
      { onConflict: "id" },
    );

    while (stateIndex < STATE_JURISDICTIONS.length && budget.shouldContinue()) {
      const state = STATE_JURISDICTIONS[stateIndex];
      const updatedSince = perStateUpdatedSince[state.abbr] ?? null;
      try {
        const result = await processStateBills(supabase, apiKey, state, budget, page, updatedSince);
        totalUpserted += result.upserted;
        statesProcessed.push(`${state.abbr}(${result.upserted})`);

        if (result.nextPage === null) {
          // Update high-water mark for this state on full pass completion
          if (result.latestUpdate) perStateUpdatedSince[state.abbr] = result.latestUpdate;
          stateIndex++;
          page = 1;
        } else {
          page = result.nextPage;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase.from("sync_progress").upsert(
          {
            id: SYNC_ID,
            status: "failed",
            cursor_json: { stateIndex, page, perStateUpdatedSince },
            error_message: msg,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        return new Response(
          JSON.stringify({ success: false, error: msg, statesProcessed, totalUpserted }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const isComplete = stateIndex >= STATE_JURISDICTIONS.length;
    // On full completion, reset to start so next run picks up incremental from each state's watermark
    const newCursor = isComplete ? { perStateUpdatedSince } : { stateIndex, page, perStateUpdatedSince };

    await supabase.from("sync_progress").upsert(
      {
        id: SYNC_ID,
        status: isComplete ? "complete" : "partial",
        cursor_json: newCursor,
        last_synced_at: new Date().toISOString(),
        last_success_count: totalUpserted,
        total_processed: (progress?.total_processed ?? 0) + totalUpserted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    return new Response(
      JSON.stringify({
        success: true,
        upserted: totalUpserted,
        statesProcessed,
        complete: isComplete,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("sync-state-bills error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
