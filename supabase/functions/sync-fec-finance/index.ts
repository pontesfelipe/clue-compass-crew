import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { fetchWithRetry, HttpClientConfig } from '../_shared/httpClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FEC_API_BASE = "https://api.open.fec.gov/v1"
const FEC_API_KEY = Deno.env.get('FEC_API_KEY') || "DEMO_KEY"
const PROVIDER = 'fec'
const DATASET = 'contributions'
const JOB_ID = "fec-finance"
const MAX_DURATION_SECONDS = 280 // Edge function timeout
// Process ONE member per run to maximize pagination depth (50,000 contributions possible)
const BATCH_SIZE = 1
const CURRENT_CYCLE = (() => {
  const y = new Date().getFullYear()
  return y % 2 === 0 ? y : y + 1
})()
// All cycles - will be filtered by cycle parameter
const ALL_CYCLES = [CURRENT_CYCLE + 2, CURRENT_CYCLE, CURRENT_CYCLE - 2, CURRENT_CYCLE - 4, CURRENT_CYCLE - 6, CURRENT_CYCLE - 8]
const HTTP_CONFIG: HttpClientConfig = {
  maxRetries: 5,
  baseDelayMs: 1500, // Slightly higher to avoid rate limits
  maxConcurrency: 2,
}

const stateAbbreviations: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "District of Columbia": "DC", "Puerto Rico": "PR", "Guam": "GU", "American Samoa": "AS",
  "U.S. Virgin Islands": "VI", "Northern Mariana Islands": "MP"
}

// Common political nicknames -> legal first names mapping
const NICKNAME_MAP: Record<string, string[]> = {
  'ted': ['rafael', 'edward', 'theodore'],
  'bernie': ['bernard'],
  'chuck': ['charles'],
  'mike': ['michael'],
  'bill': ['william'],
  'bob': ['robert'],
  'dick': ['richard'],
  'jim': ['james'],
  'joe': ['joseph'],
  'tom': ['thomas'],
  'dan': ['daniel'],
  'dave': ['david'],
  'ben': ['benjamin'],
  'ed': ['edward', 'edwin'],
  'al': ['albert', 'alan', 'alfred'],
  'pete': ['peter'],
  'tim': ['timothy'],
  'matt': ['matthew'],
  'rick': ['richard', 'eric', 'frederick'],
  'ron': ['ronald'],
  'don': ['donald'],
  'andy': ['andrew'],
  'tony': ['anthony'],
  'steve': ['steven', 'stephen'],
  'chris': ['christopher', 'christian'],
  'nick': ['nicholas'],
  'pat': ['patrick', 'patricia'],
  'ken': ['kenneth'],
  'larry': ['lawrence'],
  'jerry': ['gerald', 'jerome'],
  'jeff': ['jeffrey'],
  'greg': ['gregory'],
  'sam': ['samuel'],
  'max': ['maxwell', 'maximilian'],
  'jack': ['john', 'jackson'],
  'marty': ['martin'],
  'mitch': ['mitchell'],
  'josh': ['joshua'],
  'will': ['william'],
  'charlie': ['charles'],
  'liz': ['elizabeth'],
  'beth': ['elizabeth'],
  'debbie': ['deborah'],
  'deborah': ['debbie'],
  'nancy': ['ann'],
  'sue': ['susan'],
  'cathy': ['catherine'],
  'kate': ['katherine', 'catherine'],
  'maggie': ['margaret'],
  'meg': ['margaret'],
  'betty': ['elizabeth'],
}

const SPONSOR_THRESHOLD = 5000

// Helper: Check if syncs are paused
async function isSyncPaused(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('feature_toggles')
      .select('enabled')
      .eq('id', 'sync_paused')
      .single()
    return data?.enabled === true
  } catch {
    return false
  }
}

// Get watermark from sync_state
async function getWatermark(supabase: any): Promise<{ lastSuccessAt: string | null, lastCursor: any }> {
  const { data } = await supabase
    .from('sync_state')
    .select('last_success_at, last_cursor')
    .eq('provider', PROVIDER)
    .eq('dataset', DATASET)
    .eq('scope_key', 'global')
    .single()
  
  return {
    lastSuccessAt: data?.last_success_at || null,
    lastCursor: data?.last_cursor || null
  }
}

// Update watermark
async function updateWatermark(supabase: any, cursor: any, recordsTotal: number) {
  await supabase
    .from('sync_state')
    .upsert({
      provider: PROVIDER,
      dataset: DATASET,
      scope_key: 'global',
      last_cursor: cursor,
      last_success_at: new Date().toISOString(),
      records_total: recordsTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider,dataset,scope_key' })
}

// Helper: Acquire job lock
async function acquireLock(supabase: any, lockId: string = JOB_ID): Promise<boolean> {
  const now = new Date()
  const lockUntil = new Date(now.getTime() + MAX_DURATION_SECONDS * 1000)

  const { data: progress } = await supabase
    .from('sync_progress')
    .select('status, lock_until')
    .eq('id', lockId)
    .single()

  if (progress) {
    const existingLock = progress.lock_until ? new Date(progress.lock_until) : null
    const isLocked = !!(existingLock && existingLock > now)

    if (isLocked) {
      console.log(`Job ${lockId} is locked until ${existingLock!.toISOString()}`)
      return false
    }

    if (progress.status === 'running') {
      console.warn(`Job ${lockId} was 'running' but lock expired; restarting`)
    }
  }

  await supabase
    .from('sync_progress')
    .upsert({
      id: lockId,
      status: 'running',
      lock_until: lockUntil.toISOString(),
      last_run_at: now.toISOString(),
    }, { onConflict: 'id' })

  return true
}

// Helper: Release job lock
async function releaseLock(
  supabase: any,
  status: string,
  successCount: number,
  failureCount: number,
  lockId: string = JOB_ID
) {
  await supabase
    .from('sync_progress')
    .update({
      status,
      lock_until: null,
      last_success_count: successCount,
      last_failure_count: failureCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lockId)
}

// Generate contribution UID for idempotent upserts
function generateContributionUid(c: any, memberId: string): string {
  const parts = [
    memberId,
    c.committee_id || '',
    c.receipt_date || '',
    c.contribution_receipt_amount?.toString() || '0',
    (c.contributor_name || '').substring(0, 50),
    c.contributor_zip || '',
  ]
  return parts.join('|').replace(/[^a-zA-Z0-9|]/g, '').substring(0, 200)
}

// Update FEC sync state for resumable pagination
async function updateSyncState(
  supabase: any,
  memberId: string,
  cycle: number,
  lastPage: number,
  totalPages: number | null,
  contributionsCount: number,
  isComplete: boolean,
  error: string | null = null
) {
  await supabase
    .from('fec_sync_state')
    .upsert({
      member_id: memberId,
      cycle: cycle,
      last_page_fetched: lastPage,
      total_pages_estimated: totalPages,
      contributions_count: contributionsCount,
      is_complete: isComplete,
      last_synced_at: new Date().toISOString(),
      last_error: error,
      retry_count: error ? 1 : 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'member_id,cycle'
    })
}

// Get sync state for a member+cycle
async function getSyncState(supabase: any, memberId: string, cycle: number) {
  const { data } = await supabase
    .from('fec_sync_state')
    .select('last_page_fetched, is_complete, contributions_count, total_pages_estimated, retry_count')
    .eq('member_id', memberId)
    .eq('cycle', cycle)
    .single()
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let apiCalls = 0
  let totalWaitMs = 0

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if syncs are paused
    if (await isSyncPaused(supabase)) {
      console.log('Sync paused - skipping FEC finance sync')
      return new Response(
        JSON.stringify({ success: false, message: 'Syncs are currently paused', paused: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestUrl = new URL(req.url)
    const memberIdFilter = requestUrl.searchParams.get('member_id')
    const cycleFilter = requestUrl.searchParams.get('cycle')
    const isSingleMemberRun = !!memberIdFilter
    
    // Determine which cycles to process
    let cyclesToProcess: number[]
    if (cycleFilter) {
      const requestedCycle = parseInt(cycleFilter, 10)
      if (isNaN(requestedCycle) || requestedCycle < 2010 || requestedCycle > CURRENT_CYCLE + 2) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid cycle parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      cyclesToProcess = [requestedCycle]
    } else if (isSingleMemberRun) {
      // Single member: process all cycles
      cyclesToProcess = ALL_CYCLES
    } else {
      // Batch mode: process current cycle only for speed
      cyclesToProcess = [CURRENT_CYCLE]
    }
    
    const lockId = memberIdFilter 
      ? `${JOB_ID}:${memberIdFilter}` 
      : cycleFilter 
        ? `${JOB_ID}:cycle-${cycleFilter}` 
        : JOB_ID

    // Try to acquire lock
    if (!await acquireLock(supabase, lockId)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Job is locked or already running' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Starting FEC finance sync (cycles: ${cyclesToProcess.join(', ')})...`)

    // Get watermark for offset
    const { lastCursor } = await getWatermark(supabase)
    let offset = lastCursor?.memberOffset || 0
    let limit = BATCH_SIZE

    if (isSingleMemberRun) {
      offset = 0
      limit = 1
    }

    // Parse request options (batch runs only)
    if (!isSingleMemberRun) {
      try {
        const body = await req.json()
        if (body.reset) offset = 0
        if (typeof body.offset === 'number' && Number.isFinite(body.offset)) {
          offset = Math.max(0, Math.floor(body.offset))
        }
        if (body.limit) limit = Math.min(body.limit, 10)
      } catch {
        // Use defaults
      }
    }

    // Get members to sync
    let members: any[] = []
    let totalMembers: number = 0

    if (isSingleMemberRun && memberIdFilter) {
      // Single member run - fetch specific member
      const { data, count } = await supabase
        .from('members')
        .select(
          'id, bioguide_id, first_name, last_name, full_name, state, party, chamber, fec_candidate_id, fec_committee_ids',
          { count: 'exact' }
        )
        .eq('id', memberIdFilter)
      
      members = data || []
      totalMembers = count || 0
    } else {
      // Priority queue: Get members with INCOMPLETE or missing data first
      const targetCycle = cyclesToProcess[0]
      
      // First, check for members with incomplete sync states for this cycle
      const { data: incompleteSyncStates } = await supabase
        .from('fec_sync_state')
        .select('member_id, contributions_count, last_synced_at')
        .eq('cycle', targetCycle)
        .eq('is_complete', false)
        .order('contributions_count', { ascending: true }) // Least data first
        .order('last_synced_at', { ascending: true, nullsFirst: true }) // Oldest first
        .limit(limit)

      let memberIds: string[] = []

      if (incompleteSyncStates && incompleteSyncStates.length > 0) {
        memberIds = incompleteSyncStates.map((s: any) => s.member_id)
        console.log(`Found ${memberIds.length} members with incomplete data for cycle ${targetCycle}`)
      } else {
        // No incomplete syncs - get members who have NEVER been synced for this cycle
        // These are members not present in fec_sync_state for this cycle
        const { data: syncedMemberIds } = await supabase
          .from('fec_sync_state')
          .select('member_id')
          .eq('cycle', targetCycle)
        
        const syncedSet = new Set((syncedMemberIds || []).map((s: any) => s.member_id))
        
        const { data: allActiveMembers } = await supabase
          .from('members')
          .select('id')
          .eq('in_office', true)
          .order('last_name')
        
        if (allActiveMembers) {
          // Filter to only members not yet synced for this cycle
          const notSynced = allActiveMembers.filter((m: any) => !syncedSet.has(m.id))
          memberIds = notSynced.slice(0, limit).map((m: any) => m.id)
          
          if (memberIds.length > 0) {
            console.log(`Found ${memberIds.length} members never synced for cycle ${targetCycle}`)
          } else {
            // All members synced - just get next batch by offset
            console.log(`All members synced for cycle ${targetCycle} - cycling through for updates`)
            const batchMembers = allActiveMembers.slice(offset, offset + limit)
            memberIds = batchMembers.map((m: any) => m.id)
          }
        }
      }

      if (memberIds.length === 0) {
        console.log('No members to process')
        await releaseLock(supabase, 'complete', 0, 0, lockId)
        return new Response(
          JSON.stringify({
            success: true,
            message: `All members processed for cycle ${targetCycle}`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch full member details
      const { data, count } = await supabase
        .from('members')
        .select(
          'id, bioguide_id, first_name, last_name, full_name, state, party, chamber, fec_candidate_id, fec_committee_ids',
          { count: 'exact' }
        )
        .in('id', memberIds)
      
      members = data || []
      totalMembers = count || 0
    }

    if (!members || members.length === 0) {
      if (isSingleMemberRun) {
        await releaseLock(supabase, 'complete', 0, 0, lockId)
        return new Response(
          JSON.stringify({ success: false, message: 'No matching member found for requested member_id' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('All members processed. Resetting offset.')
      await releaseLock(supabase, 'complete', 0, 0, lockId)
      await updateWatermark(supabase, { memberOffset: 0 }, 0)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'All members processed. Will restart on next run.',
          totalMembers,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${members.length} members for cycles ${cyclesToProcess.join(', ')}`)

    let processedCount = 0
    let matchedCount = 0
    let errorCount = 0
    let totalContributionsInserted = 0

    for (const member of members) {
      // Check if we're running out of time (leave 60s buffer for cleanup)
      if (Date.now() - startTime > (MAX_DURATION_SECONDS - 60) * 1000) {
        console.log('Approaching time limit, stopping batch early')
        break
      }

      try {
        const stateAbbr = stateAbbreviations[member.state] || member.state
        if (!stateAbbr || stateAbbr.length !== 2) {
          console.log(`Unknown state for ${member.full_name}: ${member.state}`)
          processedCount++
          continue
        }

        const lastName = member.last_name.replace(/[^a-zA-Z\s]/g, '').trim()
        const office = member.chamber === 'house' ? 'H' : 'S'
        
        // Check for manual mapping first
        const { data: manualMapping } = await supabase
          .from('fec_manual_mapping')
          .select('fec_candidate_id')
          .eq('member_id', member.id)
          .single()
        
        let matchingCandidate: any = null
        let bestScore = 0
        
        if (manualMapping?.fec_candidate_id) {
          // Use manual mapping - highest priority
          console.log(`Using manual FEC mapping for ${member.full_name}: ${manualMapping.fec_candidate_id}`)
          matchingCandidate = { candidate_id: manualMapping.fec_candidate_id, name: member.full_name }
          bestScore = 100
        } else if (member.fec_candidate_id) {
          // Use cached candidate ID - skip search
          console.log(`Using cached FEC ID for ${member.full_name}: ${member.fec_candidate_id}`)
          matchingCandidate = { candidate_id: member.fec_candidate_id, name: member.full_name }
          bestScore = 100
        } else {
          // Search for candidate using httpClient
          const candidateSearchUrl = `${FEC_API_BASE}/candidates/?api_key=${FEC_API_KEY}&name=${encodeURIComponent(lastName)}&state=${stateAbbr}&office=${office}&is_active_candidate=true&sort=-election_years&per_page=20`
          
          console.log(`Searching FEC for: ${member.full_name} (${stateAbbr}, ${office})`)
          
          const { response: candidateResponse, metrics: candidateMetrics } = await fetchWithRetry(candidateSearchUrl, {}, PROVIDER, HTTP_CONFIG)
          apiCalls++
          totalWaitMs += candidateMetrics.totalWaitMs
          
          if (!candidateResponse?.ok) {
            if (candidateResponse?.status === 429) {
              console.error('Rate limited. Saving progress and stopping.')
              errorCount++
              break
            }
            console.log(`FEC search failed for ${member.full_name}`)
            processedCount++
            continue
          }

          const candidateData = await candidateResponse.json()
          const candidates = candidateData.results || []
          
          // Find matching candidate with score-based matching
          const memberLastName = member.last_name.toLowerCase().replace(/[^a-z]/g, '')
          const memberFirstName = member.first_name.toLowerCase().replace(/[^a-z]/g, '')
          
          const possibleFirstNames = [memberFirstName]
          if (NICKNAME_MAP[memberFirstName]) {
            possibleFirstNames.push(...NICKNAME_MAP[memberFirstName])
          }
          for (const [nickname, legalNames] of Object.entries(NICKNAME_MAP)) {
            if (legalNames.includes(memberFirstName)) {
              possibleFirstNames.push(nickname)
            }
          }
          
          let bestCandidate: any = null
          
          for (const c of candidates) {
            if (!c.name) continue
            const fecName = c.name.toLowerCase()
            const nameParts = fecName.split(',')
            const fecLastName = nameParts[0]?.trim().replace(/[^a-z]/g, '') || ''
            const fecFirstPart = nameParts[1]?.trim().split(' ')[0]?.replace(/[^a-z]/g, '') || ''
            
            if (fecLastName !== memberLastName) continue
            
            let score = 0
            
            for (const possibleName of possibleFirstNames) {
              if (fecFirstPart === possibleName) {
                score = Math.max(score, possibleName === memberFirstName ? 100 : 90)
              } else if (fecFirstPart.startsWith(possibleName) && possibleName.length >= 2) {
                score = Math.max(score, 80)
              } else if (possibleName.startsWith(fecFirstPart) && fecFirstPart.length >= 2) {
                score = Math.max(score, 70)
              } else if (fecFirstPart.length >= 3 && possibleName.length >= 3 && 
                         fecFirstPart.substring(0, 3) === possibleName.substring(0, 3)) {
                score = Math.max(score, 50)
              }
            }
            
            if (score === 0) continue
            
            if (c.office === office) score += 10
            if (c.election_years?.includes(2024)) score += 5
            if (c.election_years?.includes(2022)) score += 3
            
            if (score > bestScore) {
              bestScore = score
              bestCandidate = c
            }
          }
          
          if (bestCandidate && bestScore >= 50) {
            matchingCandidate = bestCandidate
            console.log(`Matched (score=${bestScore}): ${member.full_name} -> ${bestCandidate.name} (${bestCandidate.candidate_id})`)
          }
        }

        if (!matchingCandidate) {
          console.log(`No FEC match for ${member.full_name} (best score: ${bestScore})`)
          processedCount++
          continue
        }

        const candidateId = matchingCandidate.candidate_id
        matchedCount++

        // Store the FEC candidate ID on the member record for future syncs
        if (!member.fec_candidate_id || member.fec_candidate_id !== candidateId) {
          await supabase
            .from('members')
            .update({ 
              fec_candidate_id: candidateId,
              fec_last_synced_at: new Date().toISOString()
            })
            .eq('id', member.id)
          
          console.log(`Stored FEC candidate ID ${candidateId} for ${member.full_name}`)
        }

        // Get committees
        const committeesUrl = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${FEC_API_KEY}&per_page=100`
        const { response: committeesResponse, metrics: committeesMetrics } = await fetchWithRetry(committeesUrl, {}, PROVIDER, HTTP_CONFIG)
        apiCalls++
        totalWaitMs += committeesMetrics.totalWaitMs

        if (!committeesResponse?.ok) {
          if (committeesResponse?.status === 429) break
          processedCount++
          continue
        }

        const committeesData = await committeesResponse.json()
        const committees = committeesData.results || []

        if (committees.length === 0) {
          processedCount++
          continue
        }

        // Persist committee IDs
        const fetchedCommitteeIds = Array.from(
          new Set(
            committees
              .map((c: any) => c.committee_id)
              .filter((id: any) => typeof id === 'string' && id.length > 0)
          )
        ).sort()

        const existingCommitteeIds = Array.from(new Set((member.fec_committee_ids || []).filter(Boolean))).sort()
        if (fetchedCommitteeIds.join(',') !== existingCommitteeIds.join(',')) {
          await supabase
            .from('members')
            .update({ fec_committee_ids: fetchedCommitteeIds })
            .eq('id', member.id)
        }

        // Pick the best committee for itemized contributions
        const committeeCandidates = [
          committees.find((c: any) => c.committee_type === 'P'),
          ...committees.filter((c: any) => c.committee_type !== 'P'),
        ].filter(Boolean)

        const defaultCommitteeId = committeeCandidates[0].committee_id
        const defaultCommitteeName = committeeCandidates[0].name || ''

        // Process cycles with RESUMABLE PAGINATION
        let rateLimited = false
        for (const cycle of cyclesToProcess) {
          if (rateLimited) break

          // Check time budget per cycle
          if (Date.now() - startTime > (MAX_DURATION_SECONDS - 60) * 1000) {
            console.log('Approaching time limit mid-cycle, saving progress')
            break
          }

          // Check sync state to see if we should resume or skip
          const syncState = await getSyncState(supabase, member.id, cycle)
          
          // Skip if already complete
          if (syncState?.is_complete) {
            console.log(`Cycle ${cycle} already complete for ${member.full_name} - skipping`)
            continue
          }

          let committeeId = defaultCommitteeId
          let committeeName = defaultCommitteeName
          let contributionsResults: any[] = []
          let totalContributionsAvailable: number | null = syncState?.contributions_count || null

          // Resume from last page + 1
          let startPage = syncState?.last_page_fetched ? syncState.last_page_fetched + 1 : 1
          console.log(`Processing cycle ${cycle} for ${member.full_name} from page ${startPage}`)

          // Try each committee for this cycle
          for (const committee of committeeCandidates.slice(0, 5)) {
            const candidateCommitteeId = committee.committee_id
            if (!candidateCommitteeId) continue

            let hasMore = true
            // Allow up to 500 pages = 50,000 contributions for deep pagination
            const MAX_PAGES = 500
            let pageCount = 0
            let page = startPage
            let totalPages: number | null = syncState?.total_pages_estimated || null

            while (hasMore && pageCount < MAX_PAGES && !rateLimited) {
              // Check time budget
              if (Date.now() - startTime > (MAX_DURATION_SECONDS - 60) * 1000) {
                console.log('Approaching time limit - saving progress')
                
                // Save current progress
                await updateSyncState(
                  supabase,
                  member.id,
                  cycle,
                  page - 1,
                  totalPages,
                  contributionsResults.length + (syncState?.contributions_count || 0),
                  false
                )
                
                hasMore = false
                break
              }

              const url = new URL(`${FEC_API_BASE}/schedules/schedule_a/`)
              url.searchParams.set('api_key', FEC_API_KEY)
              url.searchParams.set('committee_id', candidateCommitteeId)
              url.searchParams.set('two_year_transaction_period', String(cycle))
              url.searchParams.set('sort', '-contribution_receipt_amount')
              url.searchParams.set('per_page', '100')
              url.searchParams.set('page', String(page))

              const { response: contributionsResponse, metrics: contributionsMetrics } = await fetchWithRetry(
                url.toString(),
                {},
                PROVIDER,
                HTTP_CONFIG
              )
              apiCalls++
              totalWaitMs += contributionsMetrics.totalWaitMs
              pageCount++

              if (contributionsResponse?.status === 429) {
                console.log('Rate limited - saving progress')
                await updateSyncState(
                  supabase,
                  member.id,
                  cycle,
                  page - 1,
                  totalPages,
                  contributionsResults.length + (syncState?.contributions_count || 0),
                  false,
                  'Rate limited'
                )
                rateLimited = true
                break
              }

              if (!contributionsResponse?.ok) {
                hasMore = false
                break
              }

              const contributionsData = await contributionsResponse.json()
              const results = contributionsData.results || []
              const pagination = contributionsData.pagination || {}

              if (results.length > 0) {
                committeeId = candidateCommitteeId
                committeeName = committee.name || ''
                contributionsResults = contributionsResults.concat(results)

                // Capture total count/pages from first response
                if (totalContributionsAvailable === null && typeof pagination.count === 'number') {
                  totalContributionsAvailable = pagination.count
                }
                if (totalPages === null && typeof pagination.pages === 'number') {
                  totalPages = pagination.pages
                }

                const reachedEnd = totalPages !== null ? page >= totalPages : results.length < 100
                if (reachedEnd) {
                  hasMore = false
                  console.log(`Reached end of data for ${member.full_name} cycle ${cycle} at page ${page}`)
                } else {
                  page += 1
                }

                // Save progress checkpoint every 10 pages
                if (pageCount % 10 === 0) {
                  await updateSyncState(
                    supabase,
                    member.id,
                    cycle,
                    page - 1,
                    totalPages,
                    contributionsResults.length + (syncState?.contributions_count || 0),
                    false
                  )
                  console.log(`Progress checkpoint: page ${page-1}/${totalPages || '?'} for ${member.full_name} cycle ${cycle}`)
                }
              } else {
                hasMore = false
              }
            }

            if (contributionsResults.length > 0) {
              console.log(
                `Found ${contributionsResults.length} itemized contributions for ${member.full_name} in cycle ${cycle} (${pageCount} pages)`
              )
              
              // Mark as complete if we reached the end
              const isComplete = !hasMore && !rateLimited
              await updateSyncState(
                supabase,
                member.id,
                cycle,
                page - 1,
                totalPages,
                contributionsResults.length + (syncState?.contributions_count || 0),
                isComplete
              )
              
              break // Found data for this cycle, move to processing
            }
          }

          if (rateLimited) break

          const allContributions: any[] = []
          const sponsors: any[] = []
          const industryTotals = new Map<string, { total: number; count: number }>()
          const contributorAggregates = new Map<string, any>()

          if (contributionsResults.length > 0) {
            for (const c of contributionsResults) {
              const amount = c.contribution_receipt_amount || 0
              if (amount <= 0) continue

              const contributorName = c.contributor_name || 'Unknown'
              const entityType = c.entity_type || null
              const entityTypeDesc = c.entity_type_desc || null
              const contributorType = classifyFromEntityType(entityType, c.contributor_employer, c.contributor_occupation, contributorName)
              const industry = inferIndustry(c.contributor_employer, c.contributor_occupation)
              const contributorState = c.contributor_state || null
              const receiptDate = c.receipt_date || null
              const contributionUid = generateContributionUid(c, member.id)

              allContributions.push({
                member_id: member.id,
                contributor_name: contributorName,
                contributor_type: contributorType,
                amount: amount,
                cycle: cycle,
                industry: industry,
                contributor_state: contributorState,
                receipt_date: receiptDate,
                contributor_city: c.contributor_city || null,
                contributor_zip: c.contributor_zip || null,
                contributor_employer: c.contributor_employer || null,
                contributor_occupation: c.contributor_occupation || null,
                committee_id: committeeId,
                committee_name: committeeName,
                memo_text: c.memo_text || null,
                transaction_type: c.receipt_type || null,
                contribution_uid: contributionUid,
                entity_type: entityType,
                entity_type_desc: entityTypeDesc,
              })

              // Track for sponsors
              const existing = contributorAggregates.get(contributorName)
              if (existing) {
                existing.amount += amount
              } else {
                contributorAggregates.set(contributorName, {
                  name: contributorName,
                  type: contributorType,
                  amount: amount,
                  industry: industry,
                })
              }

              // Track industry totals
              if (industry) {
                const existingIndustry = industryTotals.get(industry) || { total: 0, count: 0 }
                industryTotals.set(industry, {
                  total: existingIndustry.total + amount,
                  count: existingIndustry.count + 1,
                })
              }
            }

            // Identify sponsors from aggregates
            for (const [name, data] of contributorAggregates) {
              if (data.amount >= SPONSOR_THRESHOLD && (data.type === 'pac' || data.type === 'corporate' || data.type === 'union')) {
                let sponsorType = 'corporation'
                if (data.type === 'union') sponsorType = 'union'
                else if (data.type === 'pac') sponsorType = 'trade_association'
                else if (data.type === 'corporate') sponsorType = 'corporation'

                sponsors.push({
                  member_id: member.id,
                  sponsor_name: name,
                  sponsor_type: sponsorType,
                  relationship_type: 'donor',
                  total_support: data.amount,
                  cycle: cycle,
                })
              }
            }

            if (allContributions.length > 0) {
              // Use upsert instead of delete+insert to preserve data during partial syncs
              const { error: insertError } = await supabase
                .from('member_contributions')
                .upsert(allContributions, {
                  onConflict: 'contribution_uid',
                  ignoreDuplicates: false
                })

              if (insertError) {
                console.error(`Error inserting contributions for ${member.full_name} cycle ${cycle}:`, insertError)
              } else {
                console.log(`Upserted ${allContributions.length} contributions for ${member.full_name} cycle ${cycle}`)
                totalContributionsInserted += allContributions.length
                
                // Update funding_metrics with contribution completeness data
                await supabase
                  .from('funding_metrics')
                  .upsert({
                    member_id: member.id,
                    cycle: cycle,
                    contributions_fetched: allContributions.length,
                    contributions_total: totalContributionsAvailable,
                  }, {
                    onConflict: 'member_id,cycle',
                    ignoreDuplicates: false,
                  })
              }
            }
          }

          // Fetch totals for additional sponsor data
          const totalsUrl = `${FEC_API_BASE}/candidate/${candidateId}/totals/?api_key=${FEC_API_KEY}&cycle=${cycle}`
          const { response: totalsResponse, metrics: totalsMetrics } = await fetchWithRetry(totalsUrl, {}, PROVIDER, HTTP_CONFIG)
          apiCalls++
          totalWaitMs += totalsMetrics.totalWaitMs

          if (totalsResponse?.status === 429) {
            rateLimited = true
            break
          }

          if (totalsResponse?.ok) {
            const totalsData = await totalsResponse.json()
            const totals = totalsData.results?.[0]

            if (totals) {
              const pacAmount = totals.other_political_committee_contributions || 0
              const existingPacTotal = sponsors
                .filter(s => s.sponsor_type === 'trade_association')
                .reduce((sum, s) => sum + s.total_support, 0)
              
              if (pacAmount > existingPacTotal && pacAmount > 0) {
                sponsors.push({
                  member_id: member.id,
                  sponsor_name: 'Other PAC Contributions',
                  sponsor_type: 'trade_association',
                  relationship_type: 'pac_support',
                  total_support: pacAmount - existingPacTotal,
                  cycle: cycle,
                })
              }

              const partyAmount = totals.party_committee_contributions || 0
              if (partyAmount > 0) {
                sponsors.push({
                  member_id: member.id,
                  sponsor_name: `${member.party === 'D' ? 'Democratic' : member.party === 'R' ? 'Republican' : 'Independent'} Party Committee`,
                  sponsor_type: 'nonprofit',
                  relationship_type: 'pac_support',
                  total_support: partyAmount,
                  cycle: cycle,
                })

                industryTotals.set('Party Committee Support', { 
                  total: partyAmount, 
                  count: 1 
                })
              }
            }
          }

          // Insert sponsors for this cycle
          if (sponsors.length > 0) {
            await supabase
              .from('member_sponsors')
              .delete()
              .eq('member_id', member.id)
              .eq('cycle', cycle)

            await supabase
              .from('member_sponsors')
              .insert(sponsors)
            
            console.log(`Inserted ${sponsors.length} sponsors for ${member.full_name} cycle ${cycle}`)
          }

          // Insert industry lobbying data for this cycle
          if (industryTotals.size > 0) {
            const lobbyingRecords = Array.from(industryTotals.entries())
              .filter(([_, data]) => data.total >= 1000)
              .map(([industry, data]) => ({
                member_id: member.id,
                industry: industry,
                total_spent: data.total,
                client_count: data.count,
                cycle: cycle,
              }))

            if (lobbyingRecords.length > 0) {
              await supabase
                .from('member_lobbying')
                .delete()
                .eq('member_id', member.id)
                .eq('cycle', cycle)

              await supabase
                .from('member_lobbying')
                .insert(lobbyingRecords)
              
              console.log(`Inserted ${lobbyingRecords.length} industry records for ${member.full_name} cycle ${cycle}`)
            }
          }
        } // End of cycle loop

        // Mark successful sync attempt for this member
        await supabase
          .from('members')
          .update({ fec_last_synced_at: new Date().toISOString() })
          .eq('id', member.id)

        processedCount++

      } catch (memberError) {
        console.error(`Error processing ${member.full_name}:`, memberError)
        errorCount++
      }
    }

    const nextOffset = offset + processedCount
    const { count: totalActiveMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('in_office', true)
    
    const hasMore = nextOffset < (totalActiveMembers || 0)

    // Get total contributions for accurate cumulative progress
    const { count: totalContributions } = await supabase
      .from('member_contributions')
      .select('*', { count: 'exact', head: true })

    // Update watermark
    await updateWatermark(supabase, { memberOffset: hasMore ? nextOffset : 0 }, totalContributions || 0)

    // Update progress and release lock
    await supabase
      .from('sync_progress')
      .update({ 
        current_offset: hasMore ? nextOffset : 0,
        last_matched_count: matchedCount,
        total_processed: totalContributions || 0,
        updated_at: new Date().toISOString(),
        cursor_json: {
          last_offset: nextOffset,
          members_processed: nextOffset,
          total_members: totalActiveMembers,
        },
        metadata: {
          members_processed: nextOffset,
          total_members: totalActiveMembers,
          api_calls: apiCalls,
          wait_time_ms: totalWaitMs,
          cycles_processed: cyclesToProcess,
        }
      })
      .eq('id', JOB_ID)

    await releaseLock(supabase, hasMore ? 'idle' : 'complete', matchedCount, errorCount, lockId)

    // Log job run
    await supabase.from('sync_job_runs').insert({
      job_id: `fec-finance-${Date.now()}`,
      provider: PROVIDER,
      job_type: 'fec_contributions',
      status: 'succeeded',
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      records_fetched: processedCount,
      records_upserted: totalContributionsInserted,
      api_calls: apiCalls,
      wait_time_ms: totalWaitMs,
      metadata: { 
        offset, 
        nextOffset: hasMore ? nextOffset : 0,
        hasMore,
        totalMembers: totalActiveMembers,
        cycles: cyclesToProcess,
      }
    })

    const result = {
      success: true,
      message: 'FEC finance sync batch completed',
      processedCount,
      matchedCount,
      errorCount,
      totalContributionsInserted,
      totalMembers: totalActiveMembers,
      currentOffset: offset,
      nextOffset: hasMore ? nextOffset : 0,
      hasMore,
      apiCalls,
      cycles: cyclesToProcess,
      progress: `${Math.round((nextOffset / (totalActiveMembers || 1)) * 100)}%`,
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
    }

    console.log("Batch complete:", result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in sync-fec-finance:', error)
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    await releaseLock(supabase, 'error', 0, 1, JOB_ID)

    await supabase.from('sync_job_runs').insert({
      job_id: `fec-finance-${Date.now()}`,
      provider: PROVIDER,
      job_type: 'fec_contributions',
      status: 'failed',
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      error: errorMessage,
      api_calls: apiCalls,
      wait_time_ms: totalWaitMs,
    })
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Primary classification using FEC entity_type, with heuristic fallback
function classifyFromEntityType(
  entityType: string | null, 
  employer: string | null, 
  occupation: string | null, 
  contributorName: string | null = null
): string {
  if (entityType) {
    const et = entityType.toUpperCase()
    if (et === 'IND') return 'individual'
    if (et === 'COM' || et === 'PAC' || et === 'PTY' || et === 'CCM') return 'pac'
    if (et === 'ORG') {
      return classifyOrganization(employer, occupation, contributorName)
    }
    if (et === 'CAN') return 'individual'
  }
  
  return categorizeContributorHeuristic(employer, occupation, contributorName)
}

function classifyOrganization(employer: string | null, occupation: string | null, contributorName: string | null): string {
  const name = (contributorName || '').toLowerCase()
  const emp = (employer || '').toLowerCase()
  
  const isUnion = name.includes('union') || name.includes('brotherhood') || 
      name.includes('afl-cio') || name.includes('teamsters') || name.includes('seiu') || 
      name.includes('afscme') || name.includes('ufcw') || name.includes('ibew') ||
      emp.includes('union') || emp.includes('workers') || emp.includes('labor')
  
  if (isUnion) return 'union'
  
  const isCorporate = name.includes('llc') || name.includes(' inc') || name.includes('corp') ||
      name.includes('company') || name.includes('holdings') || name.includes('partners llp')
  
  if (isCorporate) return 'corporate'
  
  return 'organization'
}

function categorizeContributorHeuristic(employer: string | null, occupation: string | null, contributorName: string | null = null): string {
  const emp = (employer || '').toLowerCase()
  const occ = (occupation || '').toLowerCase()
  const name = (contributorName || '').toLowerCase()

  const isPacByName = name.includes('pac') || name.includes('committee') || 
      name.includes('for congress') || name.includes('for senate') || 
      name.includes('for america') || name.includes('for us') ||
      name.includes('victory fund') || name.includes('leadership fund') ||
      name.includes('action fund') || name.includes('actblue') || name.includes('winred') ||
      name.includes('democratic') || name.includes('republican') ||
      (name.includes(' inc') && (name.includes('for ') || name.includes('elect')))
  
  if (isPacByName) return 'pac'

  if (emp.includes('pac') || emp.includes('committee') || emp.includes('political') || 
      emp.includes('action committee') || emp.includes('for congress') || emp.includes('for senate')) {
    return 'pac'
  }
  
  const isUnion = name.includes('union') || name.includes('brotherhood') || 
      name.includes('afl-cio') || name.includes('teamsters') || name.includes('seiu') || 
      name.includes('afscme') || name.includes('ufcw') || name.includes('ibew') ||
      emp.includes('union') || emp.includes('workers') || emp.includes('labor') || 
      emp.includes('brotherhood') || emp.includes('afl-cio') || emp.includes('teamsters') ||
      emp.includes('seiu') || emp.includes('afscme')
  
  if (isUnion) return 'union'
  
  const isCorporate = name.includes('llc') || name.includes(' inc') || name.includes('corp') ||
      name.includes('company') || name.includes('holdings') || name.includes('partners llp') ||
      emp.includes('llc') || emp.includes('inc') || emp.includes('corp') || 
      emp.includes('co.') || emp.includes('company') || emp.includes('group') ||
      emp.includes('holdings') || emp.includes('partners') || emp.includes('capital') ||
      emp.includes('associates') || emp.includes('industries')
  
  if (isCorporate && !isPacByName && !name.includes('for ')) {
    return 'corporate'
  }

  if (emp.includes('self') || emp.includes('retired') || emp.includes('homemaker') ||
      emp.includes('not employed') || emp.includes('none') || emp === '' ||
      occ.includes('retired') || occ.includes('homemaker')) {
    return 'individual'
  }
  
  return 'individual'
}

function inferIndustry(employer: string | null, occupation: string | null): string | null {
  const combined = ((employer || '') + ' ' + (occupation || '')).toLowerCase()

  if (combined.includes('law') || combined.includes('attorney') || combined.includes('legal') || combined.includes('lawyer')) return 'Legal'
  if (combined.includes('real estate') || combined.includes('realtor') || combined.includes('property') || combined.includes('realty')) return 'Real Estate'
  if (combined.includes('health') || combined.includes('medical') || combined.includes('doctor') || combined.includes('hospital') || combined.includes('physician') || combined.includes('nurse') || combined.includes('pharma')) return 'Healthcare'
  if (combined.includes('bank') || combined.includes('financial') || combined.includes('investment') || combined.includes('insurance') || combined.includes('hedge') || combined.includes('private equity') || combined.includes('venture')) return 'Finance & Insurance'
  if (combined.includes('tech') || combined.includes('software') || combined.includes('computer') || combined.includes('engineer') || combined.includes('google') || combined.includes('microsoft') || combined.includes('apple') || combined.includes('meta') || combined.includes('amazon')) return 'Technology'
  if (combined.includes('oil') || combined.includes('gas') || combined.includes('energy') || combined.includes('utility') || combined.includes('petroleum') || combined.includes('solar') || combined.includes('renewable')) return 'Energy'
  if (combined.includes('construction') || combined.includes('builder') || combined.includes('contractor') || combined.includes('architect')) return 'Construction'
  if (combined.includes('retired')) return 'Retired'
  if (combined.includes('education') || combined.includes('teacher') || combined.includes('professor') || combined.includes('university') || combined.includes('school')) return 'Education'
  if (combined.includes('farm') || combined.includes('agri') || combined.includes('ranch') || combined.includes('cattle')) return 'Agriculture'
  if (combined.includes('media') || combined.includes('entertainment') || combined.includes('film') || combined.includes('tv') || combined.includes('broadcast') || combined.includes('news')) return 'Media & Entertainment'
  if (combined.includes('defense') || combined.includes('military') || combined.includes('aerospace') || combined.includes('lockheed') || combined.includes('boeing') || combined.includes('raytheon')) return 'Defense & Aerospace'
  if (combined.includes('telecom') || combined.includes('communications') || combined.includes('wireless') || combined.includes('verizon') || combined.includes('at&t')) return 'Telecommunications'
  if (combined.includes('retail') || combined.includes('store') || combined.includes('walmart') || combined.includes('target')) return 'Retail'
  if (combined.includes('transport') || combined.includes('logistics') || combined.includes('shipping') || combined.includes('airline') || combined.includes('trucking')) return 'Transportation'
  if (combined.includes('lobby') || combined.includes('government relations') || combined.includes('public affairs')) return 'Lobbying'
  
  return null
}
