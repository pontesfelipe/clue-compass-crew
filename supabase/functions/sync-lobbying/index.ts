import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function fetchWithRateLimit(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
      console.log(`Rate limited, waiting ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
  throw new Error(`Failed to fetch after ${retries} retries`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
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

    // Get current year for filtering
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1]; // Current year and previous year
    
    // Aggregate lobbying spending by issue
    const issueSpending: Record<string, { total: number; clientCount: number; clients: Set<string> }> = {};
    
    let totalFilings = 0;
    let totalPages = 0;
    const maxPages = 10; // Limit to prevent timeout (25 results per page = 250 filings)
    
    for (const year of years) {
      let nextUrl: string | null = `${LDA_API_BASE}/filings/?filing_year=${year}&filing_type=Q1&filing_type=Q2&filing_type=Q3&filing_type=Q4`;
      let pageCount = 0;
      
      while (nextUrl && pageCount < maxPages) {
        console.log(`Fetching page ${pageCount + 1} for year ${year}...`);
        
        const response = await fetchWithRateLimit(nextUrl);
        if (!response.ok) {
          console.error(`LDA API error: ${response.status}`);
          break;
        }
        
        const data: LDAResponse = await response.json();
        totalPages++;
        pageCount++;
        
        for (const filing of data.results) {
          totalFilings++;
          
          // Parse income/expenses (they come as strings like "$50,000" or ranges)
          const incomeStr = filing.income || "0";
          const expensesStr = filing.expenses || "0";
          
          // Extract numeric value (handle ranges like "$10,000 - $20,000")
          const parseAmount = (str: string): number => {
            const match = str.replace(/[$,]/g, "").match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          };
          
          const amount = parseAmount(incomeStr) || parseAmount(expensesStr);
          
          // Aggregate by lobbying issue codes
          for (const activity of filing.lobbying_activities) {
            const issueCode = activity.general_issue_code;
            const issueName = ISSUE_CODE_MAP[issueCode] || activity.general_issue_code_display || issueCode;
            
            if (!issueSpending[issueName]) {
              issueSpending[issueName] = { total: 0, clientCount: 0, clients: new Set() };
            }
            
            // Distribute amount evenly across issues if filing covers multiple
            const amountPerIssue = amount / filing.lobbying_activities.length;
            issueSpending[issueName].total += amountPerIssue;
            issueSpending[issueName].clients.add(filing.client.name);
          }
        }
        
        nextUrl = data.next;
        
        // Small delay to respect rate limits (15/minute = 4 seconds between requests)
        await new Promise(resolve => setTimeout(resolve, 4100));
      }
    }
    
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
    
    // Clear old lobbying data and insert new
    if (lobbyingRecords.length > 0) {
      // Delete existing data for current cycle
      await supabase
        .from("member_lobbying")
        .delete()
        .eq("cycle", currentYear);
      
      // Insert in batches
      const batchSize = 500;
      let inserted = 0;
      
      for (let i = 0; i < lobbyingRecords.length; i += batchSize) {
        const batch = lobbyingRecords.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("member_lobbying")
          .insert(batch);
        
        if (insertError) {
          console.error(`Insert batch error: ${insertError.message}`);
        } else {
          inserted += batch.length;
        }
      }
      
      console.log(`Inserted ${inserted} lobbying records`);
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
