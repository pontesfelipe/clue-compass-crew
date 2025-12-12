import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncProgress {
  currentCongress: number
  currentBillType: string
  currentOffset: number
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const congressApiKey = Deno.env.get('CONGRESS_GOV_API_KEY')
  if (!congressApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'CONGRESS_GOV_API_KEY is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check if syncs are paused
  if (await isSyncPaused(supabase)) {
    console.log('Sync paused - skipping bills sync')
    return new Response(
      JSON.stringify({ success: false, message: 'Syncs are currently paused', paused: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log('Starting bills sync with background processing...')

  // Start background task using globalThis for Deno edge runtime
  const runtime = (globalThis as any).EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(syncBillsBackground(supabase, congressApiKey))
  } else {
    // Fallback: run sync inline (will timeout for large syncs)
    await syncBillsBackground(supabase, congressApiKey)
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Bills sync started in background' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

async function syncBillsBackground(supabase: any, congressApiKey: string) {
  try {
    // Update status to running
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bills',
        status: 'running',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    // Get all members from DB to map bioguide_id to member id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id')
    
    if (membersError) throw membersError
    
    const memberMap = new Map<string, string>(members?.map((m: any) => [m.bioguide_id as string, m.id as string]) || [])
    console.log(`Loaded ${memberMap.size} members for mapping`)

    // Get current sync progress
    const { data: progress } = await supabase
      .from('sync_progress')
      .select('*')
      .eq('id', 'bills')
      .single()

    // Parse metadata for progress tracking
    let syncState: SyncProgress = {
      currentCongress: 118,
      currentBillType: 'hr',
      currentOffset: 0
    }

    if (progress?.metadata) {
      try {
        syncState = progress.metadata as SyncProgress
      } catch (e) {
        console.log('Starting fresh sync')
      }
    }

    const billTypes = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres']
    const congresses = [118, 119]
    
    let totalBillsProcessed = progress?.total_processed || 0
    let totalSponsorshipsCreated = 0
    let batchCount = 0
    const maxBatchesPerRun = 20 // Process in smaller chunks to avoid timeout
    const limit = 50

    // Find starting point
    let startCongressIndex = congresses.indexOf(syncState.currentCongress)
    if (startCongressIndex === -1) startCongressIndex = 0
    
    let startTypeIndex = billTypes.indexOf(syncState.currentBillType)
    if (startTypeIndex === -1) startTypeIndex = 0

    outerLoop:
    for (let ci = startCongressIndex; ci < congresses.length; ci++) {
      const congress = congresses[ci]
      
      for (let ti = (ci === startCongressIndex ? startTypeIndex : 0); ti < billTypes.length; ti++) {
        const billType = billTypes[ti]
        
        let offset = (ci === startCongressIndex && ti === startTypeIndex) ? syncState.currentOffset : 0
        let hasMore = true
        
        while (hasMore && batchCount < maxBatchesPerRun) {
          console.log(`Fetching ${billType} bills from Congress ${congress}, offset ${offset}...`)
          
          const url = `https://api.congress.gov/v3/bill/${congress}/${billType}?format=json&limit=${limit}&offset=${offset}&api_key=${congressApiKey}`
          
          const response = await fetch(url)
          
          if (!response.ok) {
            console.error(`Congress API error for ${billType}: ${response.status}`)
            hasMore = false
            break
          }
          
          const data = await response.json()
          const bills = data.bills || []
          
          if (bills.length === 0) {
            hasMore = false
            break
          }

          // Process each bill
          for (const bill of bills) {
            try {
              const sponsorshipsCreated = await processBill(supabase, bill, congress, billType, memberMap, congressApiKey)
              totalSponsorshipsCreated += sponsorshipsCreated
              totalBillsProcessed++
            } catch (billError) {
              console.log(`Error processing bill ${billType}${bill.number}: ${billError}`)
            }
          }

          offset += limit
          hasMore = bills.length === limit
          batchCount++
          
          // Save progress after each batch
          await supabase
            .from('sync_progress')
            .upsert({
              id: 'bills',
              status: 'running',
              total_processed: totalBillsProcessed,
              current_offset: offset,
              metadata: {
                currentCongress: congress,
                currentBillType: billType,
                currentOffset: offset
              },
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' })
          
          console.log(`Batch complete: ${totalBillsProcessed} bills processed, ${totalSponsorshipsCreated} sponsorships`)
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        if (batchCount >= maxBatchesPerRun) {
          console.log('Reached batch limit, will continue on next run')
          break outerLoop
        }
        
        // Reset offset for next bill type
        syncState.currentOffset = 0
      }
    }

    // Check if we've completed all types
    const isComplete = batchCount < maxBatchesPerRun

    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bills',
        last_run_at: new Date().toISOString(),
        status: isComplete ? 'complete' : 'partial',
        total_processed: totalBillsProcessed,
        updated_at: new Date().toISOString(),
        metadata: isComplete ? null : syncState,
      }, { onConflict: 'id' })

    console.log(`Bills sync ${isComplete ? 'completed' : 'paused'}: ${totalBillsProcessed} bills, ${totalSponsorshipsCreated} sponsorships`)

  } catch (error) {
    console.error('Bills sync background error:', error)
    
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bills',
        status: 'error',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
  }
}

async function processBill(
  supabase: any,
  bill: any,
  congress: number,
  billType: string,
  memberMap: Map<string, string>,
  congressApiKey: string
): Promise<number> {
  // Fetch bill details
  const detailUrl = `https://api.congress.gov/v3/bill/${congress}/${billType}/${bill.number}?format=json&api_key=${congressApiKey}`
  const detailResponse = await fetch(detailUrl)
  
  if (!detailResponse.ok) {
    return 0
  }
  
  const detailData = await detailResponse.json()
  const billDetail = detailData.bill

  // Fetch bill summary if available
  let summaryText: string | null = null
  if (billDetail.summaries?.url) {
    try {
      const summaryUrl = `${billDetail.summaries.url}&format=json&api_key=${congressApiKey}`
      const summaryResponse = await fetch(summaryUrl)
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        // Get the most recent summary (last in array, usually the most comprehensive)
        const summaries = summaryData.summaries || []
        if (summaries.length > 0) {
          const latestSummary = summaries[summaries.length - 1]
          summaryText = latestSummary.text || null
          // Clean HTML tags from summary
          if (summaryText) {
            summaryText = summaryText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          }
        }
      }
    } catch (e) {
      console.log(`Error fetching summary for ${billType}${bill.number}: ${e}`)
    }
  }

  const billTypeMap: Record<string, string> = {
    'hr': 'hr', 's': 's', 'hjres': 'hjres', 'sjres': 'sjres',
    'hconres': 'hconres', 'sconres': 'sconres', 'hres': 'hres', 'sres': 'sres'
  }

  const billRecord = {
    congress: congress,
    bill_type: billTypeMap[billType] || 'hr',
    bill_number: bill.number,
    title: billDetail.title || bill.title || 'Untitled',
    short_title: billDetail.shortTitle || null,
    introduced_date: billDetail.introducedDate || null,
    latest_action_date: billDetail.latestAction?.actionDate || null,
    latest_action_text: billDetail.latestAction?.text || null,
    policy_area: billDetail.policyArea?.name || null,
    subjects: billDetail.subjects?.legislativeSubjects?.map((s: any) => s.name) || null,
    url: bill.url || null,
    enacted: billDetail.laws?.length > 0,
    enacted_date: billDetail.laws?.[0]?.date || null,
    summary: summaryText,
    updated_at: new Date().toISOString(),
  }

  // Upsert bill
  const { data: upsertedBill, error: billError } = await supabase
    .from('bills')
    .upsert(billRecord, { onConflict: 'congress,bill_type,bill_number', ignoreDuplicates: false })
    .select('id')
    .single()

  let billId: string | null = null

  if (billError) {
    // Try to get existing bill
    const { data: existingBill } = await supabase
      .from('bills')
      .select('id')
      .eq('congress', congress)
      .eq('bill_type', billTypeMap[billType] || 'hr')
      .eq('bill_number', bill.number)
      .single()
    
    if (existingBill) {
      billId = existingBill.id
    }
  } else if (upsertedBill) {
    billId = upsertedBill.id
  }

  if (!billId) return 0

  // Process sponsorships
  return await processSponsorships(supabase, billDetail, billId, memberMap, congressApiKey)
}

async function processSponsorships(
  supabase: any,
  billDetail: any,
  billId: string,
  memberMap: Map<string, string>,
  congressApiKey: string
): Promise<number> {
  let created = 0

  // Process primary sponsor
  if (billDetail.sponsors?.[0]) {
    const sponsor = billDetail.sponsors[0]
    const memberId = memberMap.get(sponsor.bioguideId)
    
    if (memberId) {
      const { error } = await supabase
        .from('bill_sponsorships')
        .upsert({
          bill_id: billId,
          member_id: memberId,
          is_sponsor: true,
          is_original_cosponsor: false,
          cosponsored_date: billDetail.introducedDate || null,
        }, { onConflict: 'bill_id,member_id', ignoreDuplicates: true })
      
      if (!error) created++
    }
  }

  // Fetch and process cosponsors
  if (billDetail.cosponsors?.count > 0 && billDetail.cosponsors?.url) {
    try {
      const cosponsorsUrl = `${billDetail.cosponsors.url}&format=json&api_key=${congressApiKey}&limit=100`
      const response = await fetch(cosponsorsUrl)
      
      if (response.ok) {
        const data = await response.json()
        const cosponsors = data.cosponsors || []
        
        for (const cosponsor of cosponsors) {
          const memberId = memberMap.get(cosponsor.bioguideId)
          
          if (memberId) {
            const { error } = await supabase
              .from('bill_sponsorships')
              .upsert({
                bill_id: billId,
                member_id: memberId,
                is_sponsor: false,
                is_original_cosponsor: cosponsor.isOriginalCosponsor || false,
                cosponsored_date: cosponsor.sponsorshipDate || null,
              }, { onConflict: 'bill_id,member_id', ignoreDuplicates: true })
            
            if (!error) created++
          }
        }
      }
    } catch (e) {
      console.log('Error fetching cosponsors:', e)
    }
  }

  return created
}

addEventListener('beforeunload', (ev) => {
  console.log('Bills sync function shutting down:', (ev as any).detail?.reason)
})
