import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const FEC_API_KEY = Deno.env.get("FEC_API_KEY") || "DEMO_KEY";
const FEC_API_BASE = "https://api.open.fec.gov/v1";
const MAX_RUNTIME_MS = 50000; // 50 seconds max runtime
const CONTRIBUTION_THRESHOLD = 101; // If less than this, might be incomplete
const BATCH_SIZE = 10; // Members to process per run

interface HealingAction {
  member_id: string;
  member_name: string;
  action_type: string;
  cycle?: number;
  before_count?: number;
  after_count?: number;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  details?: Record<string, unknown>;
}

interface MemberDataStatus {
  member_id: string;
  full_name: string;
  state: string;
  chamber: string;
  fec_candidate_id: string | null;
  issues: string[];
  contributions_by_cycle: Record<number, number>;
  has_funding_metrics: boolean;
  sync_state: Record<number, { is_complete: boolean; last_page: number; total_pages: number }>;
}

interface Issue {
  type: string;
  cycle?: number;
  currentCount?: number;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const actions: HealingAction[] = [];
  let membersProcessed = 0;
  let issuesFound = 0;
  let issuesFixed = 0;

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "true";
    const targetMemberId = url.searchParams.get("member_id");
    const maxMembers = parseInt(url.searchParams.get("max") || String(BATCH_SIZE));

    console.log(`[data-healing-agent] Starting. dry_run=${dryRun}, target=${targetMemberId || 'all'}, max=${maxMembers}`);

    // Step 1: Get all members with their data status
    const memberStatuses = await getMemberDataStatuses(supabase, targetMemberId, maxMembers);
    console.log(`[data-healing-agent] Analyzing ${memberStatuses.length} members`);

    for (const member of memberStatuses) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[data-healing-agent] Time limit reached, stopping`);
        break;
      }

      membersProcessed++;
      const memberIssues = analyzeIssues(member);
      
      if (memberIssues.length === 0) {
        continue;
      }

      issuesFound += memberIssues.length;
      console.log(`[data-healing-agent] ${member.full_name}: ${memberIssues.length} issues found`);

      for (const issue of memberIssues) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break;

        const action: HealingAction = {
          member_id: member.member_id,
          member_name: member.full_name,
          action_type: issue.type,
          cycle: issue.cycle,
          before_count: issue.currentCount,
          status: 'pending',
          details: issue.details,
        };

        if (!dryRun) {
          try {
            const result = await healIssue(supabase, supabaseUrl, supabaseKey, member, issue);
            action.status = result.success ? 'success' : 'failed';
            action.after_count = result.newCount;
            action.error = result.error;
            if (result.success) issuesFixed++;
          } catch (err) {
            action.status = 'failed';
            action.error = err instanceof Error ? err.message : String(err);
          }
        }

        actions.push(action);
      }
    }

    // Log summary to data_anomalies
    if (!dryRun && actions.length > 0) {
      await supabase.from('data_anomalies').insert({
        entity_type: 'healing_agent_run',
        anomaly_type: 'healing_summary',
        severity: issuesFixed > 0 ? 'info' : 'warning',
        details_json: {
          members_processed: membersProcessed,
          issues_found: issuesFound,
          issues_fixed: issuesFixed,
          actions: actions.slice(0, 50), // Limit stored actions
          runtime_ms: Date.now() - startTime,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      summary: {
        members_processed: membersProcessed,
        issues_found: issuesFound,
        issues_fixed: issuesFixed,
        runtime_ms: Date.now() - startTime,
      },
      actions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[data-healing-agent] Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      actions,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getMemberDataStatuses(
  supabase: any,
  targetMemberId: string | null,
  limit: number
): Promise<MemberDataStatus[]> {
  // Get members with potential issues (prioritize those without complete sync)
  let query = supabase
    .from('members')
    .select(`
      id,
      full_name,
      state,
      chamber,
      fec_candidate_id,
      in_office
    `)
    .eq('in_office', true);

  if (targetMemberId) {
    query = query.eq('id', targetMemberId);
  }

  const { data: members, error: membersError } = await query.limit(limit * 2); // Get more to filter

  if (membersError) throw membersError;
  if (!members?.length) return [];

  const memberIds = members.map((m: any) => m.id);

  // Get contributions count by cycle for each member
  const { data: contributionCounts } = await supabase
    .from('member_contributions')
    .select('member_id, cycle')
    .in('member_id', memberIds);

  // Get funding metrics
  const { data: fundingMetrics } = await supabase
    .from('funding_metrics')
    .select('member_id, cycle, contributions_fetched, contributions_total')
    .in('member_id', memberIds);

  // Get sync state
  const { data: syncStates } = await supabase
    .from('fec_sync_state')
    .select('member_id, cycle, is_complete, last_page_fetched, total_pages_estimated')
    .in('member_id', memberIds);

  // Build status for each member
  const statuses: MemberDataStatus[] = [];
  
  for (const member of members) {
    const memberContribs = (contributionCounts || []).filter((c: any) => c.member_id === member.id);
    const memberFunding = (fundingMetrics || []).filter((f: any) => f.member_id === member.id);
    const memberSync = (syncStates || []).filter((s: any) => s.member_id === member.id);

    // Count contributions by cycle
    const contribsByCycle: Record<number, number> = {};
    for (const c of memberContribs) {
      contribsByCycle[c.cycle] = (contribsByCycle[c.cycle] || 0) + 1;
    }

    // Build sync state map
    const syncStateMap: Record<number, { is_complete: boolean; last_page: number; total_pages: number }> = {};
    for (const s of memberSync) {
      syncStateMap[s.cycle] = {
        is_complete: s.is_complete || false,
        last_page: s.last_page_fetched || 0,
        total_pages: s.total_pages_estimated || 0,
      };
    }

    statuses.push({
      member_id: member.id,
      full_name: member.full_name,
      state: member.state,
      chamber: member.chamber,
      fec_candidate_id: member.fec_candidate_id,
      issues: [],
      contributions_by_cycle: contribsByCycle,
      has_funding_metrics: memberFunding.length > 0,
      sync_state: syncStateMap,
    });
  }

  // Sort by those with incomplete data first
  return statuses
    .filter(s => {
      // Prioritize members with incomplete sync or low contribution counts
      const cycles = [2024, 2026];
      for (const cycle of cycles) {
        const syncState = s.sync_state[cycle];
        if (syncState && !syncState.is_complete && syncState.last_page < syncState.total_pages) {
          return true;
        }
        const count = s.contributions_by_cycle[cycle] || 0;
        if (count > 0 && count < CONTRIBUTION_THRESHOLD) {
          return true;
        }
      }
      return !s.fec_candidate_id; // No FEC match
    })
    .slice(0, limit);
}

function analyzeIssues(member: MemberDataStatus): Issue[] {
  const issues: Issue[] = [];

  // Issue 1: No FEC candidate ID
  if (!member.fec_candidate_id) {
    issues.push({
      type: 'missing_fec_id',
      details: { member_name: member.full_name, state: member.state },
    });
  }

  // Issue 2: Check each priority cycle for incomplete data
  const cycles = [2024, 2026];
  for (const cycle of cycles) {
    const syncState = member.sync_state[cycle];
    const contribCount = member.contributions_by_cycle[cycle] || 0;

    // Incomplete pagination
    if (syncState && !syncState.is_complete && syncState.last_page < syncState.total_pages) {
      issues.push({
        type: 'incomplete_pagination',
        cycle,
        currentCount: contribCount,
        details: {
          last_page: syncState.last_page,
          total_pages: syncState.total_pages,
          pages_remaining: syncState.total_pages - syncState.last_page,
        },
      });
    }

    // Low contribution count (might have more)
    if (contribCount > 0 && contribCount < CONTRIBUTION_THRESHOLD && member.fec_candidate_id) {
      // Only flag if we have an FEC ID but low count
      if (!syncState || !syncState.is_complete) {
        issues.push({
          type: 'potentially_incomplete_contributions',
          cycle,
          currentCount: contribCount,
          details: { threshold: CONTRIBUTION_THRESHOLD },
        });
      }
    }
  }

  return issues;
}

async function healIssue(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  member: MemberDataStatus,
  issue: Issue
): Promise<{ success: boolean; newCount?: number; error?: string }> {
  console.log(`[data-healing-agent] Healing ${issue.type} for ${member.full_name}`);

  switch (issue.type) {
    case 'missing_fec_id':
      return await tryFindFecId(supabase, member);

    case 'incomplete_pagination':
    case 'potentially_incomplete_contributions':
      return await fetchMoreContributions(supabase, supabaseUrl, supabaseKey, member, issue.cycle!);

    default:
      return { success: false, error: `Unknown issue type: ${issue.type}` };
  }
}

async function tryFindFecId(
  supabase: any,
  member: MemberDataStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    // Search FEC API for candidate
    const searchName = member.full_name.replace(/[^a-zA-Z\s]/g, '').trim();
    const stateCode = member.state;
    const office = member.chamber === 'senate' ? 'S' : 'H';

    const searchUrl = `${FEC_API_BASE}/candidates/search/?api_key=${FEC_API_KEY}&name=${encodeURIComponent(searchName)}&state=${stateCode}&office=${office}&is_active_candidate=true&sort=-election_years`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      return { success: false, error: `FEC API error: ${response.status}` };
    }

    const data = await response.json();
    const candidates = data.results || [];

    if (candidates.length === 0) {
      return { success: false, error: 'No FEC candidate found' };
    }

    // Find best match
    const bestMatch = candidates[0];
    const candidateId = bestMatch.candidate_id;

    // Update member with FEC ID
    const { error: updateError } = await supabase
      .from('members')
      .update({ fec_candidate_id: candidateId })
      .eq('id', member.member_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Also update/insert into members_fec_mapping
    await supabase.from('members_fec_mapping').upsert({
      member_id: member.member_id,
      bioguide_id: member.member_id, // Assuming bioguide is the id
      fec_candidate_id: candidateId,
      match_method: 'healing_agent_auto',
      match_confidence: 0.8,
      is_verified: false,
    }, { onConflict: 'member_id' });

    console.log(`[data-healing-agent] Found FEC ID ${candidateId} for ${member.full_name}`);
    return { success: true };

  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchMoreContributions(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  member: MemberDataStatus,
  cycle: number
): Promise<{ success: boolean; newCount?: number; error?: string }> {
  try {
    // Call sync-fec-finance for this specific member and cycle
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-fec-finance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        member_id: member.member_id,
        cycle: cycle,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Sync function error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    
    // Get updated count
    const { count } = await supabase
      .from('member_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', member.member_id)
      .eq('cycle', cycle);

    return {
      success: true,
      newCount: count || 0,
    };

  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
