import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Parse XML helper - simple XML text extraction
function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

// Parse date like "3-Jan-2025" to "2025-01-03"
function parseClerkDate(dateStr: string): string | null {
  if (!dateStr) return null
  
  const months: { [key: string]: string } = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  }
  
  const match = dateStr.match(/(\d{1,2})-(\w{3})-(\d{4})/)
  if (!match) return null
  
  const day = match[1].padStart(2, '0')
  const month = months[match[2]]
  const year = match[3]
  
  if (!month) return null
  
  return `${year}-${month}-${day}`
}

// Normalize vote position to standard format
function normalizePosition(position: string): { 
  normalized: 'support' | 'oppose' | 'neutral' | 'absent',
  weight: number 
} {
  const pos = position.toLowerCase().trim()
  
  if (pos === 'yea' || pos === 'yes' || pos === 'aye' || pos === 'for') {
    return { normalized: 'support', weight: 1 }
  } else if (pos === 'nay' || pos === 'no' || pos === 'against') {
    return { normalized: 'oppose', weight: -1 }
  } else if (pos === 'present') {
    return { normalized: 'neutral', weight: 0 }
  } else {
    return { normalized: 'absent', weight: 0 }
  }
}

// Log sync run to api_sync_runs table
async function logSyncRun(
  supabase: any,
  sourceId: string,
  jobType: string,
  status: 'running' | 'success' | 'failed' | 'partial',
  itemsProcessed: number,
  errorMessage?: string,
  metadata?: Record<string, unknown>
) {
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
    const congressApiKey = Deno.env.get('CONGRESS_GOV_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse query params for mode
    const url = new URL(req.url)
    const mode = url.searchParams.get('mode') || 'delta' // 'full' or 'delta'
    const chamber = url.searchParams.get('chamber') || 'both' // 'house', 'senate', or 'both'

    console.log(`Starting votes sync (mode: ${mode}, chamber: ${chamber})...`)

    // Get api_sources id for house_clerk
    const { data: sourceData } = await supabase
      .from('api_sources')
      .select('id')
      .eq('name', 'house_clerk')
      .single()

    const sourceId = sourceData?.id

    // Get all members from DB to map bioguide_id to member id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id, chamber')
      .eq('in_office', true)
    
    if (membersError) throw membersError
    
    const memberMap = new Map(members?.map(m => [m.bioguide_id, { id: m.id, chamber: m.chamber }]) || [])
    console.log(`Loaded ${memberMap.size} members for mapping`)

    let totalVotesProcessed = 0
    let totalMemberVotesCreated = 0

    // Process House votes from Clerk XML
    if (chamber === 'house' || chamber === 'both') {
      const houseResult = await syncHouseVotes(supabase, memberMap, mode)
      totalVotesProcessed += houseResult.votesProcessed
      totalMemberVotesCreated += houseResult.memberVotesCreated
    }

    // Process Senate votes from Congress.gov API
    if ((chamber === 'senate' || chamber === 'both') && congressApiKey) {
      const senateResult = await syncSenateVotes(supabase, memberMap, congressApiKey, mode)
      totalVotesProcessed += senateResult.votesProcessed
      totalMemberVotesCreated += senateResult.memberVotesCreated
    }

    // Log successful sync run
    if (sourceId) {
      await logSyncRun(supabase, sourceId, 'votes', 'success', totalVotesProcessed, undefined, {
        mode,
        chamber,
        memberVotesCreated: totalMemberVotesCreated
      })
    }

    // Update sync progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'votes',
        last_run_at: new Date().toISOString(),
        status: 'complete',
        total_processed: totalVotesProcessed,
        current_offset: 0,
      }, { onConflict: 'id' })

    const result = {
      success: true,
      mode,
      chamber,
      votesProcessed: totalVotesProcessed,
      memberVotesCreated: totalMemberVotesCreated,
      message: `Synced ${totalVotesProcessed} votes with ${totalMemberVotesCreated} member vote records`
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

// Sync House votes from Clerk XML
async function syncHouseVotes(
  supabase: any,
  memberMap: Map<string, { id: string; chamber: string }>,
  mode: string
): Promise<{ votesProcessed: number; memberVotesCreated: number }> {
  const year = 2025
  let totalVotesProcessed = 0
  let totalMemberVotesCreated = 0

  // Determine roll range based on mode
  const maxRolls = mode === 'full' ? 500 : 50
  const rollsToFetch = Array.from({ length: maxRolls }, (_, i) => i + 1)

  for (const rollNumber of rollsToFetch) {
    try {
      const paddedRoll = rollNumber.toString().padStart(3, '0')
      const xmlUrl = `https://clerk.house.gov/evs/${year}/roll${paddedRoll}.xml`
      
      const response = await fetch(xmlUrl)
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`House roll ${rollNumber} not found, stopping`)
          break
        }
        continue
      }
      
      const xmlText = await response.text()
      
      // Parse vote metadata
      const congress = parseInt(extractXmlValue(xmlText, 'congress') || '119')
      const sessionStr = extractXmlValue(xmlText, 'session') || '1'
      const session = parseInt(sessionStr.replace(/\D/g, '')) || 1
      const chamber = 'house' as const
      
      // Extract date
      const actionDateStr = extractXmlValue(xmlText, 'action-date')
      const voteDate = parseClerkDate(actionDateStr || '')
      
      if (!voteDate) {
        console.log(`House roll ${rollNumber}: could not parse date "${actionDateStr}", skipping`)
        continue
      }
      
      const question = extractXmlValue(xmlText, 'vote-question') || null
      const description = extractXmlValue(xmlText, 'vote-desc') || null
      const result = extractXmlValue(xmlText, 'vote-result') || null
      
      // Extract totals
      const totalsByVoteMatch = xmlText.match(/<totals-by-vote>[\s\S]*?<\/totals-by-vote>/i)
      const totalsSection = totalsByVoteMatch ? totalsByVoteMatch[0] : xmlText
      
      const yeaTotal = parseInt(extractXmlValue(totalsSection, 'yea-total') || '0')
      const nayTotal = parseInt(extractXmlValue(totalsSection, 'nay-total') || '0')
      const presentTotal = parseInt(extractXmlValue(totalsSection, 'present-total') || '0')
      const notVotingTotal = parseInt(extractXmlValue(totalsSection, 'not-voting-total') || '0')

      const voteRecord = {
        congress,
        chamber,
        session,
        roll_number: rollNumber,
        vote_date: voteDate,
        question,
        description,
        result,
        total_yea: yeaTotal,
        total_nay: nayTotal,
        total_present: presentTotal,
        total_not_voting: notVotingTotal,
        raw: { source: 'house_clerk', xmlUrl }
      }

      // Upsert vote
      const { data: upsertedVote, error: voteError } = await supabase
        .from('votes')
        .upsert(voteRecord, { onConflict: 'congress,chamber,roll_number' })
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

      // Parse individual member votes with position_normalized and weight
      const recordedVotePattern = /<recorded-vote>\s*<legislator\s+name-id="([A-Z]\d{6})"[^>]*>[^<]*<\/legislator>\s*<vote>([^<]*)<\/vote>\s*<\/recorded-vote>/gi
      
      let match
      const memberVoteRecords: Array<{
        vote_id: string
        member_id: string
        position: 'yea' | 'nay' | 'present' | 'not_voting'
        position_normalized: string
        weight: number
      }> = []
      
      while ((match = recordedVotePattern.exec(xmlText)) !== null) {
        const bioguideId = match[1]
        const votePosition = match[2].trim()
        
        const memberInfo = memberMap.get(bioguideId)
        if (!memberInfo) continue

        // Map position
        let position: 'yea' | 'nay' | 'present' | 'not_voting' = 'not_voting'
        const posLower = votePosition.toLowerCase()
        if (posLower === 'yea' || posLower === 'yes' || posLower === 'aye') {
          position = 'yea'
        } else if (posLower === 'nay' || posLower === 'no') {
          position = 'nay'
        } else if (posLower === 'present') {
          position = 'present'
        }

        const { normalized, weight } = normalizePosition(votePosition)

        memberVoteRecords.push({
          vote_id: voteId,
          member_id: memberInfo.id,
          position,
          position_normalized: normalized,
          weight
        })
      }
      
      // Batch upsert member votes
      if (memberVoteRecords.length > 0) {
        const { error: mvError } = await supabase
          .from('member_votes')
          .upsert(memberVoteRecords, {
            onConflict: 'vote_id,member_id',
            ignoreDuplicates: false
          })

        if (!mvError) {
          totalMemberVotesCreated += memberVoteRecords.length
        } else {
          console.log(`Error inserting member votes for house roll ${rollNumber}: ${mvError.message}`)
        }
      }
      
      console.log(`House roll ${rollNumber}: ${memberVoteRecords.length} member votes`)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (voteError) {
      console.log(`Error processing house roll ${rollNumber}: ${voteError}`)
    }
  }

  console.log(`House sync complete: ${totalVotesProcessed} votes, ${totalMemberVotesCreated} member votes`)
  return { votesProcessed: totalVotesProcessed, memberVotesCreated: totalMemberVotesCreated }
}

// Sync Senate votes from Congress.gov API
async function syncSenateVotes(
  supabase: any,
  memberMap: Map<string, { id: string; chamber: string }>,
  congressApiKey: string,
  mode: string
): Promise<{ votesProcessed: number; memberVotesCreated: number }> {
  let totalVotesProcessed = 0
  let totalMemberVotesCreated = 0

  try {
    const congress = 119
    const session = 1
    
    // Fetch Senate votes from Congress.gov API
    const limit = mode === 'full' ? 250 : 50
    const votesUrl = `https://api.congress.gov/v3/vote/senate/${congress}/${session}?format=json&limit=${limit}&api_key=${congressApiKey}`
    
    console.log('Fetching Senate votes from Congress.gov...')
    
    const response = await fetch(votesUrl)
    if (!response.ok) {
      console.log(`Failed to fetch Senate votes: ${response.status}`)
      return { votesProcessed: 0, memberVotesCreated: 0 }
    }
    
    const data = await response.json()
    const votes = data.votes || []
    
    console.log(`Found ${votes.length} Senate votes`)
    
    for (const vote of votes) {
      try {
        const rollNumber = vote.rollNumber || vote.number
        if (!rollNumber) continue
        
        const voteDate = vote.date?.split('T')[0]
        if (!voteDate) continue
        
        const voteRecord = {
          congress,
          chamber: 'senate' as const,
          session,
          roll_number: rollNumber,
          vote_date: voteDate,
          question: vote.question || vote.title || null,
          description: vote.description || null,
          result: vote.result || null,
          total_yea: vote.yea?.count || vote.yea || 0,
          total_nay: vote.nay?.count || vote.nay || 0,
          total_present: vote.present?.count || 0,
          total_not_voting: vote.notVoting?.count || vote.notVoting || 0,
          raw: { source: 'congress_gov', voteUrl: vote.url }
        }
        
        // Upsert vote
        const { data: upsertedVote, error: voteError } = await supabase
          .from('votes')
          .upsert(voteRecord, { onConflict: 'congress,chamber,roll_number' })
          .select('id')
          .single()
        
        let voteId: string
        if (voteError) {
          const { data: existingVote } = await supabase
            .from('votes')
            .select('id')
            .eq('congress', congress)
            .eq('chamber', 'senate')
            .eq('roll_number', rollNumber)
            .single()
          
          if (!existingVote) {
            console.log(`Error upserting senate vote ${rollNumber}: ${voteError.message}`)
            continue
          }
          voteId = existingVote.id
        } else {
          voteId = upsertedVote.id
        }
        
        totalVotesProcessed++
        
        // Fetch individual vote positions if available
        if (vote.url) {
          try {
            const voteDetailUrl = `${vote.url}?format=json&api_key=${congressApiKey}`
            const detailResponse = await fetch(voteDetailUrl)
            
            if (detailResponse.ok) {
              const detailData = await detailResponse.json()
              const positions = detailData.vote?.positions || []
              
              const memberVoteRecords: Array<{
                vote_id: string
                member_id: string
                position: 'yea' | 'nay' | 'present' | 'not_voting'
                position_normalized: string
                weight: number
              }> = []
              
              for (const pos of positions) {
                const bioguideId = pos.member?.bioguideId
                if (!bioguideId) continue
                
                const memberInfo = memberMap.get(bioguideId)
                if (!memberInfo) continue
                
                const votePosition = pos.votePosition || pos.position || ''
                let position: 'yea' | 'nay' | 'present' | 'not_voting' = 'not_voting'
                const posLower = votePosition.toLowerCase()
                
                if (posLower === 'yea' || posLower === 'yes' || posLower === 'aye') {
                  position = 'yea'
                } else if (posLower === 'nay' || posLower === 'no') {
                  position = 'nay'
                } else if (posLower === 'present') {
                  position = 'present'
                }
                
                const { normalized, weight } = normalizePosition(votePosition)
                
                memberVoteRecords.push({
                  vote_id: voteId,
                  member_id: memberInfo.id,
                  position,
                  position_normalized: normalized,
                  weight
                })
              }
              
              if (memberVoteRecords.length > 0) {
                const { error: mvError } = await supabase
                  .from('member_votes')
                  .upsert(memberVoteRecords, {
                    onConflict: 'vote_id,member_id',
                    ignoreDuplicates: false
                  })
                
                if (!mvError) {
                  totalMemberVotesCreated += memberVoteRecords.length
                }
              }
            }
          } catch (e) {
            console.log(`Error fetching senate vote detail: ${e}`)
          }
        }
        
        console.log(`Senate roll ${rollNumber}: processed`)
        await new Promise(resolve => setTimeout(resolve, 150))
        
      } catch (e) {
        console.log(`Error processing senate vote: ${e}`)
      }
    }
    
  } catch (error) {
    console.log(`Senate votes sync error: ${error}`)
  }

  console.log(`Senate sync complete: ${totalVotesProcessed} votes, ${totalMemberVotesCreated} member votes`)
  return { votesProcessed: totalVotesProcessed, memberVotesCreated: totalMemberVotesCreated }
}
