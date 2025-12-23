import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchJson, fetchWithRetry, HttpClientConfig, TimeBudget } from '../_shared/httpClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVIDER = 'congress'
const DATASET = 'bills'
const MAX_DURATION_SECONDS = 30 // Timebox: stop after 30 seconds
const HTTP_CONFIG: HttpClientConfig = {
  maxRetries: 4,
  baseDelayMs: 1500,
  maxConcurrency: 2,
  minDelayBetweenRequestsMs: 400, // 400ms between Congress.gov calls
}

interface SyncCursor {
  congress: number
  billType: string
  offset: number
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
async function getWatermark(supabase: any): Promise<{ lastSuccessAt: string | null, lastCursor: SyncCursor | null }> {
  const { data } = await supabase
    .from('sync_state')
    .select('last_success_at, last_cursor')
    .eq('provider', PROVIDER)
    .eq('dataset', DATASET)
    .eq('scope_key', 'global')
    .single()
  
  return {
    lastSuccessAt: data?.last_success_at || null,
    lastCursor: data?.last_cursor as SyncCursor || null
  }
}

// Update watermark in sync_state
async function updateWatermark(supabase: any, cursor: SyncCursor | null, recordsTotal: number, success: boolean) {
  await supabase
    .from('sync_state')
    .upsert({
      provider: PROVIDER,
      dataset: DATASET,
      scope_key: 'global',
      last_cursor: cursor,
      last_success_at: success ? new Date().toISOString() : undefined,
      records_total: recordsTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider,dataset,scope_key' })
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

  // Parse request params
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') || 'delta' // 'delta' or 'full'

  console.log(`Starting bills sync (mode: ${mode}) with background processing...`)

  // Start background task
  const runtime = (globalThis as any).EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(syncBillsBackground(supabase, congressApiKey, mode))
  } else {
    await syncBillsBackground(supabase, congressApiKey, mode)
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Bills sync started in background' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

async function syncBillsBackground(supabase: any, congressApiKey: string, mode: string) {
  const startTime = Date.now()
  const budget = new TimeBudget(MAX_DURATION_SECONDS) // Timebox enforcement
  let totalBillsProcessed = 0
  let totalSponsorshipsCreated = 0
  let apiCalls = 0
  let totalWaitMs = 0

  try {
    // Update status to running
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bills',
        status: 'running',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    // Get watermark for incremental sync
    const { lastSuccessAt, lastCursor } = await getWatermark(supabase)
    console.log(`Last success: ${lastSuccessAt}, Last cursor: ${JSON.stringify(lastCursor)}`)

    // For delta mode, calculate date window using watermark
    let fromDate: string | null = null
    if (mode === 'delta' && lastSuccessAt) {
      const lastDate = new Date(lastSuccessAt)
      const windowDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
      fromDate = (lastDate > windowDate ? lastDate : windowDate).toISOString().split('T')[0]
      console.log(`Delta mode: fetching bills updated since ${fromDate}`)
    }

    // Get all members from DB to map bioguide_id to member id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id')
    
    if (membersError) throw membersError
    
    const memberMap = new Map<string, string>(members?.map((m: any) => [m.bioguide_id as string, m.id as string]) || [])
    console.log(`Loaded ${memberMap.size} members for mapping`)

    const billTypes = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres']

    // Prioritize the current Congress first so votes can be linked to bills promptly.
    // In delta mode, we intentionally ignore the previous cursor and start fresh from the current Congress.
    const congresses = [119, 118]

    const limit = 50

    const resumeCursor = mode === 'full' ? lastCursor : null

    // Resume from cursor if available (full mode only)
    let startCongressIndex = resumeCursor ? congresses.indexOf(resumeCursor.congress) : 0
    if (startCongressIndex === -1) startCongressIndex = 0

    let startTypeIndex = resumeCursor ? billTypes.indexOf(resumeCursor.billType) : 0
    if (startTypeIndex === -1) startTypeIndex = 0

    let currentCursor: SyncCursor = resumeCursor || {
      congress: congresses[0],
      billType: billTypes[0],
      offset: 0,
    }

    outerLoop:
    for (let ci = startCongressIndex; ci < congresses.length; ci++) {
      const congress = congresses[ci]
      
      for (let ti = (ci === startCongressIndex ? startTypeIndex : 0); ti < billTypes.length; ti++) {
        const billType = billTypes[ti]
        
        let offset = (ci === startCongressIndex && ti === startTypeIndex && lastCursor) ? lastCursor.offset : 0
        let hasMore = true
        
        while (hasMore) {
          // TIMEBOX CHECK: Stop if time budget is near expiry
          if (!budget.shouldContinue()) {
            console.log(`Time budget expired after ${budget.elapsed()}ms, stopping gracefully`)
            break outerLoop
          }
          
          console.log(`Fetching ${billType} bills from Congress ${congress}, offset ${offset}...`)
          
          // Build URL with optional date filter for incremental sync
          let url = `https://api.congress.gov/v3/bill/${congress}/${billType}?format=json&limit=${limit}&offset=${offset}&api_key=${congressApiKey}`
          if (fromDate) {
            url += `&fromDateTime=${fromDate}T00:00:00Z`
          }
          
          try {
            const { data, metrics } = await fetchJson<any>(url, {}, PROVIDER, HTTP_CONFIG, budget)
            apiCalls++
            totalWaitMs += metrics.totalWaitMs
            
            const bills = data.bills || []
            
            if (bills.length === 0) {
              hasMore = false
              break
            }

            // Process each bill
            for (const bill of bills) {
              // Check budget before processing each bill
              if (budget.isNearExpiry()) {
                console.log(`Time budget near expiry, stopping bill processing`)
                break outerLoop
              }
              
              try {
                const result = await processBill(supabase, bill, congress, billType, memberMap, congressApiKey, budget)
                totalSponsorshipsCreated += result.sponsorships
                apiCalls += result.apiCalls
                totalWaitMs += result.waitMs
                totalBillsProcessed++
              } catch (billError) {
                console.log(`Error processing bill ${billType}${bill.number}: ${billError}`)
              }
            }

            offset += limit
            hasMore = bills.length === limit
            
            // Update cursor
            currentCursor = { congress, billType, offset }
            
            // Save progress after each batch
            await supabase
              .from('sync_progress')
              .upsert({
                id: 'bills',
                status: 'running',
                total_processed: totalBillsProcessed,
                current_offset: offset,
                cursor_json: currentCursor,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' })
            
            console.log(`Batch complete: ${totalBillsProcessed} bills, ${totalSponsorshipsCreated} sponsorships, ${apiCalls} API calls, ${budget.remaining()}ms remaining`)
          } catch (fetchError) {
            console.error(`Error fetching bills: ${fetchError}`)
            hasMore = false
          }
        }
      }
    }

    // Check if we've completed all types (only true if we didn't hit time limit)
    const isComplete = budget.shouldContinue()

    // Get total bills in DB for accurate progress
    const { count: totalBillsInDb } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })

    // Update watermark
    await updateWatermark(supabase, isComplete ? null : currentCursor, totalBillsInDb || totalBillsProcessed, isComplete)

    // Update sync_progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bills',
        last_run_at: new Date().toISOString(),
        last_synced_at: isComplete ? new Date().toISOString() : undefined,
        status: isComplete ? 'complete' : 'partial',
        total_processed: totalBillsInDb || totalBillsProcessed,
        last_success_count: totalBillsProcessed,
        cursor_json: isComplete ? null : currentCursor,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    // Log job run
    await supabase.from('sync_job_runs').insert({
      job_id: `bills-${Date.now()}`,
      provider: PROVIDER,
      job_type: 'bills',
      status: isComplete ? 'succeeded' : 'partial',
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      records_fetched: totalBillsProcessed,
      records_upserted: totalBillsProcessed,
      api_calls: apiCalls,
      wait_time_ms: totalWaitMs,
      metadata: { sponsorships: totalSponsorshipsCreated, mode }
    })

    console.log(`Bills sync ${isComplete ? 'completed' : 'paused'}: ${totalBillsProcessed} bills, ${totalSponsorshipsCreated} sponsorships, ${apiCalls} API calls`)

  } catch (error) {
    console.error('Bills sync background error:', error)
    
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bills',
        status: 'error',
        error_message: String(error),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    // Log failed job run
    await supabase.from('sync_job_runs').insert({
      job_id: `bills-${Date.now()}`,
      provider: PROVIDER,
      job_type: 'bills',
      status: 'failed',
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      records_fetched: totalBillsProcessed,
      error: String(error),
      api_calls: apiCalls,
      wait_time_ms: totalWaitMs,
    })
  }
}

async function processBill(
  supabase: any,
  bill: any,
  congress: number,
  billType: string,
  memberMap: Map<string, string>,
  congressApiKey: string,
  budget: TimeBudget
): Promise<{ sponsorships: number, apiCalls: number, waitMs: number }> {
  let apiCalls = 0
  let waitMs = 0

  // Fetch bill details using httpClient with budget
  const detailUrl = `https://api.congress.gov/v3/bill/${congress}/${billType}/${bill.number}?format=json&api_key=${congressApiKey}`
  
  const { response: detailResponse, metrics: detailMetrics } = await fetchWithRetry(detailUrl, {}, PROVIDER, HTTP_CONFIG, budget)
  apiCalls++
  waitMs += detailMetrics.totalWaitMs
  
  if (!detailResponse.ok) {
    return { sponsorships: 0, apiCalls, waitMs }
  }
  
  const detailData = await detailResponse.json()
  const billDetail = detailData.bill

  // Fetch bill summary if available (skip if near time limit)
  let summaryText: string | null = null
  if (billDetail.summaries?.url && budget.shouldContinue()) {
    try {
      const summaryUrl = `${billDetail.summaries.url}&format=json&api_key=${congressApiKey}`
      const { response: summaryResponse, metrics: summaryMetrics } = await fetchWithRetry(summaryUrl, {}, PROVIDER, HTTP_CONFIG, budget)
      apiCalls++
      waitMs += summaryMetrics.totalWaitMs
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        const summaries = summaryData.summaries || []
        if (summaries.length > 0) {
          const latestSummary = summaries[summaries.length - 1]
          summaryText = latestSummary.text || null
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

  if (!billId) return { sponsorships: 0, apiCalls, waitMs }

  // Process sponsorships
  const sponsorResult = await processSponsorships(supabase, billDetail, billId, memberMap, congressApiKey)
  
  return { 
    sponsorships: sponsorResult.count, 
    apiCalls: apiCalls + sponsorResult.apiCalls, 
    waitMs: waitMs + sponsorResult.waitMs 
  }
}

async function processSponsorships(
  supabase: any,
  billDetail: any,
  billId: string,
  memberMap: Map<string, string>,
  congressApiKey: string
): Promise<{ count: number, apiCalls: number, waitMs: number }> {
  let created = 0
  let apiCalls = 0
  let waitMs = 0

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

  // Fetch and process cosponsors using httpClient
  if (billDetail.cosponsors?.count > 0 && billDetail.cosponsors?.url) {
    try {
      const cosponsorsUrl = `${billDetail.cosponsors.url}&format=json&api_key=${congressApiKey}&limit=100`
      const { response, metrics } = await fetchWithRetry(cosponsorsUrl, {}, PROVIDER, HTTP_CONFIG)
      apiCalls++
      waitMs += metrics.totalWaitMs
      
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

  return { count: created, apiCalls, waitMs }
}

addEventListener('beforeunload', (ev) => {
  console.log('Bills sync function shutting down:', (ev as any).detail?.reason)
})
