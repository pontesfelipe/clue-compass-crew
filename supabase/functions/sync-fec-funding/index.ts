import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEC_API_BASE = "https://api.open.fec.gov/v1";

// FEC cycles are even-numbered election years. Use a rolling window that includes:
// - Past cycles for historical data
// - Current cycle for House members and some Senators  
// - NEXT cycle for Senators not up until 2026/2028 (they file under future cycle)
const CURRENT_CYCLE = (() => {
  const year = new Date().getUTCFullYear();
  return year % 2 === 0 ? year : year + 1;
})();

// Include next cycle (+2) for Senators fundraising for 2026/2028
// Go back further in history for complete financial picture
const CYCLES = [CURRENT_CYCLE + 2, CURRENT_CYCLE, CURRENT_CYCLE - 2, CURRENT_CYCLE - 4, CURRENT_CYCLE - 6, CURRENT_CYCLE - 8];
const BATCH_SIZE = 8; // Smaller batch to allow more API calls per member

// State name to abbreviation mapping
const STATE_ABBREVS: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
  "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
  "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
  "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
  "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
  "Puerto Rico": "PR", "Guam": "GU", "American Samoa": "AS",
"U.S. Virgin Islands": "VI", "Northern Mariana Islands": "MP"
};

// Common political nicknames -> legal first names mapping
const NICKNAME_MAP: Record<string, string[]> = {
  'ted': ['rafael', 'edward', 'theodore'],
  'bernie': ['bernard'],
  'chuck': ['charles'],
  'mike': ['michael'],
  'bill': ['william'],
  'bob': ['robert'],
  'dick': ['richard'],
  'jim': ['james'],
  'joe': ['joseph'],
  'tom': ['thomas'],
  'dan': ['daniel'],
  'dave': ['david'],
  'ben': ['benjamin'],
  'ed': ['edward', 'edwin'],
  'al': ['albert', 'alan', 'alfred'],
  'pete': ['peter'],
  'tim': ['timothy'],
  'matt': ['matthew'],
  'rick': ['richard', 'eric', 'frederick'],
  'ron': ['ronald'],
  'don': ['donald'],
  'andy': ['andrew'],
  'tony': ['anthony'],
  'steve': ['steven', 'stephen'],
  'chris': ['christopher', 'christian'],
  'nick': ['nicholas'],
  'pat': ['patrick', 'patricia'],
  'ken': ['kenneth'],
  'larry': ['lawrence'],
  'jerry': ['gerald', 'jerome'],
  'jeff': ['jeffrey'],
  'greg': ['gregory'],
  'sam': ['samuel'],
  'max': ['maxwell', 'maximilian'],
  'jack': ['john', 'jackson'],
  'marty': ['martin'],
  'mitch': ['mitchell'],
  'josh': ['joshua'],
  'will': ['william'],
  'charlie': ['charles'],
  'liz': ['elizabeth'],
  'beth': ['elizabeth'],
  'debbie': ['deborah'],
  'deborah': ['debbie'],
  'nancy': ['ann'],
  'sue': ['susan'],
  'cathy': ['catherine'],
  'kate': ['katherine', 'catherine'],
  'maggie': ['margaret'],
  'meg': ['margaret'],
};

function getStateAbbrev(stateName: string): string {
  // If already an abbreviation, return as-is
  if (stateName.length === 2) return stateName.toUpperCase();
  return STATE_ABBREVS[stateName] || stateName;
}

// Get possible search names (original + nickname variants)
function getSearchNames(fullName: string): string[] {
  const names = [fullName];
  const nameParts = fullName.split(',');
  const lastName = nameParts[0]?.trim() || '';
  const firstName = nameParts[1]?.trim()?.split(' ')[0]?.toLowerCase() || '';
  
  // Add nickname variants
  if (NICKNAME_MAP[firstName]) {
    for (const legalName of NICKNAME_MAP[firstName]) {
      names.push(`${lastName}, ${legalName.charAt(0).toUpperCase() + legalName.slice(1)}`);
    }
  }
  // Also check reverse - if member uses legal name but FEC has nickname
  for (const [nickname, legalNames] of Object.entries(NICKNAME_MAP)) {
    if (legalNames.includes(firstName)) {
      names.push(`${lastName}, ${nickname.charAt(0).toUpperCase() + nickname.slice(1)}`);
    }
  }
  
  return names;
}

interface FundingMetrics {
  totalReceipts: number;
  fromIndividuals: number;
  fromCommittees: number;
  itemizedIndividualAmount: number;
  inStateAmount: number;
  outOfStateAmount: number;
  smallDonorAmount: number;
}

interface ProcessingStats {
  membersProcessed: number;
  membersWithData: number;
  totalMetricsUpserted: number;
  apiCallsMade: number;
  errors: string[];
}

// Generic FEC API helper with pagination and better error handling
// Now fetches ALL pages to ensure complete data
async function fecGet(
  path: string, 
  params: Record<string, string | number>, 
  apiKey: string,
  stats: ProcessingStats,
  maxResults: number = 10000 // Increased from 500 to capture all data
): Promise<any[]> {
  const results: any[] = [];
  let page = 1;
  const perPage = 100;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;
  
  while (true) {
    const url = new URL(`${FEC_API_BASE}${path}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    
    try {
      stats.apiCallsMade++;
      const response = await fetch(url.toString());
      
      if (response.status === 429) {
        console.log(`Rate limited on ${path}, waiting 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.log(`Too many rate limits, stopping pagination for ${path}`);
          break;
        }
        continue; // Retry same page
      }
      
      if (!response.ok) {
        console.error(`FEC API error: ${response.status} for ${path}`);
        stats.errors.push(`API ${response.status} for ${path}`);
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) break;
        continue;
      }
      
      consecutiveErrors = 0; // Reset on success
      const data = await response.json();
      if (!data.results || data.results.length === 0) break;
      
      results.push(...data.results);
      
      // Check if we've fetched all pages
      if (data.pagination?.pages && page >= data.pagination.pages) break;
      if (results.length >= maxResults) {
        console.log(`Reached max results (${maxResults}) for ${path}`);
        break;
      }
      
      page++;
      
      // Small delay between pages to avoid rate limiting
      if (page % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`FEC API fetch error for ${path}:`, error);
      stats.errors.push(`Fetch error for ${path}: ${error}`);
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) break;
    }
  }
  
  return results;
}

// Get candidate by name and state - try multiple strategies including nicknames
async function findCandidateId(
  name: string, 
  state: string, 
  apiKey: string,
  stats: ProcessingStats
): Promise<string | null> {
  const stateAbbrev = getStateAbbrev(state);
  const searchNames = getSearchNames(name);
  
  // Try each name variant (original + nickname variants)
  for (const searchName of searchNames) {
    // Strategy 1: Search by full name
    let results = await fecGet("/candidates/search/", {
      name: searchName,
      state: stateAbbrev,
      is_active_candidate: "true",
      sort: "-election_years",
    }, apiKey, stats);
    
    if (results.length > 0) {
      console.log(`Found candidate ${name} via full name search (tried: ${searchName}): ${results[0].candidate_id}`);
      return results[0].candidate_id;
    }
    
    // Strategy 2: Try last name only
    const lastName = searchName.split(",")[0]?.trim() || searchName.split(" ").pop() || searchName;
    results = await fecGet("/candidates/search/", {
      name: lastName,
      state: stateAbbrev,
      is_active_candidate: "true",
      sort: "-election_years",
    }, apiKey, stats);
    
    if (results.length > 0) {
      console.log(`Found candidate ${name} via last name search: ${results[0].candidate_id}`);
      return results[0].candidate_id;
    }
    
    // Strategy 3: Try without active filter for former candidates
    results = await fecGet("/candidates/search/", {
      name: lastName,
      state: stateAbbrev,
      sort: "-election_years",
    }, apiKey, stats);
    
    if (results.length > 0) {
      console.log(`Found candidate ${name} via inactive search: ${results[0].candidate_id}`);
      return results[0].candidate_id;
    }
  }
  
  console.log(`No FEC candidate found for ${name} in ${stateAbbrev} (tried ${searchNames.length} name variants)`);
  return null;
}

// Get candidate's committees - CRITICAL: This is where money flows
async function getCandidateCommittees(
  candidateId: string, 
  apiKey: string,
  stats: ProcessingStats
): Promise<string[]> {
  // Get all committee designations, not just P,A
  const results = await fecGet(`/candidate/${candidateId}/committees/`, {}, apiKey, stats);
  
  const committeeIds = results.map((c: any) => c.committee_id);
  console.log(`Found ${committeeIds.length} committees for candidate ${candidateId}`);
  
  return committeeIds;
}

// Get CANDIDATE financial totals (aggregates all committees - much more reliable)
async function getCandidateTotals(
  candidateId: string, 
  cycle: number, 
  apiKey: string,
  stats: ProcessingStats
): Promise<any | null> {
  const results = await fecGet(`/candidate/${candidateId}/totals/`, {
    cycle: cycle,
  }, apiKey, stats);
  
  return results[0] || null;
}

// Get committee financial totals - try multiple cycles if needed (kept as fallback)
async function getCommitteeTotals(
  committeeId: string, 
  cycle: number, 
  apiKey: string,
  stats: ProcessingStats
): Promise<any | null> {
  const results = await fecGet(`/committee/${committeeId}/totals/`, {
    cycle: cycle,
  }, apiKey, stats);
  
  return results[0] || null;
}

// Get itemized individual contributions with state info
async function getCommitteeContributionsByState(
  committeeId: string, 
  cycle: number, 
  memberState: string,
  apiKey: string,
  stats: ProcessingStats
): Promise<{ inState: number; outOfState: number; itemizedTotal: number }> {
  const results = await fecGet("/schedules/schedule_a/by_state/", {
    committee_id: committeeId,
    cycle: cycle,
  }, apiKey, stats);
  
  let inState = 0;
  let outOfState = 0;
  let itemizedTotal = 0;
  
  for (const result of results) {
    const amount = result.total || 0;
    itemizedTotal += amount;
    
    if (result.state === memberState) {
      inState += amount;
    } else {
      outOfState += amount;
    }
  }
  
  return { inState, outOfState, itemizedTotal };
}

// Calculate derived scores
function calculateScores(metrics: {
  pctFromIndividuals: number | null;
  pctFromSmallDonors: number | null;
  pctFromInState: number | null;
  pctFromCommittees: number | null;
}) {
  const toScore = (value: number | null, fallback: number) => 
    value == null ? fallback : value;

  const individualScore = toScore(metrics.pctFromIndividuals, 50);
  const smallDonorScore = toScore(metrics.pctFromSmallDonors, 50);
  const localScore = toScore(metrics.pctFromInState, 50);

  const grassrootsSupportScore = Math.round(
    0.4 * individualScore +
    0.3 * smallDonorScore +
    0.3 * localScore
  );

  const pacDependenceScore = Math.round(
    metrics.pctFromCommittees == null ? 50 : metrics.pctFromCommittees
  );

  const localMoneyScore = Math.round(
    metrics.pctFromInState == null ? 50 : metrics.pctFromInState
  );

  return {
    grassrootsSupportScore,
    pacDependenceScore,
    localMoneyScore,
  };
}

// Process a single member for all cycles
async function processMember(
  supabase: any,
  member: any,
  apiKey: string,
  stats: ProcessingStats
): Promise<{ success: boolean; cyclesProcessed: number; reason?: string }> {
  let fecCandidateId = member.fec_candidate_id;
  let fecCommitteeIds = member.fec_committee_ids || [];
  const stateAbbrev = getStateAbbrev(member.state);
  
  console.log(`Processing ${member.full_name} (${stateAbbrev}), FEC ID: ${fecCandidateId || 'none'}, Committees: ${fecCommitteeIds.length}`);
  
  // Step 1: Find FEC candidate ID if not stored
  if (!fecCandidateId) {
    fecCandidateId = await findCandidateId(member.full_name, stateAbbrev, apiKey, stats);
    
    if (!fecCandidateId) {
      return { 
        success: false, 
        cyclesProcessed: 0, 
        reason: `No FEC candidate found for ${member.full_name}` 
      };
    }
    
    // Store the candidate ID immediately
    const { error: updateError } = await supabase
      .from("members")
      .update({ fec_candidate_id: fecCandidateId })
      .eq("id", member.id);
    
    if (updateError) {
      console.error(`Failed to store FEC candidate ID for ${member.full_name}:`, updateError);
    } else {
      console.log(`Stored FEC candidate ID ${fecCandidateId} for ${member.full_name}`);
    }
  }
  
  // Step 2: Get committees (CRITICAL - this is where money flows)
  if (fecCommitteeIds.length === 0) {
    fecCommitteeIds = await getCandidateCommittees(fecCandidateId, apiKey, stats);
    
    if (fecCommitteeIds.length === 0) {
      // Don't fail completely - mark as unavailable, not zero
      console.log(`No committees found for ${member.full_name} (${fecCandidateId})`);
      
      // Update the member to show we tried but found nothing
      await supabase
        .from("members")
        .update({ 
          fec_committee_ids: [], 
          fec_last_synced_at: new Date().toISOString() 
        })
        .eq("id", member.id);
      
      return { 
        success: false, 
        cyclesProcessed: 0, 
        reason: `No committees found for candidate ${fecCandidateId}` 
      };
    }
    
    // Store the committee IDs immediately
    const { error: updateError } = await supabase
      .from("members")
      .update({ fec_committee_ids: fecCommitteeIds })
      .eq("id", member.id);
    
    if (updateError) {
      console.error(`Failed to store committee IDs for ${member.full_name}:`, updateError);
    } else {
      console.log(`Stored ${fecCommitteeIds.length} committee IDs for ${member.full_name}`);
    }
  }
  
  // Step 3: Process each cycle - try all cycles, use most recent with data
  let cyclesProcessed = 0;
  let foundDataInAnyCycle = false;
  
  // Process cycles in reverse order (newest first) for efficiency
  const sortedCycles = [...CYCLES].sort((a, b) => b - a);
  
  for (const cycle of sortedCycles) {
    let totalReceipts = 0;
    let fromIndividuals = 0;
    let fromCommittees = 0;
    let inStateAmount = 0;
    let outOfStateAmount = 0;
    let itemizedTotal = 0;
    
    const primaryCommittee = fecCommitteeIds.length > 0 ? fecCommitteeIds[0] : null;

    // Use CANDIDATE TOTALS endpoint - much more efficient and reliable
    const candidateTotals = await getCandidateTotals(fecCandidateId, cycle, apiKey, stats);

    if (candidateTotals) {
      totalReceipts = candidateTotals.receipts || 0;
      fromIndividuals = candidateTotals.individual_contributions || 0;
      fromCommittees = candidateTotals.other_political_committee_contributions || 0;

      console.log(
        `  Candidate ${fecCandidateId} cycle ${cycle}: receipts=$${totalReceipts}, individuals=$${fromIndividuals}`,
      );
    }

    // Fallback: some candidates (esp. Senators in off-years) may have committee totals even
    // when candidate totals are missing/zero for that cycle.
    if (totalReceipts === 0 && primaryCommittee) {
      const committeeTotals = await getCommitteeTotals(primaryCommittee, cycle, apiKey, stats);
      if (committeeTotals) {
        totalReceipts = committeeTotals.receipts || 0;
        fromIndividuals = committeeTotals.individual_contributions || 0;
        fromCommittees = committeeTotals.other_political_committee_contributions || 0;

        console.log(
          `  Fallback committee ${primaryCommittee} cycle ${cycle}: receipts=$${totalReceipts}, individuals=$${fromIndividuals}`,
        );
      }
    }

    // Only fetch geographic breakdown if we have receipts (to reduce API calls)
    if (totalReceipts > 0 && primaryCommittee) {
      const stateBreakdown = await getCommitteeContributionsByState(
        primaryCommittee,
        cycle,
        stateAbbrev,
        apiKey,
        stats,
      );

      inStateAmount = stateBreakdown.inState;
      outOfStateAmount = stateBreakdown.outOfState;
      itemizedTotal = stateBreakdown.itemizedTotal;
    }
    
    // CRITICAL: Only skip if zero receipts - not if other fields are zero
    if (totalReceipts === 0) {
      console.log(`  No receipts for ${member.full_name} in cycle ${cycle}`);
      continue;
    }
    
    foundDataInAnyCycle = true;
    
    // Calculate percentages
    const pctFromIndividuals = totalReceipts > 0 
      ? (fromIndividuals / totalReceipts) * 100 
      : null;
    
    const pctFromCommittees = totalReceipts > 0 
      ? (fromCommittees / totalReceipts) * 100 
      : null;
    
    // Estimate small donors (unitemized = small)
    const smallDonorAmount = Math.max(fromIndividuals - itemizedTotal, 0);
    const pctFromSmallDonors = fromIndividuals > 0 
      ? (smallDonorAmount / fromIndividuals) * 100 
      : null;
    
    // In-state vs out-of-state
    const basisForInOut = itemizedTotal || fromIndividuals;
    const pctFromInState = basisForInOut > 0 
      ? (inStateAmount / basisForInOut) * 100 
      : null;
    const pctFromOutOfState = basisForInOut > 0 
      ? (outOfStateAmount / basisForInOut) * 100 
      : null;
    
    // Calculate derived scores
    const scores = calculateScores({
      pctFromIndividuals,
      pctFromSmallDonors,
      pctFromInState,
      pctFromCommittees,
    });
    
    console.log(`  Upserting metrics for ${member.full_name} cycle ${cycle}: receipts=$${totalReceipts}, grassroots=${scores.grassrootsSupportScore}`);
    
    // Upsert funding metrics
    const { error } = await supabase
      .from("funding_metrics")
      .upsert({
        member_id: member.id,
        cycle,
        total_receipts: totalReceipts,
        pct_from_individuals: pctFromIndividuals,
        pct_from_committees: pctFromCommittees,
        pct_from_small_donors: pctFromSmallDonors,
        pct_from_in_state: pctFromInState,
        pct_from_out_of_state: pctFromOutOfState,
        grassroots_support_score: scores.grassrootsSupportScore,
        pac_dependence_score: scores.pacDependenceScore,
        local_money_score: scores.localMoneyScore,
        computed_at: new Date().toISOString(),
      }, {
        onConflict: "member_id,cycle",
      });
    
    if (error) {
      console.error(`Error upserting funding metrics for ${member.full_name}, cycle ${cycle}:`, error);
      stats.errors.push(`Upsert error for ${member.full_name} cycle ${cycle}: ${error.message}`);
    } else {
      cyclesProcessed++;
      stats.totalMetricsUpserted++;
    }
  }
  
  // Only update last synced timestamp if we actually found data
  // This allows retrying members who had FEC IDs but no financial data
  if (foundDataInAnyCycle) {
    stats.membersWithData++;
    await supabase
      .from("members")
      .update({ fec_last_synced_at: new Date().toISOString() })
      .eq("id", member.id);
  } else {
    console.log(`No funding data found for ${member.full_name} - will retry on next sync`);
  }
  
  return { 
    success: cyclesProcessed > 0, 
    cyclesProcessed,
    reason: cyclesProcessed === 0 ? `No funding data across any cycle` : undefined
  };
}

// Update state funding summaries
async function updateStateFundingSummaries(supabase: any) {
  console.log("Updating state funding summaries...");
  
  // Get latest cycle funding metrics grouped by state
  const { data: stateStats, error } = await supabase
    .from("funding_metrics")
    .select(`
      member_id,
      cycle,
      grassroots_support_score,
      pac_dependence_score,
      local_money_score,
      pct_from_out_of_state,
      members!inner(state)
    `)
    .order("cycle", { ascending: false });
  
  if (error) {
    console.error("Error fetching state funding stats:", error);
    return;
  }
  
  if (!stateStats || stateStats.length === 0) {
    console.log("No funding metrics to aggregate for state summaries");
    return;
  }
  
  // Group by state and take latest cycle per member
  const stateAggregates: Record<string, {
    grassroots: number[];
    pacDep: number[];
    localMoney: number[];
    outOfState: number[];
  }> = {};
  
  const processedMembers = new Set<string>();
  
  for (const row of stateStats) {
    if (processedMembers.has(row.member_id)) continue;
    processedMembers.add(row.member_id);
    
    const state = row.members?.state;
    if (!state) continue;
    
    if (!stateAggregates[state]) {
      stateAggregates[state] = {
        grassroots: [],
        pacDep: [],
        localMoney: [],
        outOfState: [],
      };
    }
    
    if (row.grassroots_support_score != null) {
      stateAggregates[state].grassroots.push(row.grassroots_support_score);
    }
    if (row.pac_dependence_score != null) {
      stateAggregates[state].pacDep.push(row.pac_dependence_score);
    }
    if (row.local_money_score != null) {
      stateAggregates[state].localMoney.push(row.local_money_score);
    }
    if (row.pct_from_out_of_state != null) {
      stateAggregates[state].outOfState.push(row.pct_from_out_of_state);
    }
  }
  
  // Update state_scores
  for (const [state, agg] of Object.entries(stateAggregates)) {
    const avg = (arr: number[]) => arr.length > 0 
      ? arr.reduce((a, b) => a + b, 0) / arr.length 
      : null;
    
    await supabase
      .from("state_scores")
      .update({
        avg_grassroots_support: avg(agg.grassroots),
        avg_pac_dependence: avg(agg.pacDep),
        avg_local_money: avg(agg.localMoney),
        avg_pct_out_of_state: avg(agg.outOfState),
      })
      .eq("state", state);
  }
  
  console.log(`Updated funding summaries for ${Object.keys(stateAggregates).length} states`);
}

// Helper function to check if syncs are paused
async function isSyncPaused(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('feature_toggles')
      .select('enabled')
      .eq('id', 'sync_paused')
      .single();
    
    if (error || !data) return false;
    return data.enabled === true;
  } catch {
    return false;
  }
}

// Background sync function with comprehensive logging
async function syncFecBackground(
  supabase: any, 
  apiKey: string, 
  mode: string,
  maxMembers: number
) {
  const stats: ProcessingStats = {
    membersProcessed: 0,
    membersWithData: 0,
    totalMetricsUpserted: 0,
    apiCallsMade: 0,
    errors: [],
  };
  
  console.log(`========================================`);
  console.log(`Starting FEC funding sync`);
  console.log(`Mode: ${mode}, Max members: ${maxMembers}`);
  console.log(`Cycles to process: ${CYCLES.join(', ')}`);
  console.log(`========================================`);
  
  // Update sync progress to running
  await supabase
    .from("sync_progress")
    .upsert({
      id: "fec-funding",
      status: "running",
      last_run_at: new Date().toISOString(),
      current_offset: 0,
      total_processed: 0,
      error_message: null,
    }, { onConflict: "id" });
  
  // Get members to sync
  // First, get member IDs that already have funding_metrics
  const { data: membersWithMetrics } = await supabase
    .from("funding_metrics")
    .select("member_id")
    .limit(1000);
  
  const memberIdsWithMetrics = new Set((membersWithMetrics || []).map((m: any) => m.member_id));
  
  // Fetch ALL in-office members then filter/sort appropriately
  const { data: allMembers, error } = await supabase
    .from("members")
    .select("*")
    .eq("in_office", true)
    .order("last_name");
  
  if (error) {
    console.error("Error fetching members:", error);
    await supabase.from("sync_progress").update({ 
      status: "error",
      error_message: `Failed to fetch members: ${error.message}`
    }).eq("id", "fec-funding");
    return;
  }
  
  // CRITICAL: Always prioritize members with fec_candidate_id but NO funding_metrics
  // These members have been identified in FEC but never had metrics calculated
  let members: any[] = [];
  
  if (mode === "missing_only") {
    // ONLY process members without ANY funding_metrics records
    members = (allMembers || []).filter((m: any) => !memberIdsWithMetrics.has(m.id)).slice(0, maxMembers);
    console.log(`Missing-only mode: ${members.length} members without funding_metrics (of ${(allMembers || []).length} total)`);
  } else if (mode === "incremental") {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    // Priority 1: Members with fec_candidate_id but no funding_metrics (regardless of fec_last_synced_at)
    const priorityMembers = (allMembers || []).filter((m: any) => 
      m.fec_candidate_id && !memberIdsWithMetrics.has(m.id)
    );
    
    // Priority 2: Members not synced recently or with no committees
    const staleMembers = (allMembers || []).filter((m: any) => {
      // Skip if already in priority list
      if (m.fec_candidate_id && !memberIdsWithMetrics.has(m.id)) return false;
      // Include if: no sync timestamp, stale timestamp, or no committees
      const isStale = !m.fec_last_synced_at || new Date(m.fec_last_synced_at) < threeDaysAgo;
      const noCommittees = !m.fec_committee_ids || m.fec_committee_ids.length === 0;
      return isStale || noCommittees;
    });
    
    members = [...priorityMembers, ...staleMembers].slice(0, maxMembers);
    console.log(`Priority: ${priorityMembers.length} members with FEC ID but no metrics`);
  } else {
    // Full mode: process all
    members = (allMembers || []).slice(0, maxMembers);
  }
  
  // CRITICAL GUARD: Abort if no members to process
  if (!members || members.length === 0) {
    console.log("No members to sync - all members already have funding metrics");
    await supabase.from("sync_progress").update({ 
      status: "complete",
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", "fec-funding");
    return;
  }
  
  const membersWithoutMetrics = members.filter((m: any) => !memberIdsWithMetrics.has(m.id)).length;
  console.log(`Syncing ${membersWithoutMetrics} members without funding_metrics`);
  
  console.log(`Found ${members.length} members to sync`);
  console.log(`Members: ${members.slice(0, 5).map((m: any) => m.full_name).join(', ')}${members.length > 5 ? '...' : ''}`);
  
  // Process each member
  for (const member of members) {
    try {
      stats.membersProcessed++;
      
      const result = await processMember(supabase, member, apiKey, stats);
      
      // Update progress after each member
      await supabase
        .from("sync_progress")
        .update({
          current_offset: stats.membersProcessed,
          total_processed: stats.membersWithData,
          updated_at: new Date().toISOString(),
          metadata: {
            api_calls: stats.apiCallsMade,
            metrics_upserted: stats.totalMetricsUpserted,
            errors_count: stats.errors.length,
          }
        })
        .eq("id", "fec-funding");
      
      const status = result.success ? `✓ ${result.cyclesProcessed} cycles` : `✗ ${result.reason || 'failed'}`;
      console.log(`[${stats.membersProcessed}/${members.length}] ${member.full_name}: ${status}`);
      
      // Rate limiting between members
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing ${member.full_name}:`, error);
      stats.errors.push(`Exception for ${member.full_name}: ${error}`);
    }
  }
  
  // Update state summaries only if we have data
  if (stats.membersWithData > 0) {
    await updateStateFundingSummaries(supabase);
  }
  
  // Get total funding metrics count for final stats
  const { count: totalMetrics } = await supabase
    .from("funding_metrics")
    .select("*", { count: "exact", head: true });
  
  // Mark complete with summary
  await supabase
    .from("sync_progress")
    .update({
      status: stats.errors.length > 0 && stats.membersWithData === 0 ? "error" : "complete",
      total_processed: totalMetrics || stats.totalMetricsUpserted,
      error_message: stats.errors.length > 0 ? stats.errors.slice(0, 5).join("; ") : null,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      last_success_count: stats.membersWithData,
      last_failure_count: stats.membersProcessed - stats.membersWithData,
      metadata: {
        api_calls: stats.apiCallsMade,
        metrics_upserted: stats.totalMetricsUpserted,
        members_processed: stats.membersProcessed,
        members_with_data: stats.membersWithData,
        errors: stats.errors.slice(0, 10),
      }
    })
    .eq("id", "fec-funding");
  
  console.log(`========================================`);
  console.log(`FEC sync complete`);
  console.log(`Members processed: ${stats.membersProcessed}`);
  console.log(`Members with data: ${stats.membersWithData}`);
  console.log(`Metrics upserted: ${stats.totalMetricsUpserted}`);
  console.log(`API calls: ${stats.apiCallsMade}`);
  console.log(`Errors: ${stats.errors.length}`);
  if (stats.errors.length > 0) {
    console.log(`Sample errors: ${stats.errors.slice(0, 3).join('; ')}`);
  }
  console.log(`========================================`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("FEC_API_KEY");
    if (!apiKey) {
      throw new Error("FEC_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if syncs are paused
    if (await isSyncPaused(supabase)) {
      console.log('Sync paused - skipping FEC funding sync');
      return new Response(
        JSON.stringify({ success: false, message: 'Syncs are currently paused', paused: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already running (prevent overlapping syncs)
    const { data: progress } = await supabase
      .from("sync_progress")
      .select("status, lock_until")
      .eq("id", "fec-funding")
      .single();
    
    if (progress?.status === "running" && progress?.lock_until && new Date(progress.lock_until) > new Date()) {
      console.log('FEC funding sync already running');
      return new Response(
        JSON.stringify({ success: false, message: 'Sync already in progress' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "incremental";
    const maxMembers = parseInt(url.searchParams.get("limit") || "50");

    // Set a lock to prevent overlapping runs
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + 30);
    
    await supabase
      .from("sync_progress")
      .upsert({
        id: "fec-funding",
        lock_until: lockUntil.toISOString(),
      }, { onConflict: "id" });

    // Run in background using waitUntil
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      syncFecBackground(supabase, apiKey, mode, maxMembers)
    ) ?? syncFecBackground(supabase, apiKey, mode, maxMembers).catch(console.error);

    return new Response(
      JSON.stringify({
        success: true,
        message: `FEC funding sync started in ${mode} mode for up to ${maxMembers} members`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
