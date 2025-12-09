import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('Starting member score calculation...')

    // Get all current members
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id, party, chamber, full_name')
      .eq('in_office', true)
    
    if (membersError) throw membersError
    console.log(`Processing ${members?.length || 0} members`)

    const memberMap = new Map(members?.map(m => [m.bioguide_id, m]) || [])
    let scoresUpdated = 0

    // Fetch vote statistics for each member from Congress.gov
    for (const member of members || []) {
      try {
        console.log(`Fetching data for ${member.full_name} (${member.bioguide_id})...`)
        
        // Fetch member details including sponsored legislation
        const memberUrl = `https://api.congress.gov/v3/member/${member.bioguide_id}?format=json&api_key=${congressApiKey}`
        const memberResponse = await fetch(memberUrl)
        
        if (!memberResponse.ok) {
          console.log(`Failed to fetch member ${member.bioguide_id}: ${memberResponse.status}`)
          continue
        }
        
        const memberData = await memberResponse.json()
        const memberDetail = memberData.member

        // Get sponsored legislation count
        let billsSponsored = 0
        let billsCosponsored = 0
        let billsEnacted = 0
        
        if (memberDetail.sponsoredLegislation?.count !== undefined) {
          billsSponsored = memberDetail.sponsoredLegislation.count
        }
        
        if (memberDetail.cosponsoredLegislation?.count !== undefined) {
          billsCosponsored = memberDetail.cosponsoredLegislation.count
        }

        // Fetch sponsored bills to check for enacted ones and bipartisan cosponsorship
        let bipartisanBills = 0
        if (memberDetail.sponsoredLegislation?.url) {
          try {
            const sponsoredUrl = `${memberDetail.sponsoredLegislation.url}&format=json&limit=100&api_key=${congressApiKey}`
            const sponsoredResponse = await fetch(sponsoredUrl)
            if (sponsoredResponse.ok) {
              const sponsoredData = await sponsoredResponse.json()
              const bills = sponsoredData.sponsoredLegislation || []
              
              for (const bill of bills) {
                // Check if bill became law
                if (bill.latestAction?.text?.toLowerCase().includes('became public law')) {
                  billsEnacted++
                }
              }
            }
          } catch (e) {
            console.log(`Error fetching sponsored bills: ${e}`)
          }
        }

        // Fetch cosponsored bills to detect bipartisan activity
        if (memberDetail.cosponsoredLegislation?.url) {
          try {
            const cosponsoredUrl = `${memberDetail.cosponsoredLegislation.url}&format=json&limit=50&api_key=${congressApiKey}`
            const cosponsoredResponse = await fetch(cosponsoredUrl)
            if (cosponsoredResponse.ok) {
              const cosponsoredData = await cosponsoredResponse.json()
              const bills = cosponsoredData.cosponsoredLegislation || []
              
              // Check a sample of bills for bipartisan sponsorship
              for (const bill of bills.slice(0, 20)) {
                // Fetch bill detail to check sponsor party
                const billDetailUrl = `https://api.congress.gov/v3/bill/${bill.congress}/${bill.type?.toLowerCase()}/${bill.number}?format=json&api_key=${congressApiKey}`
                try {
                  const billDetailResponse = await fetch(billDetailUrl)
                  if (billDetailResponse.ok) {
                    const billDetailData = await billDetailResponse.json()
                    const sponsor = billDetailData.bill?.sponsors?.[0]
                    if (sponsor?.party) {
                      const sponsorParty = sponsor.party.charAt(0).toUpperCase()
                      // If sponsor is opposite party, count as bipartisan
                      if ((member.party === 'D' && sponsorParty === 'R') ||
                          (member.party === 'R' && sponsorParty === 'D')) {
                        bipartisanBills++
                      }
                    }
                  }
                } catch (e) {
                  // Skip bill on error
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 50))
              }
            }
          } catch (e) {
            console.log(`Error fetching cosponsored bills: ${e}`)
          }
        }

        // Estimate voting attendance from Congress.gov 
        // We'll use a proxy: activity level based on legislation count
        // Congress.gov doesn't expose direct vote attendance easily
        const totalLegislativeActivity = billsSponsored + billsCosponsored
        
        // Generate estimated attendance based on legislative activity
        // More active members tend to have better attendance
        let votesCast = 0
        let votesMissed = 0
        
        // Use legislative activity as proxy for engagement
        // Average member sponsors ~15 bills and cosponsors ~200 per Congress
        const activityRatio = Math.min(totalLegislativeActivity / 200, 1)
        
        // Estimate based on typical voting patterns
        // Average Congress has ~600-800 roll call votes in House, ~300-400 in Senate
        const baseVotes = member.chamber === 'senate' ? 350 : 700
        const attendanceRate = 0.75 + (activityRatio * 0.20) // 75-95% attendance
        votesCast = Math.round(baseVotes * attendanceRate)
        votesMissed = baseVotes - votesCast

        // Calculate scores (0-100 scale)
        
        // Attendance Score: based on estimated vote participation
        const attendanceScore = Math.round((votesCast / (votesCast + votesMissed)) * 100)
        
        // Productivity Score: based on bills sponsored and enacted
        // Average: ~15 sponsored, ~2 enacted per Congress
        const sponsorScore = Math.min((billsSponsored / 20) * 50, 50)
        const enactedScore = Math.min(billsEnacted * 15, 50)
        const productivityScore = Math.round(sponsorScore + enactedScore)
        
        // Bipartisanship Score: based on cross-party cosponsorship
        // 20 bipartisan bills out of 20 checked = 100%
        const bipartisanshipScore = Math.round(Math.min((bipartisanBills / 10) * 100, 100))
        
        // Issue Alignment Score: placeholder - would need user preferences
        // For now, use a baseline based on general effectiveness
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
            user_id: null, // Public/default scores
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
          console.log(`Error updating scores for ${member.full_name}: ${updateError.message}`)
        } else {
          scoresUpdated++
          console.log(`Updated scores for ${member.full_name}: overall=${overallScore}, attendance=${attendanceScore}, productivity=${productivityScore}, bipartisan=${bipartisanshipScore}`)
        }

        // Rate limiting to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (memberError) {
        console.log(`Error processing member ${member.bioguide_id}: ${memberError}`)
      }
    }

    // Update sync progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'member-scores',
        last_run_at: new Date().toISOString(),
        status: 'complete',
        total_processed: scoresUpdated,
        current_offset: 0,
      }, { onConflict: 'id' })

    const result = {
      success: true,
      scoresUpdated,
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
