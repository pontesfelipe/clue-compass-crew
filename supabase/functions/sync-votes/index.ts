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
            // Extract roll number from different possible fields
            const rollNumber = vote.rollNumber || vote.rollCallNumber || vote.number
            
            if (!rollNumber) {
              console.log(`Skipping vote - no roll number. Keys: ${Object.keys(vote).join(', ')}`)
              continue
            }

            // Fetch detailed vote data
            const detailUrl = `https://api.congress.gov/v3/house-vote/${congress}/${rollNumber}?format=json&api_key=${congressApiKey}`
            const detailResponse = await fetch(detailUrl)
            
            if (!detailResponse.ok) {
              console.log(`Failed to fetch vote ${rollNumber}: ${detailResponse.status}`)
              continue
            }
            
            const detailData = await detailResponse.json()
            const voteDetail = detailData.houseRollCallVote || detailData

            // Log structure of first detailed vote
            if (totalVotesProcessed === 0) {
              console.log(`Vote detail keys: ${Object.keys(voteDetail).join(', ')}`)
            }

            const voteRecord = {
              congress: congress,
              chamber: 'house' as const,
              session: voteDetail.session || 1,
              roll_number: rollNumber,
              vote_date: voteDetail.actionDate || voteDetail.date || vote.actionDate || null,
              question: voteDetail.question || vote.question || null,
              description: voteDetail.voteQuestion || voteDetail.description || vote.description || null,
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
