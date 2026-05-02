// Sync state votes from OpenStates API
// Strategy: walk recently-updated state bills, fetch each bill's detail (includes votes),
// upsert vote + per-member positions. Resumable via cursor (last bill id processed).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { fetchJson, TimeBudget } from "../_shared/httpClient.ts";
import { openStatesChamberToOurs } from "../_shared/states.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDER = "openstates";
const SYNC_ID = "sync-state-votes";
const BASE_URL = "https://v3.openstates.org";

interface OSVoteEvent {
  id: string;
  motion_text?: string;
  motion_classification?: string[];
  start_date: string;
  result?: string;
  organization?: { classification?: string };
  counts?: Array<{ option: string; value: number }>;
  votes?: Array<{ option: string; voter_name: string; voter?: { id?: string } | null }>;
}

interface OSBillDetail {
  id: string;
  identifier: string;
  jurisdiction?: { name: string };
  from_organization?: { classification?: string };
  votes?: OSVoteEvent[];
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

function normalizePosition(opt: string): "yea" | "nay" | "present" | "not_voting" {
  const o = opt.toLowerCase();
  if (o.startsWith("yes") || o === "yea" || o === "aye") return "yea";
  if (o.startsWith("no") || o === "nay") return "nay";
  if (o === "absent" || o.includes("not vot") || o === "excused") return "not_voting";
  return "present";
}

function tallyCounts(counts?: Array<{ option: string; value: number }>) {
  let yea = 0, nay = 0, present = 0, not_voting = 0;
  for (const c of counts ?? []) {
    const pos = normalizePosition(c.option);
    if (pos === "yea") yea += c.value;
    else if (pos === "nay") nay += c.value;
    else if (pos === "present") present += c.value;
    else not_voting += c.value;
  }
  return { yea, nay, present, not_voting };
}

async function processOneBill(
  supabase: any,
  apiKey: string,
  billRow: { id: string; openstates_id: string; state: string },
  budget: TimeBudget,
): Promise<{ votesUpserted: number; memberVotesUpserted: number }> {
  const url = `${BASE_URL}/bills/${encodeURIComponent(billRow.openstates_id)}?include=votes&apikey=${apiKey}`;
  const detail = await fetchJson<OSBillDetail>(url, {}, PROVIDER, {}, budget);

  if (!detail.votes || detail.votes.length === 0) {
    return { votesUpserted: 0, memberVotesUpserted: 0 };
  }

  let votesUpserted = 0;
  let memberVotesUpserted = 0;

  for (const ve of detail.votes) {
    const chamber = openStatesChamberToOurs(ve.organization?.classification);
    if (!chamber) continue;
    const counts = tallyCounts(ve.counts);

    // Upsert vote row
    const voteRow = {
      openstates_vote_id: ve.id,
      level: "state" as const,
      chamber,
      vote_date: ve.start_date.slice(0, 10),
      question: ve.motion_classification?.[0] || null,
      description: ve.motion_text || null,
      result: ve.result || null,
      total_yea: counts.yea,
      total_nay: counts.nay,
      total_present: counts.present,
      total_not_voting: counts.not_voting,
      bill_id: billRow.id,
    };

    const { data: upserted, error: voteErr } = await supabase
      .from("votes")
      .upsert(voteRow, { onConflict: "openstates_vote_id" })
      .select("id")
      .single();

    if (voteErr || !upserted) {
      console.error("Vote upsert failed:", voteErr?.message);
      continue;
    }
    votesUpserted++;

    // Resolve member ids by openstates_id (voter.id when available)
    const voterIds = (ve.votes ?? [])
      .map((v) => v.voter?.id)
      .filter((x): x is string => !!x);

    if (voterIds.length === 0) continue;

    const { data: members } = await supabase
      .from("members")
      .select("id, openstates_id")
      .in("openstates_id", voterIds);

    const memberMap = new Map<string, string>();
    for (const m of members ?? []) {
      if (m.openstates_id) memberMap.set(m.openstates_id, m.id);
    }

    const mvRows = (ve.votes ?? [])
      .map((v) => {
        const memberId = v.voter?.id ? memberMap.get(v.voter.id) : null;
        if (!memberId) return null;
        const position = normalizePosition(v.option);
        return {
          member_id: memberId,
          vote_id: upserted.id,
          position,
          position_normalized: position,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (mvRows.length > 0) {
      const { error: mvErr } = await supabase
        .from("member_votes")
        .upsert(mvRows, { onConflict: "member_id,vote_id" });
      if (mvErr) {
        console.error("member_votes upsert failed:", mvErr.message);
      } else {
        memberVotesUpserted += mvRows.length;
      }
    }
  }

  return { votesUpserted, memberVotesUpserted };
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
    const maxDurationSeconds = Number(url.searchParams.get("budget") ?? "120");
    const batchSize = Number(url.searchParams.get("limit") ?? "20");

    const { data: progress } = await supabase
      .from("sync_progress")
      .select("cursor_json, total_processed")
      .eq("id", SYNC_ID)
      .maybeSingle();

    const cursor = (progress?.cursor_json ?? {}) as { lastBillUpdatedAt?: string };
    const lastUpdated = cursor.lastBillUpdatedAt ?? "1970-01-01T00:00:00Z";

    // Pull a batch of state bills updated since cursor, oldest first so cursor advances monotonically
    const { data: bills, error: billsErr } = await supabase
      .from("bills")
      .select("id, openstates_id, state, updated_at")
      .eq("level", "state")
      .not("openstates_id", "is", null)
      .gt("updated_at", lastUpdated)
      .order("updated_at", { ascending: true })
      .limit(batchSize);

    if (billsErr) throw new Error(`Failed to load bills: ${billsErr.message}`);

    if (!bills || bills.length === 0) {
      await supabase.from("sync_progress").upsert(
        {
          id: SYNC_ID,
          status: "complete",
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      return new Response(
        JSON.stringify({ success: true, message: "No bills to process", upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const budget = new TimeBudget(maxDurationSeconds);
    let totalVotes = 0;
    let totalMemberVotes = 0;
    let lastProcessed: string | null = null;

    await supabase.from("sync_progress").upsert(
      { id: SYNC_ID, status: "running", last_run_at: new Date().toISOString() },
      { onConflict: "id" },
    );

    for (const b of bills) {
      if (!budget.shouldContinue()) break;
      try {
        const r = await processOneBill(supabase, apiKey, b, budget);
        totalVotes += r.votesUpserted;
        totalMemberVotes += r.memberVotesUpserted;
        lastProcessed = b.updated_at as unknown as string;
      } catch (err) {
        console.error(`Bill ${b.openstates_id} failed:`, err);
        // Continue with next bill; don't advance cursor past the failed one
        break;
      }
    }

    const newCursor = lastProcessed
      ? { lastBillUpdatedAt: lastProcessed }
      : cursor;

    await supabase.from("sync_progress").upsert(
      {
        id: SYNC_ID,
        status: "partial",
        cursor_json: newCursor,
        last_synced_at: new Date().toISOString(),
        last_success_count: totalVotes,
        total_processed: (progress?.total_processed ?? 0) + totalVotes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    return new Response(
      JSON.stringify({
        success: true,
        billsProcessed: bills.length,
        votesUpserted: totalVotes,
        memberVotesUpserted: totalMemberVotes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("sync-state-votes error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
