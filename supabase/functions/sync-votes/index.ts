import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// State abbreviation to full name mapping
const stateAbbrToFull: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
}

function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

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

function parseSenateDate(dateStr: string): string | null {
  if (!dateStr) return null
  const months: { [key: string]: string } = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  }
  const match = dateStr.match(/(\w+)\s+(\d{1,2}),\s*(\d{4})/)
  if (!match) return null
  const month = months[match[1].toLowerCase()]
  const day = match[2].padStart(2, '0')
  const year = match[3]
  if (!month) return null
  return `${year}-${month}-${day}`
}

function normalizePosition(position: string): { normalized: 'support' | 'oppose' | 'neutral' | 'absent', weight: number } {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const mode = url.searchParams.get('mode') || 'delta'
    const chamber = url.searchParams.get('chamber') || 'both'

    console.log(`Starting votes sync (mode: ${mode}, chamber: ${chamber})...`)

    const { data: members } = await supabase.from('members').select('id, bioguide_id, chamber').eq('in_office', true)
    const memberMap = new Map(members?.map(m => [m.bioguide_id, { id: m.id, chamber: m.chamber }]) || [])
    console.log(`Loaded ${memberMap.size} members for mapping`)

    let totalVotesProcessed = 0
    let totalMemberVotesCreated = 0

    if (chamber === 'house' || chamber === 'both') {
      const houseResult = await syncHouseVotes(supabase, memberMap, mode)
      totalVotesProcessed += houseResult.votesProcessed
      totalMemberVotesCreated += houseResult.memberVotesCreated
    }

    if (chamber === 'senate' || chamber === 'both') {
      const senateResult = await syncSenateVotes(supabase, mode)
      totalVotesProcessed += senateResult.votesProcessed
      totalMemberVotesCreated += senateResult.memberVotesCreated
    }

    // Get total votes for accurate cumulative progress
    const { count: totalVotesInDb } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true });

    await supabase.from('sync_progress').upsert({
      id: 'votes',
      last_run_at: new Date().toISOString(),
      status: 'complete',
      total_processed: totalVotesInDb || totalVotesProcessed,
      current_offset: 0,
      metadata: {
        last_batch_votes: totalVotesProcessed,
        last_batch_member_votes: totalMemberVotesCreated,
      }
    }, { onConflict: 'id' })

    const result = {
      success: true, mode, chamber,
      votesProcessed: totalVotesProcessed,
      memberVotesCreated: totalMemberVotesCreated,
      message: `Synced ${totalVotesProcessed} votes with ${totalMemberVotesCreated} member vote records`
    }
    console.log('Votes sync completed:', result)

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Votes sync error:', error)
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function syncHouseVotes(supabase: any, memberMap: Map<string, { id: string; chamber: string }>, mode: string) {
  const year = 2025
  let totalVotesProcessed = 0, totalMemberVotesCreated = 0
  const maxRolls = mode === 'full' ? 500 : 50

  for (let rollNumber = 1; rollNumber <= maxRolls; rollNumber++) {
    try {
      const paddedRoll = rollNumber.toString().padStart(3, '0')
      const xmlUrl = `https://clerk.house.gov/evs/${year}/roll${paddedRoll}.xml`
      const response = await fetch(xmlUrl)
      if (!response.ok) { if (response.status === 404) break; continue }
      const xmlText = await response.text()

      const congress = parseInt(extractXmlValue(xmlText, 'congress') || '119')
      const session = parseInt((extractXmlValue(xmlText, 'session') || '1').replace(/\D/g, '')) || 1
      const voteDate = parseClerkDate(extractXmlValue(xmlText, 'action-date') || '')
      if (!voteDate) continue

      const voteRecord = {
        congress, chamber: 'house' as const, session, roll_number: rollNumber, vote_date: voteDate,
        question: extractXmlValue(xmlText, 'vote-question'),
        description: extractXmlValue(xmlText, 'vote-desc'),
        result: extractXmlValue(xmlText, 'vote-result'),
        total_yea: parseInt(extractXmlValue(xmlText, 'yea-total') || '0'),
        total_nay: parseInt(extractXmlValue(xmlText, 'nay-total') || '0'),
        total_present: parseInt(extractXmlValue(xmlText, 'present-total') || '0'),
        total_not_voting: parseInt(extractXmlValue(xmlText, 'not-voting-total') || '0'),
        raw: { source: 'house_clerk', xmlUrl }
      }

      const { data: upsertedVote, error: voteError } = await supabase.from('votes').upsert(voteRecord, { onConflict: 'congress,chamber,roll_number' }).select('id').single()
      let voteId = upsertedVote?.id
      if (voteError) {
        const { data: existing } = await supabase.from('votes').select('id').eq('congress', congress).eq('chamber', 'house').eq('roll_number', rollNumber).single()
        if (!existing) continue
        voteId = existing.id
      }
      totalVotesProcessed++

      const recordedVotePattern = /<recorded-vote>\s*<legislator\s+name-id="([A-Z]\d{6})"[^>]*>[^<]*<\/legislator>\s*<vote>([^<]*)<\/vote>\s*<\/recorded-vote>/gi
      const memberVoteRecords: any[] = []
      let match
      while ((match = recordedVotePattern.exec(xmlText)) !== null) {
        const memberInfo = memberMap.get(match[1])
        if (!memberInfo) continue
        const pos = match[2].toLowerCase()
        let position: 'yea' | 'nay' | 'present' | 'not_voting' = pos === 'yea' || pos === 'yes' ? 'yea' : pos === 'nay' || pos === 'no' ? 'nay' : pos === 'present' ? 'present' : 'not_voting'
        const { normalized, weight } = normalizePosition(match[2])
        memberVoteRecords.push({ vote_id: voteId, member_id: memberInfo.id, position, position_normalized: normalized, weight })
      }

      if (memberVoteRecords.length > 0) {
        const { error } = await supabase.from('member_votes').upsert(memberVoteRecords, { onConflict: 'vote_id,member_id', ignoreDuplicates: false })
        if (!error) totalMemberVotesCreated += memberVoteRecords.length
      }
      console.log(`House roll ${rollNumber}: ${memberVoteRecords.length} member votes`)
      await new Promise(r => setTimeout(r, 100))
    } catch (e) { console.log(`Error processing house roll ${rollNumber}: ${e}`) }
  }
  return { votesProcessed: totalVotesProcessed, memberVotesCreated: totalMemberVotesCreated }
}

async function syncSenateVotes(supabase: any, mode: string) {
  const congress = 119, session = 1
  let totalVotesProcessed = 0, totalMemberVotesCreated = 0

  const { data: senators } = await supabase.from('members').select('id, last_name, state').eq('chamber', 'senate').eq('in_office', true)
  const senatorByNameState = new Map<string, string>()
  for (const s of senators || []) senatorByNameState.set(`${s.last_name.toLowerCase()}|${s.state.toLowerCase()}`, s.id)
  console.log(`Built senator lookup with ${senatorByNameState.size} senators`)

  const maxRolls = mode === 'full' ? 500 : 50
  for (let rollNumber = 1; rollNumber <= maxRolls; rollNumber++) {
    try {
      const paddedRoll = rollNumber.toString().padStart(5, '0')
      const xmlUrl = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${paddedRoll}.xml`
      const response = await fetch(xmlUrl)
      if (!response.ok) { if (response.status === 404) break; continue }
      const xmlText = await response.text()

      const voteDate = parseSenateDate(extractXmlValue(xmlText, 'vote_date') || '')
      if (!voteDate) continue

      const voteRecord = {
        congress, chamber: 'senate' as const, session, roll_number: rollNumber, vote_date: voteDate,
        question: extractXmlValue(xmlText, 'vote_question_text') || extractXmlValue(xmlText, 'question'),
        description: extractXmlValue(xmlText, 'vote_title'),
        result: extractXmlValue(xmlText, 'vote_result_text') || extractXmlValue(xmlText, 'vote_result'),
        total_yea: parseInt(extractXmlValue(xmlText, 'yeas') || '0'),
        total_nay: parseInt(extractXmlValue(xmlText, 'nays') || '0'),
        total_present: parseInt(extractXmlValue(xmlText, 'present') || '0'),
        total_not_voting: parseInt(extractXmlValue(xmlText, 'absent') || '0'),
        raw: { source: 'senate_gov', xmlUrl }
      }

      const { data: upsertedVote, error: voteError } = await supabase.from('votes').upsert(voteRecord, { onConflict: 'congress,chamber,roll_number' }).select('id').single()
      let voteId = upsertedVote?.id
      if (voteError) {
        const { data: existing } = await supabase.from('votes').select('id').eq('congress', congress).eq('chamber', 'senate').eq('roll_number', rollNumber).single()
        if (!existing) continue
        voteId = existing.id
      }
      totalVotesProcessed++

      // Parse member votes - match by last_name + state
      const memberPattern = /<member>\s*<member_full>[^<]*<\/member_full>\s*<last_name>([^<]+)<\/last_name>\s*<first_name>[^<]*<\/first_name>\s*<party>[^<]*<\/party>\s*<state>([^<]+)<\/state>\s*<vote_cast>([^<]*)<\/vote_cast>/gi
      const memberVoteRecords: any[] = []
      let match
      while ((match = memberPattern.exec(xmlText)) !== null) {
        const lastName = match[1].trim()
        const stateAbbr = match[2].trim()
        const stateFull = stateAbbrToFull[stateAbbr] || stateAbbr
        const memberId = senatorByNameState.get(`${lastName.toLowerCase()}|${stateFull.toLowerCase()}`)
        if (!memberId) continue

        const pos = match[3].toLowerCase()
        let position: 'yea' | 'nay' | 'present' | 'not_voting' = pos === 'yea' ? 'yea' : pos === 'nay' ? 'nay' : pos === 'present' ? 'present' : 'not_voting'
        const { normalized, weight } = normalizePosition(match[3])
        memberVoteRecords.push({ vote_id: voteId, member_id: memberId, position, position_normalized: normalized, weight })
      }

      if (memberVoteRecords.length > 0) {
        const { error } = await supabase.from('member_votes').upsert(memberVoteRecords, { onConflict: 'vote_id,member_id', ignoreDuplicates: false })
        if (!error) totalMemberVotesCreated += memberVoteRecords.length
      }
      console.log(`Senate roll ${rollNumber}: ${memberVoteRecords.length} member votes`)
      await new Promise(r => setTimeout(r, 100))
    } catch (e) { console.log(`Error processing senate roll ${rollNumber}: ${e}`) }
  }
  return { votesProcessed: totalVotesProcessed, memberVotesCreated: totalMemberVotesCreated }
}