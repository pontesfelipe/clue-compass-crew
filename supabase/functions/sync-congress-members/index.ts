import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CongressMember {
  bioguideId: string
  name: string
  firstName: string
  lastName: string
  state: string
  district?: string
  party: string
  chamber: string
  url?: string
  imageUrl?: string
  terms?: {
    item: Array<{
      startYear: number
      endYear?: number
      chamber: string
      stateCode: string
      stateName: string
    }>
  }
  depiction?: {
    imageUrl: string
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

    console.log('Starting Congress member sync...')

    // Fetch all current members from Congress.gov API
    const members: any[] = []
    let offset = 0
    const limit = 250
    let hasMore = true
    
    while (hasMore) {
      const url = `https://api.congress.gov/v3/member?format=json&currentMember=true&limit=${limit}&offset=${offset}&api_key=${congressApiKey}`
      console.log(`Fetching batch at offset ${offset}...`)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Congress API error: ${response.status} - ${errorText}`)
        throw new Error(`Congress API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.members && data.members.length > 0) {
        members.push(...data.members)
        console.log(`Fetched ${data.members.length} members (total: ${members.length})`)
        
        offset += limit
        // Continue if we got a full batch
        hasMore = data.members.length === limit
      } else {
        hasMore = false
      }
    }

    console.log(`Total members fetched: ${members.length}`)

    // Transform and upsert members
    const memberRecords = members.map((member: any) => {
      // Get terms array - terms are in chronological order (oldest first)
      const terms = member.terms?.item || []
      
      // Try multiple approaches to get the most recent term
      // 1. Sort by startYear descending
      // 2. If no startYear, use the last item (chronologically most recent per API docs)
      let latestTerm = null
      if (terms.length > 0) {
        const termsWithYear = terms.filter((t: any) => t.startYear)
        if (termsWithYear.length > 0) {
          latestTerm = [...termsWithYear].sort((a: any, b: any) => (b.startYear || 0) - (a.startYear || 0))[0]
        } else {
          // Fallback: use last item in array (docs say chronological order)
          latestTerm = terms[terms.length - 1]
        }
      }
      
      // Map party code - check partyName which is more reliable
      let party: 'D' | 'R' | 'I' = 'I'
      const partyStr = (member.partyName || member.party || '').toLowerCase()
      if (partyStr.includes('democrat')) party = 'D'
      else if (partyStr.includes('republican')) party = 'R'
      
      // Determine chamber using multiple methods:
      // 1. From latest term's chamber field
      // 2. If member has a district number, they're in the House
      // 3. Check all terms for any Senate service (senators don't have districts)
      let chamber: 'senate' | 'house' = 'house' // default
      
      const termChamber = (latestTerm?.chamber || '').toLowerCase()
      if (termChamber.includes('senate')) {
        chamber = 'senate'
      } else if (termChamber.includes('house') || termChamber.includes('representative')) {
        chamber = 'house'
      } else {
        // Fallback: check if ANY term is Senate (for members who switched chambers)
        // Use the most recent Senate term if they have one
        const senateTerm = terms.find((t: any) => 
          (t.chamber || '').toLowerCase().includes('senate')
        )
        if (senateTerm && !member.district) {
          // If they have a senate term and no current district, likely a senator
          chamber = 'senate'
        }
        // If member has a district, they're definitely in the House
        if (member.district !== undefined && member.district !== null) {
          chamber = 'house'
        }
      }
      
      console.log(`Member ${member.name}: termChamber=${latestTerm?.chamber}, district=${member.district}, mapped=${chamber}, terms=${JSON.stringify(terms.slice(-2))}`)
      
      // Parse names correctly - API gives firstName and lastName directly
      // But also has name in "LastName, FirstName" format as backup
      let firstName = member.firstName || ''
      let lastName = member.lastName || ''
      
      // If name is in "LastName, FirstName" format, parse it
      if (member.name && member.name.includes(',')) {
        const parts = member.name.split(',').map((p: string) => p.trim())
        if (!lastName) lastName = parts[0] || ''
        if (!firstName) firstName = parts[1] || ''
      }
      
      // Get state - prefer stateName (full name) over stateCode
      const state = latestTerm?.stateName || member.state || latestTerm?.stateCode || ''
      
      return {
        bioguide_id: member.bioguideId,
        first_name: firstName,
        last_name: lastName,
        full_name: member.name || `${firstName} ${lastName}`,
        state,
        district: member.district || latestTerm?.district?.toString() || null,
        party,
        chamber,
        image_url: member.depiction?.imageUrl || null,
        website_url: member.url || null,
        in_office: true,
        start_date: latestTerm?.startYear ? `${latestTerm.startYear}-01-03` : null,
        updated_at: new Date().toISOString(),
      }
    })

    console.log(`Upserting ${memberRecords.length} member records...`)

    // Upsert in batches of 100
    const batchSize = 100
    let inserted = 0
    let updated = 0

    for (let i = 0; i < memberRecords.length; i += batchSize) {
      const batch = memberRecords.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('members')
        .upsert(batch, { 
          onConflict: 'bioguide_id',
          ignoreDuplicates: false 
        })
        .select()

      if (error) {
        console.error(`Batch upsert error: ${JSON.stringify(error)}`)
        throw error
      }

      inserted += batch.length
      console.log(`Processed ${inserted}/${memberRecords.length} members`)
    }

    // Generate default scores for members without scores
    console.log('Generating default scores for new members...')
    
    const { data: membersWithoutScores } = await supabase
      .from('members')
      .select('id')
      .not('id', 'in', 
        supabase.from('member_scores').select('member_id')
      )

    if (membersWithoutScores && membersWithoutScores.length > 0) {
      const scoreRecords = membersWithoutScores.map(m => ({
        member_id: m.id,
        user_id: null,
        overall_score: Math.floor(Math.random() * 40) + 50, // Random score 50-90 for demo
        productivity_score: Math.floor(Math.random() * 40) + 50,
        attendance_score: Math.floor(Math.random() * 30) + 70,
        bipartisanship_score: Math.floor(Math.random() * 40) + 40,
        issue_alignment_score: Math.floor(Math.random() * 40) + 50,
        votes_cast: Math.floor(Math.random() * 500) + 100,
        votes_missed: Math.floor(Math.random() * 50),
        bills_sponsored: Math.floor(Math.random() * 20),
        bills_cosponsored: Math.floor(Math.random() * 100),
        bills_enacted: Math.floor(Math.random() * 5),
        bipartisan_bills: Math.floor(Math.random() * 10),
      }))

      const { error: scoresError } = await supabase
        .from('member_scores')
        .insert(scoreRecords)

      if (scoresError) {
        console.error(`Scores insert error: ${JSON.stringify(scoresError)}`)
      } else {
        console.log(`Created ${scoreRecords.length} score records`)
      }
    }

    const result = {
      success: true,
      membersProcessed: memberRecords.length,
      message: `Successfully synced ${memberRecords.length} members from Congress.gov`
    }

    console.log('Sync completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Sync error:', errorMessage)
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
