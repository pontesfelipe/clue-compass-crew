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

    // Fetch official website URLs and contact info for each member (in batches to avoid rate limits)
    interface MemberDetails {
      websiteUrl: string | null;
      phone: string | null;
      officeAddress: string | null;
      officeCity: string | null;
      officeState: string | null;
      officeZip: string | null;
    }
    const memberDetailsMap = new Map<string, MemberDetails>()
    const detailBatchSize = 10
    
    for (let i = 0; i < members.length; i += detailBatchSize) {
      const batch = members.slice(i, i + detailBatchSize)
      
      const detailPromises = batch.map(async (member: any) => {
        try {
          const detailUrl = `https://api.congress.gov/v3/member/${member.bioguideId}?format=json&api_key=${congressApiKey}`
          const detailRes = await fetch(detailUrl)
          if (detailRes.ok) {
            const detailData = await detailRes.json()
            const memberData = detailData.member
            
            // Get the most recent address from addressInformation
            const addressInfo = memberData?.addressInformation?.[0]
            
            return { 
              bioguideId: member.bioguideId, 
              details: {
                websiteUrl: memberData?.officialWebsiteUrl || null,
                phone: addressInfo?.phoneNumber || memberData?.directOrderName ? null : null,
                officeAddress: addressInfo?.officeAddress || null,
                officeCity: addressInfo?.city || null,
                officeState: addressInfo?.state || null,
                officeZip: addressInfo?.zipCode || null,
              } as MemberDetails
            }
          }
        } catch (e) {
          console.error(`Failed to fetch details for ${member.bioguideId}`)
        }
        return { 
          bioguideId: member.bioguideId, 
          details: { websiteUrl: null, phone: null, officeAddress: null, officeCity: null, officeState: null, officeZip: null } as MemberDetails 
        }
      })
      
      const results = await Promise.all(detailPromises)
      results.forEach(r => memberDetailsMap.set(r.bioguideId, r.details))
      
      if (i + detailBatchSize < members.length) {
        await new Promise(resolve => setTimeout(resolve, 100)) // Small delay between batches
      }
    }
    
    console.log(`Fetched ${memberDetailsMap.size} member detail records`)

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
      
      // Determine chamber - SIMPLE RULE: 
      // Senators NEVER have districts, Representatives ALWAYS do
      // This is more reliable than API chamber field which can be inconsistent
      let chamber: 'senate' | 'house' = 'house'
      
      const hasDistrict = member.district !== undefined && member.district !== null && member.district !== ''
      
      if (hasDistrict) {
        // Has a district number = House Representative
        chamber = 'house'
      } else {
        // No district = Senator (or delegate, but we handle those separately)
        // Double-check by looking at term data
        const termChamber = (latestTerm?.chamber || '').toLowerCase()
        const hasSenateInTerm = termChamber.includes('senate')
        const hasHouseInTerm = termChamber.includes('house') || termChamber.includes('representative')
        
        if (hasSenateInTerm) {
          chamber = 'senate'
        } else if (hasHouseInTerm) {
          chamber = 'house'
        } else {
          // No district and no clear chamber from terms - check ALL terms
          const anySenate = terms.some((t: any) => (t.chamber || '').toLowerCase().includes('senate'))
          if (anySenate) {
            chamber = 'senate'
          } else {
            // Last resort: no district typically means Senate
            chamber = 'senate'
          }
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
      
      // Get official website URL and contact info from details fetch
      const memberDetails = memberDetailsMap.get(member.bioguideId)
      
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
        website_url: memberDetails?.websiteUrl || null,
        phone: memberDetails?.phone || null,
        office_address: memberDetails?.officeAddress || null,
        office_city: memberDetails?.officeCity || null,
        office_state: memberDetails?.officeState || null,
        office_zip: memberDetails?.officeZip || null,
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
