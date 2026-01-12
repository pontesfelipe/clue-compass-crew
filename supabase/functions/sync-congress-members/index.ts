import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchJson, fetchWithRetry, HttpClientConfig, processBatch } from '../_shared/httpClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVIDER = 'congress'
const DATASET = 'members'
const HTTP_CONFIG: HttpClientConfig = {
  maxRetries: 5,
  baseDelayMs: 2000,
  maxConcurrency: 3,
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

interface MemberDetails {
  websiteUrl: string | null
  phone: string | null
  officeAddress: string | null
  officeCity: string | null
  officeState: string | null
  officeZip: string | null
}

// Helper function to check if syncs are paused
async function isSyncPaused(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('feature_toggles')
      .select('enabled')
      .eq('id', 'sync_paused')
      .single()
    
    if (error || !data) return false
    return data.enabled === true
  } catch {
    return false
  }
}

// Get watermark from sync_state
async function getWatermark(supabase: any): Promise<{ lastSuccessAt: string | null }> {
  const { data } = await supabase
    .from('sync_state')
    .select('last_success_at')
    .eq('provider', PROVIDER)
    .eq('dataset', DATASET)
    .eq('scope_key', 'global')
    .single()
  
  return { lastSuccessAt: data?.last_success_at || null }
}

// Update watermark in sync_state
async function updateWatermark(supabase: any, recordsTotal: number) {
  await supabase
    .from('sync_state')
    .upsert({
      provider: PROVIDER,
      dataset: DATASET,
      scope_key: 'global',
      last_success_at: new Date().toISOString(),
      records_total: recordsTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider,dataset,scope_key' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let apiCalls = 0
  let totalWaitMs = 0

  try {
    const congressApiKey = Deno.env.get('CONGRESS_GOV_API_KEY')
    if (!congressApiKey) {
      throw new Error('CONGRESS_GOV_API_KEY is not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if syncs are paused
    if (await isSyncPaused(supabase)) {
      console.log('Sync paused - skipping congress members sync')
      return new Response(
        JSON.stringify({ success: false, message: 'Syncs are currently paused', paused: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting Congress member sync...')

    // Fetch all current members from Congress.gov API
    const members: any[] = []
    let offset = 0
    const limit = 250
    let hasMore = true
    
    while (hasMore) {
      const url = `https://api.congress.gov/v3/member?format=json&currentMember=true&limit=${limit}&offset=${offset}&api_key=${congressApiKey}`
      console.log(`Fetching batch at offset ${offset}...`)
      
      try {
        const { data, metrics } = await fetchJson<any>(url, {}, PROVIDER, HTTP_CONFIG)
        apiCalls++
        totalWaitMs += metrics.totalWaitMs
        
        if (data.members && data.members.length > 0) {
          members.push(...data.members)
          console.log(`Fetched ${data.members.length} members (total: ${members.length})`)
          
          offset += limit
          hasMore = data.members.length === limit
        } else {
          hasMore = false
        }
      } catch (fetchError) {
        console.error(`Error fetching members at offset ${offset}:`, fetchError)
        hasMore = false
      }
    }

    console.log(`Total members fetched: ${members.length}`)

    // Fetch official website URLs and contact info for each member using batch processing
    const memberDetailsMap = new Map<string, MemberDetails>()
    
    const detailResults = await processBatch(
      members,
      async (member: any) => {
        try {
          const detailUrl = `https://api.congress.gov/v3/member/${member.bioguideId}?format=json&api_key=${congressApiKey}`
          const { response, metrics } = await fetchWithRetry(detailUrl, {}, PROVIDER, HTTP_CONFIG)
          apiCalls++
          totalWaitMs += metrics.totalWaitMs
          
          if (response.ok) {
            const detailData = await response.json()
            const memberData = detailData.member
            
            const addressInfo = memberData?.addressInformation
            
            return { 
              bioguideId: member.bioguideId, 
              details: {
                websiteUrl: memberData?.officialUrl || null,
                phone: addressInfo?.phoneNumber || null,
                officeAddress: addressInfo?.officeAddress || null,
                officeCity: addressInfo?.city || null,
                officeState: addressInfo?.district || null,
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
      },
      {
        batchSize: 10,
        delayBetweenBatches: 100,
        onProgress: (completed, total) => {
          if (completed % 50 === 0) {
            console.log(`Fetched details for ${completed}/${total} members`)
          }
        }
      }
    )
    
    detailResults.forEach(r => memberDetailsMap.set(r.bioguideId, r.details))
    console.log(`Fetched ${memberDetailsMap.size} member detail records`)

    // Transform and upsert members
    const memberRecords = members.map((member: any) => {
      const terms = member.terms?.item || []
      
      let latestTerm = null
      if (terms.length > 0) {
        const termsWithYear = terms.filter((t: any) => t.startYear)
        if (termsWithYear.length > 0) {
          latestTerm = [...termsWithYear].sort((a: any, b: any) => (b.startYear || 0) - (a.startYear || 0))[0]
        } else {
          latestTerm = terms[terms.length - 1]
        }
      }
      
      let party: 'D' | 'R' | 'I' = 'I'
      const partyStr = (member.partyName || member.party || '').toLowerCase()
      if (partyStr.includes('democrat')) party = 'D'
      else if (partyStr.includes('republican')) party = 'R'
      
      let chamber: 'senate' | 'house' = 'house'
      const hasDistrict = member.district !== undefined && member.district !== null && member.district !== ''
      
      if (hasDistrict) {
        chamber = 'house'
      } else {
        const termChamber = (latestTerm?.chamber || '').toLowerCase()
        const hasSenateInTerm = termChamber.includes('senate')
        const hasHouseInTerm = termChamber.includes('house') || termChamber.includes('representative')
        
        if (hasSenateInTerm) {
          chamber = 'senate'
        } else if (hasHouseInTerm) {
          chamber = 'house'
        } else {
          const anySenate = terms.some((t: any) => (t.chamber || '').toLowerCase().includes('senate'))
          if (anySenate) {
            chamber = 'senate'
          } else {
            chamber = 'senate'
          }
        }
      }
      
      let firstName = member.firstName || ''
      let lastName = member.lastName || ''
      
      if (member.name && member.name.includes(',')) {
        const parts = member.name.split(',').map((p: string) => p.trim())
        if (!lastName) lastName = parts[0] || ''
        if (!firstName) firstName = parts[1] || ''
      }
      
      const state = latestTerm?.stateName || member.state || latestTerm?.stateCode || ''
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

    for (let i = 0; i < memberRecords.length; i += batchSize) {
      const batch = memberRecords.slice(i, i + batchSize)
      
      const { error } = await supabase
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

    // Generate baseline scores for members without scores
    // These are provisional scores that will be recalculated once we have voting/bill data
    console.log('Generating baseline scores for new members...')
    
    const { data: membersWithoutScores } = await supabase
      .from('members')
      .select('id')
      .not('id', 'in', 
        supabase.from('member_scores').select('member_id')
      )

    if (membersWithoutScores && membersWithoutScores.length > 0) {
      // Generate baseline scores with is_provisional = true
      // These will be recalculated by calculate-member-scores once data is available
      const scoreRecords = membersWithoutScores.map(m => ({
        member_id: m.id,
        user_id: null,
        overall_score: 50.0,  // Baseline: 50th percentile
        productivity_score: 50.0,
        attendance_score: 50.0,
        bipartisanship_score: 50.0,
        issue_alignment_score: null,  // Cannot calculate without user context
        transparency_score: null,
        governance_score: null,
        finance_influence_score: null,
        lobbying_alignment_score: null,
        votes_cast: 0,
        votes_missed: 0,
        bills_sponsored: 0,
        bills_cosponsored: 0,
        bills_enacted: 0,
        bipartisan_bills: 0,
        is_provisional: true,
        provisional_reason: 'Insufficient data - member recently added',
        data_points_used: 0,
        calculated_at: new Date().toISOString(),
      }))

      const { error: scoresError } = await supabase
        .from('member_scores')
        .insert(scoreRecords)

      if (scoresError) {
        console.error(`Scores insert error: ${JSON.stringify(scoresError)}`)
      } else {
        console.log(`Created ${scoreRecords.length} baseline score records`)
      }
    }

    // Update watermark
    await updateWatermark(supabase, memberRecords.length)

    // Update sync progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'congress-members',
        last_run_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        status: 'complete',
        total_processed: memberRecords.length,
        last_success_count: memberRecords.length,
        current_offset: 0,
      }, { onConflict: 'id' })

    // Log job run
    await supabase.from('sync_job_runs').insert({
      job_id: `congress-members-${Date.now()}`,
      provider: PROVIDER,
      job_type: 'members',
      status: 'succeeded',
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      records_fetched: members.length,
      records_upserted: memberRecords.length,
      api_calls: apiCalls,
      wait_time_ms: totalWaitMs,
    })

    const result = {
      success: true,
      membersProcessed: memberRecords.length,
      apiCalls,
      message: `Successfully synced ${memberRecords.length} members from Congress.gov`
    }

    console.log('Sync completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Sync error:', errorMessage)
    
    // Log failed job run
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    await supabase.from('sync_job_runs').insert({
      job_id: `congress-members-${Date.now()}`,
      provider: PROVIDER,
      job_type: 'members',
      status: 'failed',
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      error: errorMessage,
      api_calls: apiCalls,
      wait_time_ms: totalWaitMs,
    })
    
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
