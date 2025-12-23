import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry, HttpClientConfig, TimeBudget } from "../_shared/httpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDER = "congress";
const CONGRESS_API_BASE = "https://api.congress.gov/v3";

const HTTP_CONFIG: HttpClientConfig = {
  maxRetries: 4,
  baseDelayMs: 1200,
  maxConcurrency: 2,
  minDelayBetweenRequestsMs: 250,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBillType(type: unknown): string | null {
  if (!type) return null;
  const s = String(type).trim().toLowerCase();
  // Congress API returns bill types like 'HR', 'S', 'HJRES', etc.
  const allowed = new Set(["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"]);
  return allowed.has(s) ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  const congressApiKey = Deno.env.get("CONGRESS_GOV_API_KEY");
  if (!congressApiKey) {
    return jsonResponse({ success: false, error: "CONGRESS_GOV_API_KEY is not configured" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const budget = new TimeBudget(25); // keep some headroom

  let memberId: string | null = null;
  let limit = 25;

  try {
    const body = await req.json();
    memberId = body?.memberId ? String(body.memberId) : null;
    limit = Number(body?.limit ?? 25);
  } catch {
    // ignore
  }

  if (!memberId) return jsonResponse({ success: false, error: "memberId is required" }, 400);
  if (!Number.isFinite(limit) || limit <= 0) limit = 25;
  limit = Math.min(limit, 50);

  console.log(`[backfill-member-sponsored-bills] start memberId=${memberId} limit=${limit}`);

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id, bioguide_id, full_name")
    .eq("id", memberId)
    .maybeSingle();

  if (memberErr) {
    console.error("[backfill-member-sponsored-bills] member lookup error", memberErr);
    return jsonResponse({ success: false, error: memberErr.message }, 500);
  }

  if (!member) return jsonResponse({ success: false, error: "Member not found" }, 404);

  const bioguideId = member.bioguide_id as string;

  // 1) Fetch sponsored legislation list
  const listUrl = `${CONGRESS_API_BASE}/member/${bioguideId}/sponsored-legislation?api_key=${congressApiKey}&limit=${limit}&format=json`;
  const { response: listResp } = await fetchWithRetry(listUrl, {}, PROVIDER, HTTP_CONFIG, budget);

  if (!listResp.ok) {
    const text = await listResp.text().catch(() => "");
    console.error("[backfill-member-sponsored-bills] list fetch failed", listResp.status, text);
    return jsonResponse({ success: false, error: `Failed to fetch sponsored bills (${listResp.status})` }, 502);
  }

  const listJson = await listResp.json();
  const sponsored = (listJson?.sponsoredLegislation || []) as any[];

  if (!Array.isArray(sponsored) || sponsored.length === 0) {
    return jsonResponse({ success: true, message: "No sponsored bills returned by provider", billsProcessed: 0, sponsorshipsUpserted: 0 });
  }

  let billsProcessed = 0;
  let sponsorshipsUpserted = 0;

  for (const item of sponsored) {
    if (!budget.shouldContinue()) break;

    const congress = Number(item?.congress);
    const billType = normalizeBillType(item?.type);
    const billNumber = Number(item?.number);

    if (!congress || !billType || !billNumber) continue;

    const detailUrl = `${CONGRESS_API_BASE}/bill/${congress}/${billType}/${billNumber}?format=json&api_key=${congressApiKey}`;
    const { response: detailResp } = await fetchWithRetry(detailUrl, {}, PROVIDER, HTTP_CONFIG, budget);
    if (!detailResp.ok) continue;

    const detailJson = await detailResp.json();
    const billDetail = detailJson?.bill;
    if (!billDetail) continue;

    const billRecord = {
      congress,
      bill_type: billType,
      bill_number: billNumber,
      title: billDetail.title || item?.title || "Untitled",
      short_title: billDetail.shortTitle || null,
      introduced_date: billDetail.introducedDate || item?.introducedDate || null,
      latest_action_date: billDetail.latestAction?.actionDate || null,
      latest_action_text: billDetail.latestAction?.text || null,
      policy_area: billDetail.policyArea?.name || item?.policyArea?.name || null,
      subjects: billDetail.subjects?.legislativeSubjects?.map((s: any) => s.name) || null,
      url: item?.url || null,
      enacted: Array.isArray(billDetail.laws) && billDetail.laws.length > 0,
      enacted_date: billDetail.laws?.[0]?.date || null,
      summary: null,
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedBill, error: billErr } = await supabase
      .from("bills")
      .upsert(billRecord, { onConflict: "congress,bill_type,bill_number", ignoreDuplicates: false })
      .select("id")
      .maybeSingle();

    if (billErr || !upsertedBill?.id) continue;

    const { error: sponsorErr } = await supabase
      .from("bill_sponsorships")
      .upsert(
        {
          bill_id: upsertedBill.id,
          member_id: memberId,
          is_sponsor: true,
          is_original_cosponsor: false,
          cosponsored_date: billRecord.introduced_date,
        },
        { onConflict: "bill_id,member_id", ignoreDuplicates: false },
      );

    if (!sponsorErr) sponsorshipsUpserted++;
    billsProcessed++;
  }

  console.log(
    `[backfill-member-sponsored-bills] done member=${member.full_name} bioguide=${bioguideId} billsProcessed=${billsProcessed} sponsorshipsUpserted=${sponsorshipsUpserted}`,
  );

  return jsonResponse({
    success: true,
    member: { id: memberId, name: member.full_name, bioguideId },
    billsProcessed,
    sponsorshipsUpserted,
  });
});
