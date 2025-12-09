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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting votes sync with member positions from Clerk XML...')

    // Get all members from DB to map bioguide_id to member id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id, chamber')
      .eq('in_office', true)
    
    if (membersError) throw membersError
    
    const memberMap = new Map(members?.map(m => [m.bioguide_id, { id: m.id, chamber: m.chamber }]) || [])
    console.log(`Loaded ${memberMap.size} members for mapping`)

    // Use 2025 for 119th Congress
    const year = 2025
    let totalVotesProcessed = 0
    let totalMemberVotesCreated = 0

    // Fetch votes - process roll 1-30 to avoid timeout
    const rollsToFetch = Array.from({ length: 30 }, (_, i) => i + 1)
    
    for (const rollNumber of rollsToFetch) {
      try {
        const paddedRoll = rollNumber.toString().padStart(3, '0')
        const xmlUrl = `https://clerk.house.gov/evs/${year}/roll${paddedRoll}.xml`
        
        console.log(`Fetching roll ${rollNumber}...`)
        
        const response = await fetch(xmlUrl)
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`Roll ${rollNumber} not found, stopping`)
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
        
        // Extract date - format is "3-Jan-2025"
        const actionDateStr = extractXmlValue(xmlText, 'action-date')
        const voteDate = parseClerkDate(actionDateStr || '')
        
        if (!voteDate) {
          console.log(`Roll ${rollNumber}: could not parse date "${actionDateStr}", skipping`)
          continue
        }
        
        const question = extractXmlValue(xmlText, 'vote-question') || null
        const description = extractXmlValue(xmlText, 'vote-desc') || null
        const result = extractXmlValue(xmlText, 'vote-result') || null
        
        // Extract totals from totals-by-vote section
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
        console.log(`Processed vote: roll ${rollNumber}, date: ${voteDate}, id: ${voteId}`)

        // Parse individual member votes
        // Format: <recorded-vote><legislator name-id="A000370" ...>Name</legislator><vote>Present</vote></recorded-vote>
        const recordedVotePattern = /<recorded-vote>\s*<legislator\s+name-id="([A-Z]\d{6})"[^>]*>[^<]*<\/legislator>\s*<vote>([^<]*)<\/vote>\s*<\/recorded-vote>/gi
        
        let match
        let memberVotesInRoll = 0
        const memberVoteRecords: Array<{ vote_id: string; member_id: string; position: 'yea' | 'nay' | 'present' | 'not_voting' }> = []
        
        while ((match = recordedVotePattern.exec(xmlText)) !== null) {
          const bioguideId = match[1]
          const votePosition = match[2].toLowerCase().trim()
          
          const memberInfo = memberMap.get(bioguideId)
          if (!memberInfo) continue

          // Map position
          let position: 'yea' | 'nay' | 'present' | 'not_voting' = 'not_voting'
          if (votePosition === 'yea' || votePosition === 'yes' || votePosition === 'aye') {
            position = 'yea'
          } else if (votePosition === 'nay' || votePosition === 'no') {
            position = 'nay'
          } else if (votePosition === 'present') {
            position = 'present'
          } else if (votePosition === 'not voting') {
            position = 'not_voting'
          }

          memberVoteRecords.push({
            vote_id: voteId,
            member_id: memberInfo.id,
            position: position,
          })
        }
        
        // Batch upsert member votes
        if (memberVoteRecords.length > 0) {
          const { error: mvError } = await supabase
            .from('member_votes')
            .upsert(memberVoteRecords, {
              onConflict: 'vote_id,member_id',
              ignoreDuplicates: true
            })

          if (!mvError) {
            memberVotesInRoll = memberVoteRecords.length
            totalMemberVotesCreated += memberVotesInRoll
          } else {
            console.log(`Error inserting member votes for roll ${rollNumber}: ${mvError.message}`)
          }
        }
        
        console.log(`Roll ${rollNumber}: ${memberVotesInRoll} member votes recorded`)
        
        await new Promise(resolve => setTimeout(resolve, 150))
        
      } catch (voteError) {
        console.log(`Error processing roll ${rollNumber}: ${voteError}`)
      }
    }

    const result = {
      success: true,
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
