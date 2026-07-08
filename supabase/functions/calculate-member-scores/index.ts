import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { fetchWithRetry, TimeBudget, HttpClientConfig } from '../_shared/httpClient.ts'

const CONGRESS_HTTP_CONFIG: HttpClientConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxConcurrency: 2,
  minDelayBetweenRequestsMs: 250,
}
const SCORE_JOB_BUDGET_SECONDS = 260


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

// Helper function to check if syncs are paused
async function isSyncPaused(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('feature_toggles')
      .select('enabled')
      .eq('id', 'sync_paused')
      .single()
    
    if (error || !data) return false
    return data.enabled === true
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const congressApiKey = Deno.env.get('CONGRESS_GOV_API_KEY')
    if (!congressApiKey) {
      throw new Error('CONGRESS_GOV_API_KEY is not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if syncs are paused
    if (await isSyncPaused(supabase)) {
      console.log('Sync paused - skipping member score calculation')
      return new Response(
        JSON.stringify({ success: false, message: 'Syncs are currently paused', paused: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse query params
    const url = new URL(req.url)
    const useRealVoteData = url.searchParams.get('useRealVotes') !== 'false'

    console.log(`Starting member score calculation (useRealVotes: ${useRealVoteData})...`)

    // Get api_sources id for congress_gov
    const { data: sourceData } = await supabase
      .from('api_sources')
      .select('id')
      .eq('name', 'congress_gov')
      .single()

    const sourceId = sourceData?.id

    // Get all current members
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id, party, chamber, full_name, level')
      .eq('in_office', true)
    
    if (membersError) throw membersError
    console.log(`Processing ${members?.length || 0} members`)

    let scoresUpdated = 0
    let errors: string[] = []

    // Get actual vote data for all members from member_votes
    const voteStatsMap = new Map<string, { 
      total: number
      yea: number
      nay: number
      present: number
      notVoting: number
    }>()

    if (useRealVoteData) {
      console.log('Fetching real vote data from member_votes (paginated)...')

      // PostgREST caps responses at 1000 rows. member_votes grows to hundreds of
      // thousands, so we MUST paginate — otherwise attendance is silently wrong.
      const PAGE_SIZE = 1000
      let from = 0
      let totalRows = 0
      while (true) {
        const to = from + PAGE_SIZE - 1
        const { data: voteData, error: voteError } = await supabase
          .from('member_votes')
          .select('member_id, position')
          .order('id', { ascending: true })
          .range(from, to)

        if (voteError) {
          console.error('member_votes fetch error:', voteError.message)
          break
        }
        if (!voteData || voteData.length === 0) break

        for (const vote of voteData) {
          const stats = voteStatsMap.get(vote.member_id) || {
            total: 0, yea: 0, nay: 0, present: 0, notVoting: 0
          }
          stats.total++
          if (vote.position === 'yea') stats.yea++
          else if (vote.position === 'nay') stats.nay++
          else if (vote.position === 'present') stats.present++
          else stats.notVoting++
          voteStatsMap.set(vote.member_id, stats)
        }

        totalRows += voteData.length
        if (voteData.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }

      console.log(`Loaded ${totalRows} vote rows; stats for ${voteStatsMap.size} members`)
    }

    // Process each member. A top-level TimeBudget ensures we abort HTTP work
    // (via fetchWithRetry) before the edge function timeout hits.
    const budget = new TimeBudget(SCORE_JOB_BUDGET_SECONDS)
    for (const member of members || []) {
      if (!budget.shouldContinue()) {
        console.log(`Score calc time budget expired after ${scoresUpdated} members; stopping`)
        break
      }
      try {
        // Get real vote stats if available
        const voteStats = voteStatsMap.get(member.id)

        let votesCast = 0
        let votesMissed = 0
        
        if (voteStats && voteStats.total > 0) {
          // Use actual vote data
          votesCast = voteStats.yea + voteStats.nay + voteStats.present
          votesMissed = voteStats.notVoting
        }

        // STATE LEGISLATORS: simpler scoring path — no Congress.gov, no FEC.
        // Use member_votes for attendance; productivity/bipartisanship are baseline
        // until we capture state bill sponsorships in a follow-up sync.
        if (member.level === 'state') {
          const totalVotes = votesCast + votesMissed
          const attendanceScore = totalVotes > 0
            ? Math.round((votesCast / totalVotes) * 100)
            : 50 // baseline when we don't yet have vote data for this member

          const productivityScore = 50 // baseline — no sponsorship data yet
          const bipartisanshipScore = 50 // baseline
          const issueAlignmentScore = 50 // baseline

          const overallScore = Math.round(
            (attendanceScore * 0.4) +
            (productivityScore * 0.2) +
            (bipartisanshipScore * 0.2) +
            (issueAlignmentScore * 0.2)
          )

          const { error: stateUpsertErr } = await supabase
            .from('member_scores')
            .upsert({
              member_id: member.id,
              user_id: null,
              overall_score: overallScore,
              productivity_score: productivityScore,
              attendance_score: attendanceScore,
              bipartisanship_score: bipartisanshipScore,
              issue_alignment_score: issueAlignmentScore,
              votes_cast: votesCast,
              votes_missed: votesMissed,
              bills_sponsored: 0,
              bills_cosponsored: 0,
              bills_enacted: 0,
              bipartisan_bills: 0,
              is_provisional: true,
              provisional_reason: 'State legislator — productivity & alignment scoring pending sponsorship sync',
              calculated_at: new Date().toISOString(),
            }, { onConflict: 'member_id,user_id' })

          if (stateUpsertErr) {
            errors.push(`${member.full_name}: ${stateUpsertErr.message}`)
          } else {
            scoresUpdated++
          }
          // Skip Congress.gov fetching for state members
          continue
        }
        
        // Fetch member details from Congress.gov for bill data.
        // All Congress.gov calls go through fetchWithRetry so we get retry,
        // backoff, timeouts, per-provider concurrency, and circuit-breaking.
        const memberUrl = `https://api.congress.gov/v3/member/${member.bioguide_id}?format=json&api_key=${congressApiKey}`
        let memberDetail: any = null
        try {
          const { response } = await fetchWithRetry(memberUrl, {}, 'congress_gov', CONGRESS_HTTP_CONFIG, budget)
          if (!response.ok) {
            console.log(`Failed to fetch member ${member.bioguide_id}: ${response.status}`)
            continue
          }
          const memberData = await response.json()
          memberDetail = memberData.member
        } catch (e) {
          console.log(`Skipping ${member.bioguide_id} due to fetch error: ${e}`)
          continue
        }

        // Get bill counts
        let billsSponsored = memberDetail.sponsoredLegislation?.count || 0
        let billsCosponsored = memberDetail.cosponsoredLegislation?.count || 0
        let billsEnacted = 0
        let bipartisanBills = 0

        // Check sponsored bills for enacted status
        if (memberDetail.sponsoredLegislation?.url) {
          try {
            const sponsoredUrl = `${memberDetail.sponsoredLegislation.url}&format=json&limit=100&api_key=${congressApiKey}`
            const { response } = await fetchWithRetry(sponsoredUrl, {}, 'congress_gov', CONGRESS_HTTP_CONFIG, budget)
            if (response.ok) {
              const sponsoredData = await response.json()
              const bills = sponsoredData.sponsoredLegislation || []

              for (const bill of bills) {
                if (bill.latestAction?.text?.toLowerCase().includes('became public law')) {
                  billsEnacted++
                }
              }
            }
          } catch (e) {
            console.log(`Error fetching sponsored bills: ${e}`)
          }
        }

        // Bipartisan bills: query local bill_sponsorships joined with the
        // primary sponsor's party — previously did a per-bill Congress.gov
        // call which had no retry, no timeout, and cost N extra API calls per
        // member. sync-bills already populates bill_sponsorships, so no
        // external HTTP is needed.
        try {
          const { data: cosponsored } = await supabase
            .from('bill_sponsorships')
            .select('bill_id')
            .eq('member_id', member.id)
            .eq('is_sponsor', false)
            .limit(500)

          const primaryBillIds = (cosponsored || []).map((c: any) => c.bill_id).filter(Boolean)
          if (primaryBillIds.length > 0 && member.party) {
            // One query returns each bill's primary sponsor plus their party.
            const { data: primarySponsors } = await supabase
              .from('bill_sponsorships')
              .select('bill_id, members!inner(party)')
              .in('bill_id', primaryBillIds)
              .eq('is_sponsor', true)

            for (const ps of primarySponsors || []) {
              const primaryParty = (ps as any).members?.party
              if (!primaryParty) continue
              if ((member.party === 'D' && primaryParty === 'R') ||
                  (member.party === 'R' && primaryParty === 'D')) {
                bipartisanBills++
              }
            }
          }
        } catch (e) {
          console.log(`Error computing bipartisan bills from local data: ${e}`)
        }

        // If no real vote data, estimate based on activity
        if (!voteStats || voteStats.total === 0) {
          const totalLegislativeActivity = billsSponsored + billsCosponsored
          const activityRatio = Math.min(totalLegislativeActivity / 200, 1)
          const baseVotes = member.chamber === 'senate' ? 350 : 700
          const attendanceRate = 0.75 + (activityRatio * 0.20)
          votesCast = Math.round(baseVotes * attendanceRate)
          votesMissed = baseVotes - votesCast
        }

        // Calculate scores (0-100 scale)
        
        // Attendance Score
        const totalVotes = votesCast + votesMissed
        const attendanceScore = totalVotes > 0 
          ? Math.round((votesCast / totalVotes) * 100)
          : 80 // Default if no vote data
        
        // Productivity Score
        const sponsorScore = Math.min((billsSponsored / 20) * 50, 50)
        const enactedScore = Math.min(billsEnacted * 15, 50)
        const productivityScore = Math.round(sponsorScore + enactedScore)
        
        // Bipartisanship Score
        const bipartisanshipScore = Math.round(Math.min((bipartisanBills / 10) * 100, 100))

        // Activity Diversity Score (LEGACY: stored in issue_alignment_score column for backward-compat,
        // but no longer contributes to overall_score. Real per-user issue alignment lives in
        // alignment_score, populated by compute-politician-positions.)
        const activityRatio = Math.min((billsSponsored + billsCosponsored) / 200, 1)
        const activityDiversityScore = Math.round(50 + (activityRatio * 35))

        // Overall Score: weighted average across the three measured behaviors.
        // Removed the fake "issue alignment" proxy from the mean — it was legislative
        // activity relabeled, which violates the app's neutrality promise.
        const overallScore = Math.round(
          (attendanceScore * 0.30) +
          (productivityScore * 0.35) +
          (bipartisanshipScore * 0.35)
        )

        // Update member_scores table (alignment_score left NULL — filled by compute-politician-positions per user)
        const { error: updateError } = await supabase
          .from('member_scores')
          .upsert({
            member_id: member.id,
            user_id: null,
            overall_score: overallScore,
            productivity_score: productivityScore,
            attendance_score: attendanceScore,
            bipartisanship_score: bipartisanshipScore,
            issue_alignment_score: activityDiversityScore, // legacy column, activity proxy
            votes_cast: votesCast,
            votes_missed: votesMissed,
            bills_sponsored: billsSponsored,
            bills_cosponsored: billsCosponsored,
            bills_enacted: billsEnacted,
            bipartisan_bills: bipartisanBills,
            calculated_at: new Date().toISOString()
          }, {
            onConflict: 'member_id,user_id'
          })

        if (updateError) {
          errors.push(`${member.full_name}: ${updateError.message}`)
        } else {
          scoresUpdated++
          console.log(`Updated ${member.full_name}: overall=${overallScore}, attendance=${attendanceScore}, productivity=${productivityScore}`)
        }

        // fetchWithRetry already enforces minDelayBetweenRequestsMs between
        // congress_gov requests, so no per-member sleep is needed here.

      } catch (memberError) {
        const errMsg = memberError instanceof Error ? memberError.message : String(memberError)
        errors.push(`${member.bioguide_id}: ${errMsg}`)
      }
    }

    // Log sync run
    if (sourceId) {
      await logSyncRun(
        supabase, 
        sourceId, 
        'scores', 
        errors.length > 0 ? 'partial' : 'success',
        scoresUpdated,
        errors.length > 0 ? errors.slice(0, 5).join('; ') : undefined,
        { useRealVoteData, totalMembers: members?.length || 0 }
      )
    }

    // Get total scores for accurate progress
    const { count: totalScores } = await supabase
      .from('member_scores')
      .select('*', { count: 'exact', head: true });

    // Update sync progress with cumulative total
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'member-scores',
        last_run_at: new Date().toISOString(),
        status: 'complete',
        total_processed: totalScores || scoresUpdated,
        current_offset: 0,
        metadata: {
          last_batch_scores: scoresUpdated,
        }
      }, { onConflict: 'id' })

    const result = {
      success: true,
      scoresUpdated,
      errors: errors.slice(0, 10),
      message: `Successfully calculated scores for ${scoresUpdated} members`
    }

    console.log('Score calculation completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Score calculation error:', errorMessage)
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
