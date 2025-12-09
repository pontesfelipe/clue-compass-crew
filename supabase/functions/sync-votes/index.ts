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

    console.log('Starting votes sync...')

    // Get all members from DB to map bioguide_id to member id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id, chamber')
      .eq('in_office', true)
    
    if (membersError) throw membersError
    
    const memberMap = new Map(members?.map(m => [m.bioguide_id, { id: m.id, chamber: m.chamber }]) || [])
    console.log(`Loaded ${memberMap.size} members for mapping`)

    // Fetch House roll call votes from Congress 118 and 119
    const congresses = [118, 119]
    let totalVotesProcessed = 0
    let totalMemberVotesCreated = 0

    for (const congress of congresses) {
      console.log(`Fetching House votes from Congress ${congress}...`)
      
      let offset = 0
      const limit = 50
      let hasMore = true
      let votesInCongress = 0
      
      while (hasMore && votesInCongress < 30) { // Limit to avoid timeout
        const url = `https://api.congress.gov/v3/house-vote/${congress}?format=json&limit=${limit}&offset=${offset}&api_key=${congressApiKey}`
        
        console.log(`Fetching offset ${offset}...`)
        
        const response = await fetch(url)
        
        if (!response.ok) {
          console.error(`Congress API error: ${response.status}`)
          break
        }
        
        const data = await response.json()
        
        // The correct key is 'houseRollCallVotes'
        const rollCallVotes = data.houseRollCallVotes || []
        
        console.log(`Found ${rollCallVotes.length} house votes`)
        
        if (rollCallVotes.length === 0) {
          hasMore = false
          break
        }

        // Log first vote structure for debugging
        if (rollCallVotes.length > 0 && offset === 0) {
          console.log(`Sample vote keys: ${Object.keys(rollCallVotes[0]).join(', ')}`)
        }

        // Process each vote
        for (const vote of rollCallVotes) {
          try {
            // Use the URL from the list response - it includes session
            const voteUrl = vote.url
            const rollNumber = vote.rollCallNumber || vote.rollNumber
            const sessionNumber = vote.sessionNumber
            
            if (!rollNumber) {
              console.log(`Skipping vote - no roll number`)
              continue
            }

            // Use the URL from the API or construct with session
            let detailUrl = voteUrl ? `${voteUrl}?format=json&api_key=${congressApiKey}` 
              : `https://api.congress.gov/v3/house-vote/${congress}/${sessionNumber || 1}/${rollNumber}?format=json&api_key=${congressApiKey}`
            
            const detailResponse = await fetch(detailUrl)
            
            if (!detailResponse.ok) {
              console.log(`Failed to fetch vote ${rollNumber}: ${detailResponse.status}`)
              // Try without detail - use list data directly
              const voteRecord = {
                congress: congress,
                chamber: 'house' as const,
                session: sessionNumber || 1,
                roll_number: rollNumber,
                vote_date: vote.startDate || vote.actionDate || null,
                question: vote.amendmentAuthor || vote.question || null,
                description: vote.voteType || vote.description || null,
                result: vote.result || null,
                total_yea: 0,
                total_nay: 0,
                total_present: 0,
                total_not_voting: 0,
              }

              const { error } = await supabase
                .from('votes')
                .upsert(voteRecord, { onConflict: 'congress,chamber,roll_number' })
              
              if (!error) {
                totalVotesProcessed++
                votesInCongress++
                console.log(`Created vote from list: roll ${rollNumber}`)
              }
              continue
            }
            
            const detailData = await detailResponse.json()
            // The detail endpoint returns houseRollCallVote (singular) for individual vote
            let voteDetail = detailData.houseRollCallVote || vote
            if (!voteDetail || !voteDetail.rollCallNumber) {
              voteDetail = vote // Fall back to list data
            }

            // Log structure of first detailed vote
            if (totalVotesProcessed === 0) {
              console.log(`Vote detail: ${JSON.stringify(voteDetail).substring(0, 300)}`)
            }

            // Extract date - API returns startDate in ISO format
            let voteDate = voteDetail.startDate || voteDetail.actionDate || vote.startDate || vote.actionDate
            if (voteDate) {
              // Parse to just the date part (YYYY-MM-DD)
              voteDate = voteDate.substring(0, 10)
            } else {
              // Use current date as fallback
              voteDate = new Date().toISOString().substring(0, 10)
            }

            const voteRecord = {
              congress: congress,
              chamber: 'house' as const,
              session: voteDetail.sessionNumber || voteDetail.session || 1,
              roll_number: rollNumber,
              vote_date: voteDate,
              question: voteDetail.legislationType || voteDetail.question || vote.question || null,
              description: voteDetail.amendmentAuthor || voteDetail.legislationNumber ? `${voteDetail.legislationType || ''} ${voteDetail.legislationNumber || ''}` : null,
              result: voteDetail.result || vote.result || null,
              total_yea: voteDetail.totals?.yea || voteDetail.yea || 0,
              total_nay: voteDetail.totals?.nay || voteDetail.nay || 0,
              total_present: voteDetail.totals?.present || voteDetail.present || 0,
              total_not_voting: voteDetail.totals?.notVoting || voteDetail.notVoting || 0,
            }

            // Upsert vote
            const { data: upsertedVote, error: voteError } = await supabase
              .from('votes')
              .upsert(voteRecord, {
                onConflict: 'congress,chamber,roll_number',
                ignoreDuplicates: false
              })
              .select('id')
              .single()

            let voteId: string
            if (voteError) {
              const { data: existingVote } = await supabase
                .from('votes')
                .select('id')
                .eq('congress', congress)
                .eq('chamber', 'house')
                .eq('roll_number', rollNumber)
                .single()
              
              if (!existingVote) {
                console.log(`Error upserting vote ${rollNumber}: ${voteError.message}`)
                continue
              }
              voteId = existingVote.id
            } else {
              voteId = upsertedVote.id
            }

            totalVotesProcessed++
            votesInCongress++
            console.log(`Processed vote: roll ${rollNumber}`)

            // Process member votes if available
            const memberVotes = voteDetail.members || voteDetail.memberVotes || []
            for (const mv of memberVotes.slice(0, 50)) {
              const bioguideId = mv.bioguideId || mv.member?.bioguideId
              const memberInfo = memberMap.get(bioguideId)
              if (!memberInfo) continue

              let position: 'yea' | 'nay' | 'present' | 'not_voting' = 'not_voting'
              const voteStr = (mv.votePosition || mv.vote || '').toLowerCase()
              if (voteStr === 'yea' || voteStr === 'yes' || voteStr === 'aye') {
                position = 'yea'
              } else if (voteStr === 'nay' || voteStr === 'no') {
                position = 'nay'
              } else if (voteStr === 'present') {
                position = 'present'
              }

              const { error: mvError } = await supabase
                .from('member_votes')
                .upsert({
                  vote_id: voteId,
                  member_id: memberInfo.id,
                  position: position,
                }, {
                  onConflict: 'vote_id,member_id',
                  ignoreDuplicates: true
                })

              if (!mvError) totalMemberVotesCreated++
            }

          } catch (voteError) {
            console.log(`Error processing vote: ${voteError}`)
          }
          
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        offset += limit
        hasMore = rollCallVotes.length === limit
        
        console.log(`Processed ${votesInCongress} votes from Congress ${congress}`)
      }
    }

    const result = {
      success: true,
      votesProcessed: totalVotesProcessed,
      memberVotesCreated: totalMemberVotesCreated,
      message: `Successfully synced ${totalVotesProcessed} votes with ${totalMemberVotesCreated} member votes`
    }

    console.log('Votes sync completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Votes sync error:', errorMessage)
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
