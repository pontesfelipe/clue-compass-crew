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
const MAX_DURATION_SECONDS = 280 // Increased to allow more pagination
const BATCH_SIZE = 10 // Fewer members per batch to allow deeper pagination per member
const CURRENT_CYCLE = (() => {
  const y = new Date().getFullYear()
  return y % 2 === 0 ? y : y + 1
})()
// FEC cycles are even years - include future cycle for Senators fundraising ahead
// Go back further in history for complete data
const CYCLES_TO_TRY = [CURRENT_CYCLE + 2, CURRENT_CYCLE, CURRENT_CYCLE - 2, CURRENT_CYCLE - 4, CURRENT_CYCLE - 6, CURRENT_CYCLE - 8]
const HTTP_CONFIG: HttpClientConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
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

    // If a previous run crashed, status may remain "running" even though the lock expired.
    // Treat that as stale and allow a new run to start.
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
    const isSingleMemberRun = !!memberIdFilter
    const lockId = memberIdFilter ? `${JOB_ID}:${memberIdFilter}` : JOB_ID

    // Try to acquire lock
    if (!await acquireLock(supabase, lockId)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Job is locked or already running' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get watermark for incremental sync
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
        if (body.limit) limit = Math.min(body.limit, 50)
      } catch {
        // Use defaults
      }
    }

    console.log(`Starting FEC finance sync (offset: ${offset}, limit: ${limit})...`)

    // Get members to sync - include fec_candidate_id to avoid re-searching
    let membersQuery = supabase
      .from('members')
      .select(
        'id, bioguide_id, first_name, last_name, full_name, state, party, chamber, fec_candidate_id, fec_committee_ids',
        { count: 'exact' }
      )

    if (isSingleMemberRun && memberIdFilter) {
      membersQuery = membersQuery.eq('id', memberIdFilter)
    } else {
      membersQuery = membersQuery
        .eq('in_office', true)
        .order('last_name')
        .range(offset, offset + limit - 1)
    }

    const { data: members, count: totalMembers } = await membersQuery

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

    console.log(`Processing ${members.length} members (${offset + 1} to ${offset + members.length} of ${totalMembers})`)

    let processedCount = 0
    let matchedCount = 0
    let errorCount = 0

    for (const member of members) {
      // Check if we're running out of time
      if (Date.now() - startTime > (MAX_DURATION_SECONDS - 30) * 1000) {
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
        
        // Check if we already have a cached FEC candidate ID
        let matchingCandidate: any = null
        let bestScore = 0
        
        if (member.fec_candidate_id) {
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
          
          // Find matching candidate - STRICT first name matching to avoid wrong matches
          const memberLastName = member.last_name.toLowerCase().replace(/[^a-z]/g, '')
          const memberFirstName = member.first_name.toLowerCase().replace(/[^a-z]/g, '')
          
          // Get possible legal names from nickname map
          const possibleFirstNames = [memberFirstName]
          if (NICKNAME_MAP[memberFirstName]) {
            possibleFirstNames.push(...NICKNAME_MAP[memberFirstName])
          }
          // Also check reverse - if member uses legal name but FEC has nickname
          for (const [nickname, legalNames] of Object.entries(NICKNAME_MAP)) {
            if (legalNames.includes(memberFirstName)) {
              possibleFirstNames.push(nickname)
            }
          }
          
          // Score-based matching for better accuracy
          let bestCandidate: any = null
          
          for (const c of candidates) {
            if (!c.name) continue
            const fecName = c.name.toLowerCase()
            const nameParts = fecName.split(',')
            const fecLastName = nameParts[0]?.trim().replace(/[^a-z]/g, '') || ''
            const fecFirstPart = nameParts[1]?.trim().split(' ')[0]?.replace(/[^a-z]/g, '') || ''
            
            // Last name must match exactly
            if (fecLastName !== memberLastName) continue
            
            let score = 0
            
            // Check against all possible first names (including nicknames)
            for (const possibleName of possibleFirstNames) {
              // Exact first name match = 100 points
              if (fecFirstPart === possibleName) {
                score = Math.max(score, possibleName === memberFirstName ? 100 : 90) // Slight penalty for nickname match
              }
              // First name starts with possible name (e.g., "al" matches "albert")
              else if (fecFirstPart.startsWith(possibleName) && possibleName.length >= 2) {
                score = Math.max(score, 80)
              }
              // Possible name starts with FEC first name (e.g., "albert" matches "al")
              else if (possibleName.startsWith(fecFirstPart) && fecFirstPart.length >= 2) {
                score = Math.max(score, 70)
              }
              // At least 3 chars match at start (weak match)
              else if (fecFirstPart.length >= 3 && possibleName.length >= 3 && 
                       fecFirstPart.substring(0, 3) === possibleName.substring(0, 3)) {
                score = Math.max(score, 50)
              }
            }
            
            // No first name match = skip
            if (score === 0) continue
            
            // Bonus for matching office type
            if (c.office === office) score += 10
            
            // Bonus for recent election years
            if (c.election_years?.includes(2024)) score += 5
            if (c.election_years?.includes(2022)) score += 3
            
            if (score > bestScore) {
              bestScore = score
              bestCandidate = c
            }
          }
          
          // Require minimum score of 50 to prevent bad matches
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
          const { error: updateCandidateError } = await supabase
            .from('members')
            .update({ 
              fec_candidate_id: candidateId,
              fec_last_synced_at: new Date().toISOString()
            })
            .eq('id', member.id)
          
          if (updateCandidateError) {
            console.error(`Failed to store FEC candidate ID for ${member.full_name}:`, updateCandidateError)
          } else {
            console.log(`Stored FEC candidate ID ${candidateId} for ${member.full_name}`)
          }
        }

        // Get committees using httpClient
        // NOTE: per_page=5 can miss the principal committee; use a higher page size.
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

        // Persist committee IDs for debugging and future syncs
        const fetchedCommitteeIds = Array.from(
          new Set(
            committees
              .map((c: any) => c.committee_id)
              .filter((id: any) => typeof id === 'string' && id.length > 0)
          )
        ).sort()

        const existingCommitteeIds = Array.from(new Set((member.fec_committee_ids || []).filter(Boolean))).sort()
        if (fetchedCommitteeIds.join(',') !== existingCommitteeIds.join(',')) {
          const { error: updateCommitteesError } = await supabase
            .from('members')
            .update({ fec_committee_ids: fetchedCommitteeIds })
            .eq('id', member.id)

          if (updateCommitteesError) {
            console.error(`Failed to store FEC committee IDs for ${member.full_name}:`, updateCommitteesError)
          }
        }

        // Pick the best committee for itemized contributions.
        // Start with principal ('P'), but fall back to other committees if the principal returns 0 items.
        const committeeCandidates = [
          committees.find((c: any) => c.committee_type === 'P'),
          ...committees.filter((c: any) => c.committee_type !== 'P'),
        ].filter(Boolean)

        const defaultCommitteeId = committeeCandidates[0].committee_id
        const defaultCommitteeName = committeeCandidates[0].name || ''

        // Process ALL cycles to get complete historical data
        let rateLimited = false
        for (const cycle of CYCLES_TO_TRY) {
          if (rateLimited) break

          let committeeId = defaultCommitteeId
          let committeeName = defaultCommitteeName
          let contributionsResults: any[] = []
          let totalContributionsAvailable: number | null = null // Track FEC total count

          // Try each committee for this cycle - paginate to get ALL contributions
          for (const committee of committeeCandidates.slice(0, 5)) {
            const candidateCommitteeId = committee.committee_id
            if (!candidateCommitteeId) continue

            // Fetch itemized contributions with pagination to get ALL donors (FEC returns max 100 per page)
            // NOTE: We use page-based pagination because last_indexes is not always returned reliably.
            let hasMore = true
            // Increase MAX_PAGES significantly to capture ALL contributions
            // FEC allows up to 100 pages per request, so 100 pages = 10,000 contributions max
            // For high-profile members like Senators, they may have 5,000+ contributions per cycle
            const MAX_PAGES = isSingleMemberRun ? 500 : 100 // Much higher limits to get complete data
            let pageCount = 0
            let page = 1
            let totalPages: number | null = null

            while (hasMore && pageCount < MAX_PAGES && !rateLimited) {
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

                // Capture total count/pages from first response (if provided)
                if (totalContributionsAvailable === null && typeof pagination.count === 'number') {
                  totalContributionsAvailable = pagination.count
                }
                if (totalPages === null && typeof pagination.pages === 'number') {
                  totalPages = pagination.pages
                }

                const reachedEnd = totalPages !== null ? page >= totalPages : results.length < 100
                if (reachedEnd) {
                  hasMore = false
                } else {
                  page += 1
                }
              } else {
                hasMore = false
              }
            }

            if (contributionsResults.length > 0) {
              console.log(
                `Found ${contributionsResults.length} itemized contributions for ${member.full_name} in cycle ${cycle} (${pageCount} pages)`
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
              await supabase
                .from('member_contributions')
                .delete()
                .eq('member_id', member.id)
                .eq('cycle', cycle)

              const { error: insertError } = await supabase
                .from('member_contributions')
                .insert(allContributions)

              if (insertError) {
                console.error(`Error inserting contributions for ${member.full_name} cycle ${cycle}:`, insertError)
              } else {
                console.log(`Inserted ${allContributions.length} contributions for ${member.full_name} cycle ${cycle}`)
                
                // Update funding_metrics with contribution completeness data
                const { error: metricsError } = await supabase
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
                
                if (metricsError) {
                  console.error(`Error updating contribution completeness for ${member.full_name} cycle ${cycle}:`, metricsError)
                } else {
                  console.log(`Updated contribution completeness: ${allContributions.length}/${totalContributionsAvailable || 'unknown'} for ${member.full_name} cycle ${cycle}`)
                }
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

            const { error: insertSponsorsError } = await supabase
              .from('member_sponsors')
              .insert(sponsors)
            
            if (insertSponsorsError) {
              console.error(`Error inserting sponsors for ${member.full_name} cycle ${cycle}:`, insertSponsorsError)
            } else {
              console.log(`Inserted ${sponsors.length} sponsors for ${member.full_name} cycle ${cycle}`)
            }
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
    const hasMore = nextOffset < (totalMembers || 0)

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
          total_members: totalMembers,
        },
        metadata: {
          members_processed: nextOffset,
          total_members: totalMembers,
          api_calls: apiCalls,
          wait_time_ms: totalWaitMs,
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
      records_upserted: matchedCount,
      api_calls: apiCalls,
      wait_time_ms: totalWaitMs,
      metadata: { 
        offset, 
        nextOffset: hasMore ? nextOffset : 0,
        hasMore,
        totalMembers
      }
    })

    const result = {
      success: true,
      message: 'FEC finance sync batch completed',
      processedCount,
      matchedCount,
      errorCount,
      totalMembers,
      currentOffset: offset,
      nextOffset: hasMore ? nextOffset : 0,
      hasMore,
      apiCalls,
      progress: `${Math.round((nextOffset / (totalMembers || 1)) * 100)}%`,
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
    
    // Try to release lock - use JOB_ID as fallback since lockId may not be available in catch
    await releaseLock(supabase, 'error', 0, 1, JOB_ID)

    // Log failed job run
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
  // FEC entity_type codes:
  // IND = Individual
  // COM = Committee (PAC, party, etc.)
  // ORG = Organization  
  // CAN = Candidate
  // PAC = Political Action Committee
  // PTY = Party Organization
  // CCM = Candidate Committee
  
  if (entityType) {
    const et = entityType.toUpperCase()
    if (et === 'IND') return 'individual'
    if (et === 'COM' || et === 'PAC' || et === 'PTY' || et === 'CCM') return 'pac'
    if (et === 'ORG') {
      // Organization - check if it's a union or corporate
      return classifyOrganization(employer, occupation, contributorName)
    }
    if (et === 'CAN') return 'individual' // Treat candidate contributions as individual
  }
  
  // Fallback to heuristic classification
  return categorizeContributorHeuristic(employer, occupation, contributorName)
}

// Classify ORG entity types into union, corporate, or organization
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

// Heuristic fallback when entity_type is not available
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
