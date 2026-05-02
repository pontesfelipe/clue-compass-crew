// Sync state legislators from OpenStates API
// Per invocation: processes a small batch of states (resumable via sync_progress.cursor_json)
// Free tier: ~6 req/min — handled by shared httpClient throttling

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { fetchJson, TimeBudget } from "../_shared/httpClient.ts";
import { STATE_JURISDICTIONS, normalizeParty, openStatesChamberToOurs } from "../_shared/states.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDER = "openstates";
const SYNC_ID = "sync-state-legislators";
const BASE_URL = "https://v3.openstates.org";

interface OSPerson {
  id: string; // ocd-person/uuid
  name: string;
  given_name?: string;
  family_name?: string;
  party?: string;
  current_role?: {
    title?: string;
    org_classification?: string;
    district?: string | number | null;
    division_id?: string;
  } | null;
  jurisdiction?: { id: string; name: string; classification?: string };
  email?: string;
  image?: string;
  openstates_url?: string;
  links?: Array<{ url: string; note?: string }>;
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

// OpenStates free tier: 10 req/min. Use 1 concurrency + 7s minimum between requests.
const OS_CONFIG = {
  maxConcurrency: 1,
  minDelayBetweenRequestsMs: 7000,
  maxRetries: 3,
  baseDelayMs: 8000,
  maxDelayMs: 60000,
};

async function fetchPeoplePage(
  apiKey: string,
  jurisdiction: string,
  page: number,
  budget: TimeBudget,
): Promise<{ results: OSPerson[]; pagination: { page: number; max_page: number; total_items: number } }> {
  const url = `${BASE_URL}/people?jurisdiction=${encodeURIComponent(jurisdiction)}&page=${page}&per_page=50&apikey=${apiKey}`;
  const { data } = await fetchJson<any>(url, {}, PROVIDER, OS_CONFIG, budget);
  return data;
}

async function processState(
  supabase: any,
  apiKey: string,
  state: { abbr: string; name: string; ocd: string },
  budget: TimeBudget,
  startPage = 1,
): Promise<{ upserted: number; nextPage: number | null; totalPages: number }> {
  let upserted = 0;
  let page = startPage;
  let maxPage = 1;

  while (budget.shouldContinue()) {
    const data = await fetchPeoplePage(apiKey, state.ocd, page, budget);
    maxPage = data.pagination?.max_page ?? 1;

    const rows = (data.results || [])
      .map((p) => {
        const role = p.current_role;
        const chamber = openStatesChamberToOurs(role?.org_classification);
        if (!chamber) return null; // skip if no current role / non-legislative
        const party = normalizeParty(p.party);
        const district = role?.district != null ? String(role.district) : null;
        const fullName = p.name;
        const firstName = p.given_name || fullName.split(" ")[0] || fullName;
        const lastName = p.family_name || fullName.split(" ").slice(-1)[0] || fullName;
        const websiteUrl = p.links?.[0]?.url || p.openstates_url || null;

        return {
          openstates_id: p.id,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          party,
          state: state.abbr,
          chamber,
          district,
          level: "state" as const,
          image_url: p.image || null,
          website_url: websiteUrl,
          in_office: true,
          state_district_chamber: chamber,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("members")
        .upsert(rows, { onConflict: "openstates_id" });
      if (error) {
        console.error(`Upsert error for ${state.abbr} page ${page}:`, error.message);
        throw new Error(`Upsert failed for ${state.abbr}: ${error.message}`);
      }
      upserted += rows.length;
    }

    if (page >= maxPage) {
      return { upserted, nextPage: null, totalPages: maxPage };
    }
    page++;
  }

  return { upserted, nextPage: page, totalPages: maxPage };
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
        JSON.stringify({ success: false, paused: true, message: "Syncs paused" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Optional: ?state=CA forces a single state; otherwise resume from cursor
    const url = new URL(req.url);
    const forcedState = url.searchParams.get("state");
    const maxDurationSeconds = Number(url.searchParams.get("budget") ?? "120");

    // Load cursor from sync_progress
    const { data: progress } = await supabase
      .from("sync_progress")
      .select("cursor_json, total_processed")
      .eq("id", SYNC_ID)
      .maybeSingle();

    const cursor = (progress?.cursor_json ?? {}) as { stateIndex?: number; page?: number };
    let stateIndex = forcedState
      ? STATE_JURISDICTIONS.findIndex((s) => s.abbr === forcedState.toUpperCase())
      : cursor.stateIndex ?? 0;
    let page = cursor.page ?? 1;

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
      console.log(`Processing ${state.abbr} from page ${page}`);
      try {
        const result = await processState(supabase, apiKey, state, budget, page);
        totalUpserted += result.upserted;
        statesProcessed.push(`${state.abbr}(${result.upserted})`);

        if (result.nextPage === null) {
          stateIndex++;
          page = 1;
        } else {
          page = result.nextPage;
          break; // budget exhausted mid-state
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`State ${state.abbr} failed:`, msg);
        statesProcessed.push(`${state.abbr}(ERR)`);
        // On rate limit / budget, stop and resume at this same state next call
        if (msg.includes("429") || msg.toLowerCase().includes("budget")) {
          break;
        }
        // Other errors: skip the state and advance
        stateIndex++;
        page = 1;
      }
    }

    const isComplete = stateIndex >= STATE_JURISDICTIONS.length;
    const newCursor = isComplete ? {} : { stateIndex, page };

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
        nextStateIndex: isComplete ? null : stateIndex,
        nextPage: isComplete ? null : page,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("sync-state-legislators error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
