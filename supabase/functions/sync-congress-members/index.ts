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
      const latestTerm = member.terms?.item?.[0]
      
      // Map party code - check partyName which is more reliable
      let party: 'D' | 'R' | 'I' = 'I'
      const partyStr = (member.partyName || member.party || '').toLowerCase()
      if (partyStr.includes('democrat')) party = 'D'
      else if (partyStr.includes('republican')) party = 'R'
      
      // Map chamber
      const chamber: 'senate' | 'house' = latestTerm?.chamber?.toLowerCase() === 'senate' ? 'senate' : 'house'
      
      return {
        bioguide_id: member.bioguideId,
        first_name: member.firstName || member.name?.split(' ')[0] || '',
        last_name: member.lastName || member.name?.split(' ').slice(-1)[0] || '',
        full_name: member.name || `${member.firstName} ${member.lastName}`,
        state: latestTerm?.stateCode || member.state || '',
        district: member.district || null,
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
