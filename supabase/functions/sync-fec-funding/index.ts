import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEC_API_BASE = "https://api.open.fec.gov/v1";
const CYCLES = [2020, 2022, 2024];
const BATCH_SIZE = 10;

interface FundingMetrics {
  totalReceipts: number;
  fromIndividuals: number;
  fromCommittees: number;
  itemizedIndividualAmount: number;
  inStateAmount: number;
  outOfStateAmount: number;
  smallDonorAmount: number;
}

// Generic FEC API helper with pagination
async function fecGet(path: string, params: Record<string, string | number>, apiKey: string): Promise<any[]> {
  const results: any[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const url = new URL(`${FEC_API_BASE}${path}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    
    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error(`FEC API error: ${response.status} for ${path}`);
        break;
      }
      
      const data = await response.json();
      if (!data.results || data.results.length === 0) break;
      
      results.push(...data.results);
      
      // Check if we've fetched all pages
      if (data.pagination?.pages && page >= data.pagination.pages) break;
      if (results.length >= 1000) break; // Safety limit
      
      page++;
    } catch (error) {
      console.error(`FEC API fetch error for ${path}:`, error);
      break;
    }
  }
  
  return results;
}

// Get candidate by name and state
async function findCandidateId(name: string, state: string, apiKey: string): Promise<string | null> {
  try {
    const results = await fecGet("/candidates/search/", {
      name: name,
      state: state,
      is_active_candidate: "true",
      sort: "-election_years",
    }, apiKey);
    
    if (results.length > 0) {
      return results[0].candidate_id;
    }
  } catch (error) {
    console.error(`Error finding candidate ${name} in ${state}:`, error);
  }
  return null;
}

// Get candidate's committees
async function getCandidateCommittees(candidateId: string, apiKey: string): Promise<string[]> {
  try {
    const results = await fecGet(`/candidate/${candidateId}/committees/`, {
      designation: "P,A", // Principal and authorized
    }, apiKey);
    
    return results.map((c: any) => c.committee_id);
  } catch (error) {
    console.error(`Error getting committees for ${candidateId}:`, error);
    return [];
  }
}

// Get committee financial totals
async function getCommitteeTotals(committeeId: string, cycle: number, apiKey: string): Promise<any | null> {
  try {
    const results = await fecGet(`/committee/${committeeId}/totals/`, {
      cycle: cycle,
    }, apiKey);
    
    return results[0] || null;
  } catch (error) {
    console.error(`Error getting totals for ${committeeId}:`, error);
    return null;
  }
}

// Get itemized individual contributions with state info
async function getCommitteeContributionsByState(
  committeeId: string, 
  cycle: number, 
  memberState: string,
  apiKey: string
): Promise<{ inState: number; outOfState: number; itemizedTotal: number }> {
  try {
    // Use aggregated endpoint for efficiency
    const results = await fecGet("/schedules/schedule_a/by_state/", {
      committee_id: committeeId,
      cycle: cycle,
    }, apiKey);
    
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
  } catch (error) {
    console.error(`Error getting contributions by state for ${committeeId}:`, error);
    return { inState: 0, outOfState: 0, itemizedTotal: 0 };
  }
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
  apiKey: string
): Promise<{ success: boolean; cyclesProcessed: number }> {
  let fecCandidateId = member.fec_candidate_id;
  let fecCommitteeIds = member.fec_committee_ids || [];
  
  // Find FEC candidate ID if not stored
  if (!fecCandidateId) {
    fecCandidateId = await findCandidateId(member.full_name, member.state, apiKey);
    
    if (!fecCandidateId) {
      console.log(`No FEC candidate found for ${member.full_name} (${member.state})`);
      return { success: false, cyclesProcessed: 0 };
    }
    
    // Store the candidate ID
    await supabase
      .from("members")
      .update({ fec_candidate_id: fecCandidateId })
      .eq("id", member.id);
  }
  
  // Get committees if not stored
  if (fecCommitteeIds.length === 0) {
    fecCommitteeIds = await getCandidateCommittees(fecCandidateId, apiKey);
    
    if (fecCommitteeIds.length === 0) {
      console.log(`No committees found for ${member.full_name}`);
      return { success: false, cyclesProcessed: 0 };
    }
    
    // Store the committee IDs
    await supabase
      .from("members")
      .update({ fec_committee_ids: fecCommitteeIds })
      .eq("id", member.id);
  }
  
  let cyclesProcessed = 0;
  
  // Process each cycle
  for (const cycle of CYCLES) {
    let totalReceipts = 0;
    let fromIndividuals = 0;
    let fromCommittees = 0;
    let inStateAmount = 0;
    let outOfStateAmount = 0;
    let itemizedTotal = 0;
    
    // Aggregate across all committees
    for (const committeeId of fecCommitteeIds) {
      const totals = await getCommitteeTotals(committeeId, cycle, apiKey);
      
      if (totals) {
        totalReceipts += totals.receipts || 0;
        fromIndividuals += totals.individual_contributions || 0;
        fromCommittees += totals.other_political_committee_contributions || 0;
      }
      
      const stateBreakdown = await getCommitteeContributionsByState(
        committeeId, cycle, member.state, apiKey
      );
      
      inStateAmount += stateBreakdown.inState;
      outOfStateAmount += stateBreakdown.outOfState;
      itemizedTotal += stateBreakdown.itemizedTotal;
    }
    
    if (totalReceipts === 0) continue;
    
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
    } else {
      cyclesProcessed++;
    }
  }
  
  // Update last synced timestamp
  await supabase
    .from("members")
    .update({ fec_last_synced_at: new Date().toISOString() })
    .eq("id", member.id);
  
  return { success: true, cyclesProcessed };
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
  
  // Group by state and take latest cycle per member
  const stateAggregates: Record<string, {
    grassroots: number[];
    pacDep: number[];
    localMoney: number[];
    outOfState: number[];
  }> = {};
  
  const processedMembers = new Set<string>();
  
  for (const row of stateStats || []) {
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

// Background sync function
async function syncFecBackground(
  supabase: any, 
  apiKey: string, 
  mode: string,
  maxMembers: number
) {
  console.log(`Starting FEC sync in ${mode} mode, max ${maxMembers} members`);
  
  // Update sync progress
  await supabase
    .from("sync_progress")
    .upsert({
      id: "fec-funding",
      status: "running",
      last_run_at: new Date().toISOString(),
      current_offset: 0,
      total_processed: 0,
    }, { onConflict: "id" });
  
  // Get members to sync
  let query = supabase
    .from("members")
    .select("*")
    .eq("in_office", true);
  
  if (mode === "incremental") {
    // Only sync members not synced in last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    query = query.or(`fec_last_synced_at.is.null,fec_last_synced_at.lt.${threeDaysAgo.toISOString()}`);
  }
  
  const { data: members, error } = await query.limit(maxMembers);
  
  if (error) {
    console.error("Error fetching members:", error);
    await supabase.from("sync_progress").update({ status: "error" }).eq("id", "fec-funding");
    return;
  }
  
  console.log(`Found ${members?.length || 0} members to sync`);
  
  let processed = 0;
  let successful = 0;
  
  for (const member of members || []) {
    try {
      const result = await processMember(supabase, member, apiKey);
      processed++;
      if (result.success) successful++;
      
      // Update progress
      await supabase
        .from("sync_progress")
        .update({
          current_offset: processed,
          total_processed: successful,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "fec-funding");
      
      console.log(`Processed ${processed}/${members.length}: ${member.full_name} - ${result.cyclesProcessed} cycles`);
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing ${member.full_name}:`, error);
    }
  }
  
  // Update state summaries
  await updateStateFundingSummaries(supabase);
  
  // Mark complete
  await supabase
    .from("sync_progress")
    .update({
      status: "complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", "fec-funding");
  
  console.log(`FEC sync complete: ${successful}/${processed} members synced`);
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

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "incremental";
    const maxMembers = parseInt(url.searchParams.get("limit") || "20");

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
