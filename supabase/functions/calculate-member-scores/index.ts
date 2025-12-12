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
      .select('id, bioguide_id, party, chamber, full_name')
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
      console.log('Fetching real vote data from member_votes...')
      
      const { data: voteData, error: voteError } = await supabase
        .from('member_votes')
        .select('member_id, position')
      
      if (!voteError && voteData) {
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
        
        console.log(`Loaded vote stats for ${voteStatsMap.size} members`)
      }
    }

    // Process each member
    for (const member of members || []) {
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
        
        // Fetch member details from Congress.gov for bill data
        const memberUrl = `https://api.congress.gov/v3/member/${member.bioguide_id}?format=json&api_key=${congressApiKey}`
        const memberResponse = await fetch(memberUrl)
        
        if (!memberResponse.ok) {
          console.log(`Failed to fetch member ${member.bioguide_id}: ${memberResponse.status}`)
          continue
        }
        
        const memberData = await memberResponse.json()
        const memberDetail = memberData.member

        // Get bill counts
        let billsSponsored = memberDetail.sponsoredLegislation?.count || 0
        let billsCosponsored = memberDetail.cosponsoredLegislation?.count || 0
        let billsEnacted = 0
        let bipartisanBills = 0

        // Check sponsored bills for enacted status
        if (memberDetail.sponsoredLegislation?.url) {
          try {
            const sponsoredUrl = `${memberDetail.sponsoredLegislation.url}&format=json&limit=100&api_key=${congressApiKey}`
            const sponsoredResponse = await fetch(sponsoredUrl)
            if (sponsoredResponse.ok) {
              const sponsoredData = await sponsoredResponse.json()
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

        // Check cosponsored bills for bipartisan activity
        if (memberDetail.cosponsoredLegislation?.url) {
          try {
            const cosponsoredUrl = `${memberDetail.cosponsoredLegislation.url}&format=json&limit=50&api_key=${congressApiKey}`
            const cosponsoredResponse = await fetch(cosponsoredUrl)
            if (cosponsoredResponse.ok) {
              const cosponsoredData = await cosponsoredResponse.json()
              const bills = cosponsoredData.cosponsoredLegislation || []
              
              for (const bill of bills.slice(0, 20)) {
                const billDetailUrl = `https://api.congress.gov/v3/bill/${bill.congress}/${bill.type?.toLowerCase()}/${bill.number}?format=json&api_key=${congressApiKey}`
                try {
                  const billDetailResponse = await fetch(billDetailUrl)
                  if (billDetailResponse.ok) {
                    const billDetailData = await billDetailResponse.json()
                    const sponsor = billDetailData.bill?.sponsors?.[0]
                    if (sponsor?.party) {
                      const sponsorParty = sponsor.party.charAt(0).toUpperCase()
                      if ((member.party === 'D' && sponsorParty === 'R') ||
                          (member.party === 'R' && sponsorParty === 'D')) {
                        bipartisanBills++
                      }
                    }
                  }
                } catch (e) {
                  // Skip bill on error
                }
                await new Promise(resolve => setTimeout(resolve, 30))
              }
            }
          } catch (e) {
            console.log(`Error fetching cosponsored bills: ${e}`)
          }
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
        
        // Issue Alignment Score (baseline)
        const activityRatio = Math.min((billsSponsored + billsCosponsored) / 200, 1)
        const issueAlignmentScore = Math.round(50 + (activityRatio * 35))

        // Overall Score: weighted average
        const overallScore = Math.round(
          (attendanceScore * 0.25) +
          (productivityScore * 0.25) +
          (bipartisanshipScore * 0.25) +
          (issueAlignmentScore * 0.25)
        )

        // Update member_scores table
        const { error: updateError } = await supabase
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

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))
        
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
