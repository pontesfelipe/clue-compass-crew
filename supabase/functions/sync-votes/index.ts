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

    // Fetch recent roll call votes from Congress 118 and 119
    // Using house-vote and senate-vote endpoints
    const congresses = [118, 119]
    const chambers = ['house', 'senate'] as const
    let totalVotesProcessed = 0
    let totalMemberVotesCreated = 0

    for (const congress of congresses) {
      for (const chamber of chambers) {
        console.log(`Fetching ${chamber} votes from Congress ${congress}...`)
        
        // Use the correct endpoint path for each chamber
        const endpointPath = chamber === 'house' ? 'house-vote' : 'daily-congressional-record'
        let offset = 0
        const limit = 250
        let hasMore = true
        let votesInChamber = 0
        
        while (hasMore && votesInChamber < 100) { // Limit votes to avoid timeout
          // Try house-vote endpoint for House chamber
          const url = chamber === 'house' 
            ? `https://api.congress.gov/v3/house-vote/${congress}?format=json&limit=${limit}&offset=${offset}&api_key=${congressApiKey}`
            : `https://api.congress.gov/v3/nomination/${congress}?format=json&limit=${limit}&offset=${offset}&api_key=${congressApiKey}` // Senate votes through nominations
          
          console.log(`Fetching: ${url.replace(congressApiKey, 'API_KEY')}`)
          
          const response = await fetch(url)
          
          if (!response.ok) {
            console.error(`Congress API error for ${chamber} votes: ${response.status} - ${response.statusText}`)
            const errorText = await response.text()
            console.log(`Error response: ${errorText.substring(0, 200)}`)
            break
          }
          
          const data = await response.json()
          console.log(`API response keys: ${Object.keys(data).join(', ')}`)
          
          // Handle different response formats
          const rollCallVotes = data['house-votes'] || data['houseVotes'] || data.votes || data.nominations || []
          
          console.log(`Found ${rollCallVotes.length} items`)
          
          if (rollCallVotes.length === 0) {
            hasMore = false
            break
          }

          // Process each vote
          for (const rollCall of rollCallVotes) {
            try {
              // Get vote URL - handle different formats
              let voteUrl = rollCall.url
              if (!voteUrl && rollCall.rollCallNumber) {
                voteUrl = `https://api.congress.gov/v3/house-vote/${congress}/${rollCall.rollCallNumber}`
              }
              if (!voteUrl) {
                console.log('No URL for vote, using basic data')
                // Create vote from list data
                const voteRecord = {
                  congress: congress,
                  chamber: chamber as 'senate' | 'house',
                  session: rollCall.session || 1,
                  roll_number: rollCall.rollCallNumber || rollCall.rollNumber || rollCall.number,
                  vote_date: rollCall.date || rollCall.actionDate || null,
                  question: rollCall.question || rollCall.title || null,
                  description: rollCall.description || rollCall.result || null,
                  result: rollCall.result || null,
                  total_yea: rollCall.totals?.yea || rollCall.totals?.yes || rollCall.yea || 0,
                  total_nay: rollCall.totals?.nay || rollCall.totals?.no || rollCall.nay || 0,
                  total_present: rollCall.totals?.present || rollCall.present || 0,
                  total_not_voting: rollCall.totals?.notVoting || rollCall.notVoting || 0,
                }

                if (!voteRecord.roll_number) continue

                const { error: voteError } = await supabase
                  .from('votes')
                  .upsert(voteRecord, {
                    onConflict: 'congress,chamber,roll_number',
                    ignoreDuplicates: false
                  })

                if (!voteError) {
                  totalVotesProcessed++
                  console.log(`Created vote: ${chamber} roll ${voteRecord.roll_number}`)
                }
                continue
              }
              
              // Fetch vote details
              const fullUrl = voteUrl.includes('api_key') ? voteUrl : `${voteUrl}?format=json&api_key=${congressApiKey}`
              const detailResponse = await fetch(fullUrl)
              
              if (!detailResponse.ok) {
                console.log(`Skipping vote: detail fetch failed - ${detailResponse.status}`)
                continue
              }
              
              const detailData = await detailResponse.json()
              // Handle different response structures
              const voteDetail = detailData['house-vote'] || detailData['roll-call-vote'] || detailData.vote || detailData
              
              if (!voteDetail) {
                console.log('No vote detail found in response')
                continue
              }

              const voteRecord = {
                congress: congress,
                chamber: chamber as 'senate' | 'house',
                session: voteDetail.session || 1,
                roll_number: voteDetail.rollCallNumber || voteDetail.rollNumber || rollCall.rollCallNumber,
                vote_date: voteDetail.date || voteDetail.actionDate || null,
                question: voteDetail.question || null,
                description: voteDetail.description || voteDetail.title || null,
                result: voteDetail.result || null,
                total_yea: voteDetail.totals?.yea || voteDetail.totals?.yes || 0,
                total_nay: voteDetail.totals?.nay || voteDetail.totals?.no || 0,
                total_present: voteDetail.totals?.present || 0,
                total_not_voting: voteDetail.totals?.notVoting || 0,
              }

              if (!voteRecord.roll_number) {
                console.log('No roll number found')
                continue
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
                // Try to get existing vote
                const { data: existingVote } = await supabase
                  .from('votes')
                  .select('id')
                  .eq('congress', congress)
                  .eq('chamber', chamber)
                  .eq('roll_number', voteRecord.roll_number)
                  .single()
                
                if (!existingVote) {
                  console.log(`Error upserting vote: ${voteError.message}`)
                  continue
                }
                voteId = existingVote.id
              } else {
                voteId = upsertedVote.id
              }

              totalVotesProcessed++
              console.log(`Processed vote: ${chamber} roll ${voteRecord.roll_number}`)

              // Process member votes if available
              const memberVotes = voteDetail.members || voteDetail.memberVotes || []
              for (const mv of memberVotes.slice(0, 100)) { // Limit members per vote
                const bioguideId = mv.bioguideId || mv.member?.bioguideId
                const memberInfo = memberMap.get(bioguideId)
                if (!memberInfo) continue

                // Map vote position
                let position: 'yea' | 'nay' | 'present' | 'not_voting' = 'not_voting'
                const voteStr = (mv.voteResult || mv.vote || mv.votePosition || '').toLowerCase()
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
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 150))
          }

          votesInChamber += rollCallVotes.length
          offset += limit
          hasMore = rollCallVotes.length === limit
          
          console.log(`Processed ${votesInChamber} ${chamber} votes from Congress ${congress}`)
        }
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
