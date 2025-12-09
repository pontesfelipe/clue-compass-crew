import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Log sync run to api_sync_runs table
async function logSyncRun(
  supabase: any,
  sourceId: string | null,
  jobType: string,
  status: 'running' | 'success' | 'failed' | 'partial',
  itemsProcessed: number,
  errorMessage?: string,
  metadata?: Record<string, unknown>
) {
  if (!sourceId) return
  
  try {
    await supabase
      .from('api_sync_runs')
      .insert({
        source_id: sourceId,
        job_type: jobType,
        status,
        items_processed: itemsProcessed,
        finished_at: status !== 'running' ? new Date().toISOString() : null,
        error_message: errorMessage,
        metadata
      })
  } catch (e) {
    console.log('Error logging sync run:', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting state scores recalculation...')

    // Get api_sources id for congress_gov
    const { data: sourceData } = await supabase
      .from('api_sources')
      .select('id')
      .eq('name', 'congress_gov')
      .single()

    const sourceId = sourceData?.id

    // Get all current members with their scores
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select(`
        id,
        state,
        party,
        chamber,
        member_scores!inner (
          overall_score,
          productivity_score,
          attendance_score,
          bipartisanship_score,
          issue_alignment_score
        )
      `)
      .eq('in_office', true)
      .is('member_scores.user_id', null)
    
    if (membersError) throw membersError
    console.log(`Processing ${members?.length || 0} members for state aggregation`)

    // Aggregate by state
    const stateAggregates: Record<string, {
      totalScore: number
      totalProductivity: number
      totalAttendance: number
      totalBipartisanship: number
      totalIssueAlignment: number
      memberCount: number
      houseCount: number
      senateCount: number
      democratCount: number
      republicanCount: number
      independentCount: number
    }> = {}

    for (const member of members || []) {
      const state = member.state
      if (!state) continue

      // Initialize state if not exists
      if (!stateAggregates[state]) {
        stateAggregates[state] = {
          totalScore: 0,
          totalProductivity: 0,
          totalAttendance: 0,
          totalBipartisanship: 0,
          totalIssueAlignment: 0,
          memberCount: 0,
          houseCount: 0,
          senateCount: 0,
          democratCount: 0,
          republicanCount: 0,
          independentCount: 0
        }
      }

      const agg = stateAggregates[state]
      const scores = (member.member_scores as Record<string, number | null>[])?.[0]
      
      if (scores) {
        agg.totalScore += Number(scores.overall_score) || 0
        agg.totalProductivity += Number(scores.productivity_score) || 0
        agg.totalAttendance += Number(scores.attendance_score) || 0
        agg.totalBipartisanship += Number(scores.bipartisanship_score) || 0
        agg.totalIssueAlignment += Number(scores.issue_alignment_score) || 0
      }

      agg.memberCount++
      
      if (member.chamber === 'house') agg.houseCount++
      else if (member.chamber === 'senate') agg.senateCount++

      if (member.party === 'D') agg.democratCount++
      else if (member.party === 'R') agg.republicanCount++
      else agg.independentCount++
    }

    // Upsert state scores
    let statesUpdated = 0
    const errors: string[] = []

    for (const [state, agg] of Object.entries(stateAggregates)) {
      if (agg.memberCount === 0) continue

      const stateScoreRecord = {
        state,
        avg_member_score: Math.round(agg.totalScore / agg.memberCount),
        member_count: agg.memberCount,
        avg_productivity: Math.round(agg.totalProductivity / agg.memberCount),
        avg_attendance: Math.round(agg.totalAttendance / agg.memberCount),
        avg_bipartisanship: Math.round(agg.totalBipartisanship / agg.memberCount),
        avg_issue_alignment: Math.round(agg.totalIssueAlignment / agg.memberCount),
        house_count: agg.houseCount,
        senate_count: agg.senateCount,
        democrat_count: agg.democratCount,
        republican_count: agg.republicanCount,
        independent_count: agg.independentCount,
        last_calculated_at: new Date().toISOString()
      }

      const { error: upsertError } = await supabase
        .from('state_scores')
        .upsert(stateScoreRecord, { onConflict: 'state' })

      if (upsertError) {
        errors.push(`${state}: ${upsertError.message}`)
        console.log(`Error updating state ${state}: ${upsertError.message}`)
      } else {
        statesUpdated++
        console.log(`Updated ${state}: avg=${stateScoreRecord.avg_member_score}, members=${agg.memberCount}`)
      }
    }

    // Log sync run
    if (sourceId) {
      await logSyncRun(
        supabase, 
        sourceId, 
        'state_scores', 
        errors.length > 0 ? 'partial' : 'success',
        statesUpdated,
        errors.length > 0 ? errors.slice(0, 5).join('; ') : undefined,
        { totalStates: Object.keys(stateAggregates).length }
      )
    }

    // Update sync progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'state-scores',
        last_run_at: new Date().toISOString(),
        status: 'complete',
        total_processed: statesUpdated,
        current_offset: 0,
      }, { onConflict: 'id' })

    const result = {
      success: true,
      statesUpdated,
      totalStates: Object.keys(stateAggregates).length,
      errors: errors.slice(0, 10),
      message: `Successfully calculated scores for ${statesUpdated} states`
    }

    console.log('State scores recalculation completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('State score calculation error:', errorMessage)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
