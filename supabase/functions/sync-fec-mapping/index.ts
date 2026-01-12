import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FEC_API_KEY = Deno.env.get('FEC_API_KEY')
const FEC_BASE_URL = 'https://api.open.fec.gov/v1'

// State name to abbreviation mapping
const stateAbbreviations: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'American Samoa': 'AS', 'District of Columbia': 'DC', 'Guam': 'GU', 
  'Northern Mariana Islands': 'MP', 'Puerto Rico': 'PR', 'Virgin Islands': 'VI'
}

// Common nickname mappings
const nicknameMap: Record<string, string[]> = {
  'james': ['jim', 'jimmy', 'jamie'],
  'robert': ['bob', 'bobby', 'rob', 'robbie'],
  'william': ['bill', 'billy', 'will'],
  'richard': ['rick', 'ricky', 'dick'],
  'michael': ['mike', 'mikey'],
  'elizabeth': ['liz', 'beth', 'betty'],
  'theodore': ['ted', 'teddy'],
  'rafael': ['ted'], // Special case for Ted Cruz
  'alexander': ['alex'],
  'benjamin': ['ben'],
  'daniel': ['dan', 'danny'],
  'joseph': ['joe', 'joey'],
  'thomas': ['tom', 'tommy'],
  'christopher': ['chris'],
  'charles': ['charlie', 'chuck'],
  'margaret': ['meg', 'maggie', 'peggy'],
  'katherine': ['kate', 'katie', 'kathy'],
  'deborah': ['debbie', 'deb'],
  'patricia': ['pat', 'patty'],
  'nancy': ['nan'],
  'edward': ['ed', 'ted', 'ned'],
  'stephen': ['steve'],
  'steven': ['steve'],
  'matthew': ['matt'],
  'timothy': ['tim', 'timmy'],
  'joshua': ['josh'],
  'anthony': ['tony'],
  'nicholas': ['nick'],
  'kenneth': ['ken', 'kenny'],
  'gerald': ['jerry', 'gerry'],
  'donald': ['don', 'donnie'],
  'ronald': ['ron', 'ronnie'],
  'samuel': ['sam', 'sammy'],
  'jonathan': ['jon', 'john'],
  'henry': ['hank', 'harry'],
  'peter': ['pete'],
  'eugene': ['gene'],
  'gregory': ['greg'],
  'andrew': ['andy', 'drew'],
  'phillip': ['phil'],
  'raymond': ['ray'],
  'randolph': ['randy'],
  'frederick': ['fred', 'freddy'],
  'lawrence': ['larry'],
  'leonard': ['leo', 'len', 'lenny'],
  'albert': ['al', 'bert'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!FEC_API_KEY) {
      throw new Error('FEC_API_KEY is not configured')
    }

    console.log('Starting FEC member mapping sync...')

    // Get all active members
    const { data: members, error: membersError } = await supabaseClient
      .from('members')
      .select('id, bioguide_id, first_name, last_name, full_name, state, chamber, fec_candidate_id')
      .eq('in_office', true)

    if (membersError) throw membersError

    console.log(`Processing ${members?.length || 0} members...`)

    const mappings = []
    let matched = 0
    let unmatched = 0

    for (const member of members || []) {
      // If member already has FEC candidate ID from previous sync, use it
      if (member.fec_candidate_id) {
        mappings.push({
          member_id: member.id,
          bioguide_id: member.bioguide_id,
          fec_candidate_id: member.fec_candidate_id,
          fec_committee_id: null,
          match_method: 'name_state_exact',
          match_confidence: 1.0,
          valid_cycles: [2024, 2026],
          updated_at: new Date().toISOString()
        })
        matched++
        continue
      }

      console.log(`Matching FEC data for ${member.full_name}...`)

      const mapping = await matchMemberToFEC(member)
      mappings.push(mapping)

      if (mapping.match_method !== 'unmatched') {
        matched++
      } else {
        unmatched++
      }

      // Rate limiting - 4 requests per second max
      await sleep(250)
    }

    // Upsert mappings
    if (mappings.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('members_fec_mapping')
        .upsert(mappings, { onConflict: 'member_id' })

      if (upsertError) {
        console.error('Error upserting FEC mappings:', upsertError)
        throw upsertError
      }
    }

    const matchStats = {
      total: mappings.length,
      matched,
      unmatched,
      name_exact: mappings.filter(m => m.match_method === 'name_state_exact').length,
      name_fuzzy: mappings.filter(m => m.match_method === 'name_state_fuzzy').length,
    }

    console.log('FEC Mapping Statistics:', matchStats)

    return new Response(
      JSON.stringify({
        success: true,
        mappings: mappings.length,
        stats: matchStats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error syncing FEC mapping:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function matchMemberToFEC(member: any) {
  // Strategy 1: Try exact name + state match
  let match = await matchByNameAndState(member, 'exact')
  if (match && match.confidence >= 0.9) {
    return {
      member_id: member.id,
      bioguide_id: member.bioguide_id,
      fec_candidate_id: match.candidate_id,
      fec_committee_id: match.committee_id,
      match_method: 'name_state_exact',
      match_confidence: match.confidence,
      valid_cycles: match.cycles,
      updated_at: new Date().toISOString()
    }
  }

  // Strategy 2: Try fuzzy name matching
  match = await matchByNameAndState(member, 'fuzzy')
  if (match && match.confidence >= 0.7) {
    return {
      member_id: member.id,
      bioguide_id: member.bioguide_id,
      fec_candidate_id: match.candidate_id,
      fec_committee_id: match.committee_id,
      match_method: 'name_state_fuzzy',
      match_confidence: match.confidence,
      valid_cycles: match.cycles,
      updated_at: new Date().toISOString()
    }
  }

  // No match found
  console.warn(`No FEC match found for ${member.full_name} (${member.bioguide_id})`)
  return {
    member_id: member.id,
    bioguide_id: member.bioguide_id,
    fec_candidate_id: null,
    fec_committee_id: null,
    match_method: 'unmatched',
    match_confidence: 0.0,
    valid_cycles: [],
    updated_at: new Date().toISOString()
  }
}

async function matchByNameAndState(member: any, matchType: 'exact' | 'fuzzy') {
  const office = member.chamber === 'house' ? 'H' : 'S'
  
  // Convert state name to abbreviation if needed
  let state = member.state
  if (state && state.length > 2) {
    state = stateAbbreviations[state] || state
  }

  // Search FEC candidates
  const url = `${FEC_BASE_URL}/candidates/search/?api_key=${FEC_API_KEY}&state=${state}&office=${office}&name=${encodeURIComponent(member.last_name)}&candidate_status=C&sort_null_only=false&sort_hide_null=false&per_page=20`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`FEC API error for ${member.full_name}:`, response.statusText)
      return null
    }

    const data = await response.json()
    const candidates = data.results || []

    if (candidates.length === 0) {
      return null
    }

    // Try to find best match
    let bestMatch = null
    let bestScore = 0

    for (const candidate of candidates) {
      const score = calculateNameMatchScore(
        member.first_name,
        member.last_name,
        candidate.name,
        matchType
      )

      if (score > bestScore) {
        bestScore = score
        bestMatch = candidate
      }
    }

    if (!bestMatch || bestScore < 0.7) {
      return null
    }

    // Get committee ID for this candidate
    const committeeId = await getCommitteeForCandidate(bestMatch.candidate_id)

    // Get active cycles
    const cycles = bestMatch.cycles || []

    return {
      candidate_id: bestMatch.candidate_id,
      committee_id: committeeId,
      confidence: bestScore,
      cycles: cycles.filter((c: number) => c >= 2020)
    }
  } catch (error) {
    console.error(`Error searching FEC for ${member.full_name}:`, error)
    return null
  }
}

async function getCommitteeForCandidate(candidateId: string): Promise<string | null> {
  try {
    const url = `${FEC_BASE_URL}/candidate/${candidateId}/committees/?api_key=${FEC_API_KEY}&per_page=10`

    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const committees = data.results || []

    // Find principal campaign committee
    const principalCommittee = committees.find((c: any) =>
      c.designation === 'P' || c.committee_type === 'H' || c.committee_type === 'S'
    )

    return principalCommittee?.committee_id || null
  } catch {
    return null
  }
}

function calculateNameMatchScore(
  firstName: string,
  lastName: string,
  fecName: string,
  matchType: 'exact' | 'fuzzy'
): number {
  // FEC names are typically in format "LASTNAME, FIRSTNAME MIDDLE"
  const normalize = (name: string) => name.toLowerCase().trim().replace(/[^a-z\s]/g, '')
  
  const memberFirst = normalize(firstName)
  const memberLast = normalize(lastName)
  
  // Parse FEC name
  const fecNormalized = normalize(fecName)
  const fecParts = fecNormalized.split(',').map(p => p.trim())
  const fecLast = fecParts[0] || ''
  const fecFirstParts = (fecParts[1] || '').split(/\s+/)
  const fecFirst = fecFirstParts[0] || ''

  // Last name must match exactly
  if (memberLast !== fecLast) {
    return 0.0
  }

  if (matchType === 'exact') {
    // Exact first name match
    if (memberFirst === fecFirst) {
      return 1.0
    }
    return 0.0
  }

  // Fuzzy matching
  if (memberFirst === fecFirst) {
    return 0.95 // Strong match
  }

  // Check if one is an initial of the other
  if (memberFirst[0] === fecFirst[0]) {
    return 0.75 // Initial matches
  }

  // Check for nicknames
  const nicknameScore = getNicknameMatchScore(memberFirst, fecFirst)
  if (nicknameScore > 0) {
    return nicknameScore
  }

  return 0.0
}

function getNicknameMatchScore(name1: string, name2: string): number {
  for (const [formal, nicknames] of Object.entries(nicknameMap)) {
    if ((name1 === formal && nicknames.includes(name2)) ||
        (name2 === formal && nicknames.includes(name1)) ||
        (nicknames.includes(name1) && nicknames.includes(name2))) {
      return 0.85 // Good match for known nicknames
    }
  }

  return 0.0
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
