import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { fetchWithRetry, TimeBudget, HttpClientConfig } from "../_shared/httpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDER = "senate_lda";
const DATASET = "lobbying_filings";
const JOB_BUDGET_SECONDS = 260;
// LDA public API: ~15 req/min. Enforce >=4.1s between calls in httpClient.
const LDA_HTTP_CONFIG: HttpClientConfig = {
  maxRetries: 4,
  baseDelayMs: 4000,
  maxConcurrency: 1,
  minDelayBetweenRequestsMs: 4100,
  timeoutMs: 60000,
};

async function getWatermark(supabase: any): Promise<{ lastCursor: any }> {
  const { data } = await supabase
    .from("sync_state")
    .select("last_cursor")
    .eq("provider", PROVIDER)
    .eq("dataset", DATASET)
    .eq("scope_key", "global")
    .maybeSingle();
  return { lastCursor: data?.last_cursor || null };
}

async function updateWatermark(supabase: any, cursor: any, recordsTotal: number, complete: boolean) {
  const payload: any = {
    provider: PROVIDER,
    dataset: DATASET,
    scope_key: "global",
    last_cursor: cursor,
    records_total: recordsTotal,
    updated_at: new Date().toISOString(),
  };
  if (complete) payload.last_success_at = new Date().toISOString();
  await supabase.from("sync_state").upsert(payload, { onConflict: "provider,dataset,scope_key" });
}


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LDA_API_BASE = "https://lda.senate.gov/api/v1";

// LDA Issue codes mapped to readable names
const ISSUE_CODE_MAP: Record<string, string> = {
  ACC: "Accounting",
  ADV: "Advertising",
  AER: "Aerospace",
  AGR: "Agriculture",
  ALC: "Alcohol & Drug Abuse",
  ANI: "Animals",
  APP: "Apparel/Clothing Industry",
  ART: "Arts/Entertainment",
  AUT: "Automotive Industry",
  AVI: "Aviation/Aircraft/Airlines",
  BAN: "Banking",
  BNK: "Bankruptcy",
  BEV: "Beverage Industry",
  BUD: "Budget/Appropriations",
  CAW: "Clean Air & Water",
  CDT: "Commodities (Big Ticket)",
  CHM: "Chemicals/Chemical Industry",
  CIV: "Civil Rights/Civil Liberties",
  COM: "Communications/Broadcasting/Radio/TV",
  CPI: "Computer Industry",
  CON: "Constitution",
  CSP: "Consumer Issues/Safety/Products",
  CPT: "Copyright/Patent/Trademark",
  DEF: "Defense",
  DIS: "Disaster Planning/Emergencies",
  DOC: "District of Columbia",
  ECN: "Economics/Economic Development",
  EDU: "Education",
  ENG: "Energy/Nuclear",
  ENV: "Environment/Superfund",
  FAM: "Family Issues/Abortion/Adoption",
  FIN: "Financial Institutions/Investments/Securities",
  FIR: "Firearms/Guns/Ammunition",
  FOO: "Food Industry (Safety, Labeling, etc.)",
  FOR: "Foreign Relations",
  FUE: "Fuel/Gas/Oil",
  GAM: "Gaming/Gambling/Casino",
  GOV: "Government Issues",
  HCR: "Health Issues",
  HOM: "Homeland Security",
  HOU: "Housing",
  IMM: "Immigration",
  IND: "Indian/Native American Affairs",
  INS: "Insurance",
  INT: "Intelligence and Surveillance",
  LAW: "Law Enforcement/Crime/Criminal Justice",
  LBR: "Labor Issues/Antitrust/Workplace",
  MAN: "Manufacturing",
  MAR: "Marine/Maritime/Boating/Fisheries",
  MED: "Medical/Disease Research/Clinical Labs",
  MIA: "Media (Information/Publishing)",
  MMM: "Medicare/Medicaid",
  MON: "Minting/Money/Gold Standard",
  NAT: "Natural Resources",
  PHA: "Pharmacy",
  POS: "Postal",
  RES: "Real Estate/Land Use/Conservation",
  RET: "Retirement",
  ROD: "Roads/Highway",
  RRR: "Railroads",
  SCI: "Science/Technology",
  SMB: "Small Business",
  SPO: "Sports/Athletics",
  TAR: "Tariff (Duties/Imports)",
  TAX: "Taxation/Internal Revenue Code",
  TEC: "Telecommunications",
  TOB: "Tobacco",
  TOR: "Torts",
  TOU: "Tourism & Travel",
  TRA: "Trade (Domestic & Foreign)",
  TRD: "Transportation",
  TRU: "Trucking/Shipping",
  UNM: "Unemployment",
  URB: "Urban Development/Municipalities",
  UTI: "Utilities",
  VET: "Veterans",
  WAS: "Waste (Hazardous/Solid/Interstate)",
  WEL: "Welfare",
};

interface LDAFiling {
  filing_uuid: string;
  filing_year: number;
  filing_period: string;
  income: string | null;
  expenses: string | null;
  registrant: {
    id: number;
    name: string;
  };
  client: {
    id: number;
    name: string;
  };
  lobbying_activities: Array<{
    general_issue_code: string;
    general_issue_code_display: string;
    description: string;
  }>;
}

interface LDAResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LDAFiling[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const budget = new TimeBudget(JOB_BUDGET_SECONDS);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("Starting Senate LDA lobbying sync...");

  try {
    // Check if sync is paused
    const { data: pauseToggle } = await supabase
      .from("feature_toggles")
      .select("enabled")
      .eq("id", "sync_paused")
      .single();

    if (pauseToggle?.enabled) {
      console.log("Sync is paused globally");
      return new Response(JSON.stringify({ success: true, message: "Sync paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cursor: { year, nextUrl } — resumable across invocations.
    // Previously hard-capped at 10 pages/year with no cursor: every run
    // restarted from page 1 and only saw the first 250 filings.
    const currentYear = new Date().getFullYear();
    const { lastCursor } = await getWatermark(supabase);
    let year: number = lastCursor?.year || currentYear;
    let nextUrl: string | null = lastCursor?.nextUrl ||
      `${LDA_API_BASE}/filings/?filing_year=${year}&filing_type=Q1&filing_type=Q2&filing_type=Q3&filing_type=Q4`;

    // Aggregate lobbying spending by issue (resets per invocation — the
    // upsert-then-cleanup at the end merges with previously-synced data).
    const issueSpending: Record<string, { total: number; clientCount: number; clients: Set<string> }> = {};
    let totalFilings = 0;
    let totalPages = 0;
    let partial = false;

    while (nextUrl) {
      if (!budget.shouldContinue()) {
        console.log(`Time budget expired at page ${totalPages}, marking as partial`);
        partial = true;
        break;
      }

      console.log(`Fetching page ${totalPages + 1} for year ${year}...`);
      const { response } = await fetchWithRetry(nextUrl, {}, PROVIDER, LDA_HTTP_CONFIG, budget);
      if (!response.ok) {
        console.error(`LDA API error: ${response.status}`);
        break;
      }

      const data: LDAResponse = await response.json();
      totalPages++;

      for (const filing of data.results) {
        totalFilings++;

        const incomeStr = filing.income || "0";
        const expensesStr = filing.expenses || "0";
        const parseAmount = (str: string): number => {
          const match = str.replace(/[$,]/g, "").match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        const amount = parseAmount(incomeStr) || parseAmount(expensesStr);

        for (const activity of filing.lobbying_activities) {
          const issueCode = activity.general_issue_code;
          const issueName = ISSUE_CODE_MAP[issueCode] || activity.general_issue_code_display || issueCode;
          if (!issueSpending[issueName]) {
            issueSpending[issueName] = { total: 0, clientCount: 0, clients: new Set() };
          }
          const amountPerIssue = amount / filing.lobbying_activities.length;
          issueSpending[issueName].total += amountPerIssue;
          issueSpending[issueName].clients.add(filing.client.name);
        }
      }

      nextUrl = data.next;

      // If we've finished the current year, advance to the previous year (bounded).
      if (!nextUrl && year > currentYear - 2) {
        year -= 1;
        nextUrl = `${LDA_API_BASE}/filings/?filing_year=${year}&filing_type=Q1&filing_type=Q2&filing_type=Q3&filing_type=Q4`;
      }
    }

    // Persist cursor so the next invocation resumes where we left off.
    await updateWatermark(supabase, partial ? { year, nextUrl } : null, totalFilings, !partial);

    
    // Convert to array and sort by spending
    const lobbyingByIndustry = Object.entries(issueSpending)
      .map(([industry, data]) => ({
        industry,
        totalSpent: Math.round(data.total),
        clientCount: data.clients.size,
      }))
      .filter(item => item.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 50); // Top 50 industries
    
    console.log(`Processed ${totalFilings} filings, found ${lobbyingByIndustry.length} industries`);
    
    // Get all members to distribute lobbying context
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id")
      .eq("in_office", true);
    
    if (membersError) throw membersError;
    
    // For now, store aggregate lobbying data at the platform level
    // Each member gets the same industry lobbying context (this shows what industries are lobbying Congress)
    const lobbyingRecords: Array<{
      member_id: string;
      industry: string;
      total_spent: number;
      client_count: number;
      cycle: number;
    }> = [];
    
    // Store top 10 industries for each member as context
    const topIndustries = lobbyingByIndustry.slice(0, 10);
    
    for (const member of members || []) {
      for (const industry of topIndustries) {
        lobbyingRecords.push({
          member_id: member.id,
          industry: industry.industry,
          total_spent: industry.totalSpent,
          client_count: industry.clientCount,
          cycle: currentYear,
        });
      }
    }
    
    // Upsert first, then delete stale rows — avoids an empty-table window for
    // any reader hitting member_lobbying mid-sync. Requires the
    // (member_id, industry, cycle) unique constraint added in migration.
    if (lobbyingRecords.length > 0) {
      const batchSize = 500;
      let upserted = 0;

      for (let i = 0; i < lobbyingRecords.length; i += batchSize) {
        const batch = lobbyingRecords.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from("member_lobbying")
          .upsert(batch, { onConflict: "member_id,industry,cycle" });

        if (upsertError) {
          console.error(`Upsert batch error: ${upsertError.message}`);
        } else {
          upserted += batch.length;
        }
      }

      // Remove any industries from this cycle that are no longer in the top set.
      const currentIndustries = Array.from(new Set(topIndustries.map((i) => i.industry)));
      if (currentIndustries.length > 0) {
        const { error: cleanupError } = await supabase
          .from("member_lobbying")
          .delete()
          .eq("cycle", currentYear)
          .not("industry", "in", `(${currentIndustries.map((s) => `"${s.replace(/"/g, '""')}"`).join(",")})`);
        if (cleanupError) {
          console.error(`Cleanup stale industries error: ${cleanupError.message}`);
        }
      }

      console.log(`Upserted ${upserted} lobbying records`);
    }
    
    // Update sync progress
    const duration = Date.now() - startTime;
    await supabase.from("sync_progress").upsert({
      id: "sync-lobbying",
      status: "success",
      last_run_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      total_processed: totalFilings,
      last_success_count: lobbyingByIndustry.length,
      metadata: {
        pages_fetched: totalPages,
        industries_found: lobbyingByIndustry.length,
        records_inserted: lobbyingRecords.length,
        duration_ms: duration,
      },
    });
    
    // Log sync run
    await supabase.from("sync_job_runs").insert({
      job_id: "sync-lobbying",
      job_type: "sync-lobbying",
      provider: "senate-lda",
      status: "succeeded",
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      records_fetched: totalFilings,
      records_upserted: lobbyingRecords.length,
      metadata: {
        years: years,
        top_industries: lobbyingByIndustry.slice(0, 5).map(i => i.industry),
      },
    });
    
    return new Response(JSON.stringify({
      success: true,
      filings_processed: totalFilings,
      industries_found: lobbyingByIndustry.length,
      records_inserted: lobbyingRecords.length,
      top_industries: lobbyingByIndustry.slice(0, 5),
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Sync error:", error);
    
    // Log failure
    await supabase.from("sync_job_runs").insert({
      job_id: "sync-lobbying",
      job_type: "sync-lobbying",
      provider: "senate-lda",
      status: "failed",
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
