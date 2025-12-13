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
const MAX_DURATION_SECONDS = 240
const BATCH_SIZE = 15
const CURRENT_CYCLE = 2024

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
async function acquireLock(supabase: any): Promise<boolean> {
  const now = new Date()
  const lockUntil = new Date(now.getTime() + MAX_DURATION_SECONDS * 1000)

  const { data: progress } = await supabase
    .from('sync_progress')
    .select('status, lock_until')
    .eq('id', JOB_ID)
    .single()

  if (progress) {
    const existingLock = progress.lock_until ? new Date(progress.lock_until) : null
    if (existingLock && existingLock > now) {
      console.log(`Job ${JOB_ID} is locked until ${existingLock.toISOString()}`)
      return false
    }
    if (progress.status === 'running') {
      console.log(`Job ${JOB_ID} is already running`)
      return false
    }
  }

  await supabase
    .from('sync_progress')
    .upsert({
      id: JOB_ID,
      status: 'running',
      lock_until: lockUntil.toISOString(),
      last_run_at: now.toISOString(),
    }, { onConflict: 'id' })

  return true
}

// Helper: Release job lock
async function releaseLock(supabase: any, status: string, successCount: number, failureCount: number) {
  await supabase
    .from('sync_progress')
    .update({
      status,
      lock_until: null,
      last_success_count: successCount,
      last_failure_count: failureCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', JOB_ID)
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

    // Try to acquire lock
    if (!await acquireLock(supabase)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Job is locked or already running' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get watermark for incremental sync
    const { lastCursor } = await getWatermark(supabase)
    let offset = lastCursor?.memberOffset || 0
    let limit = BATCH_SIZE

    // Parse request options
    try {
      const body = await req.json()
      if (body.reset) offset = 0
      if (body.limit) limit = Math.min(body.limit, 50)
    } catch {
      // Use defaults
    }

    console.log(`Starting FEC finance sync (offset: ${offset}, limit: ${limit})...`)

    // Get members to sync
    const { data: members, count: totalMembers } = await supabase
      .from('members')
      .select('id, bioguide_id, first_name, last_name, full_name, state, party, chamber', { count: 'exact' })
      .eq('in_office', true)
      .order('last_name')
      .range(offset, offset + limit - 1)

    if (!members || members.length === 0) {
      console.log('All members processed. Resetting offset.')
      await releaseLock(supabase, 'complete', 0, 0)
      await updateWatermark(supabase, { memberOffset: 0 }, 0)
      
      return new Response(JSON.stringify({
        success: true,
        message: 'All members processed. Will restart on next run.',
        totalMembers,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
        let matchingCandidate = null
        const memberLastName = member.last_name.toLowerCase().replace(/[^a-z]/g, '')
        const memberFirstName = member.first_name.toLowerCase().replace(/[^a-z]/g, '')
        
        // Score-based matching for better accuracy
        let bestScore = 0
        let bestCandidate = null
        
        for (const c of candidates) {
          if (!c.name) continue
          const fecName = c.name.toLowerCase()
          const nameParts = fecName.split(',')
          const fecLastName = nameParts[0]?.trim().replace(/[^a-z]/g, '') || ''
          const fecFirstPart = nameParts[1]?.trim().split(' ')[0]?.replace(/[^a-z]/g, '') || ''
          
          // Last name must match exactly
          if (fecLastName !== memberLastName) continue
          
          let score = 0
          
          // Exact first name match = 100 points
          if (fecFirstPart === memberFirstName) {
            score = 100
          }
          // First name starts with member's first name (e.g., "al" matches "albert")
          else if (fecFirstPart.startsWith(memberFirstName) && memberFirstName.length >= 2) {
            score = 80
          }
          // Member's first name starts with FEC first name (e.g., "albert" matches "al")
          else if (memberFirstName.startsWith(fecFirstPart) && fecFirstPart.length >= 2) {
            score = 70
          }
          // At least 3 chars match at start (weak match)
          else if (fecFirstPart.length >= 3 && memberFirstName.length >= 3 && 
                   fecFirstPart.substring(0, 3) === memberFirstName.substring(0, 3)) {
            score = 50
          }
          // No first name match = skip (avoid wrong matches like "Al Green" -> "James Green")
          else {
            continue
          }
          
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

        if (!matchingCandidate) {
          console.log(`No FEC match for ${member.full_name} (best score: ${bestScore})`)
          processedCount++
          continue
        }

        const candidateId = matchingCandidate.candidate_id
        matchedCount++

        // Get committees using httpClient
        const committeesUrl = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${FEC_API_KEY}&per_page=5`
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

        const principalCommittee = committees.find((c: any) => c.committee_type === 'P') || committees[0]
        const committeeId = principalCommittee.committee_id
        const committeeName = principalCommittee.name || ''

        // Fetch itemized contributions using httpClient
        const contributionsUrl = `${FEC_API_BASE}/schedules/schedule_a/?api_key=${FEC_API_KEY}&committee_id=${committeeId}&two_year_transaction_period=${CURRENT_CYCLE}&sort=-contribution_receipt_amount&per_page=100`
        const { response: contributionsResponse, metrics: contributionsMetrics } = await fetchWithRetry(contributionsUrl, {}, PROVIDER, HTTP_CONFIG)
        apiCalls++
        totalWaitMs += contributionsMetrics.totalWaitMs

        const allContributions: any[] = []
        const sponsors: any[] = []
        const industryTotals = new Map<string, { total: number; count: number }>()
        const contributorAggregates = new Map<string, any>()

        if (contributionsResponse?.ok) {
          const contributionsData = await contributionsResponse.json()
          const contributions = contributionsData.results || []

          for (const c of contributions) {
            const amount = c.contribution_receipt_amount || 0
            if (amount <= 0) continue

            let contributorName = c.contributor_name || 'Unknown'
            const contributorType = categorizeContributor(c.contributor_employer, c.contributor_occupation, contributorName)
            
            if (c.committee && c.committee.name) {
              contributorName = c.committee.name
            } else if (c.contributor_aggregate_ytd > 200 && contributorType === 'pac') {
              contributorName = c.contributor_name || 'Unknown PAC'
            }
            
            const industry = inferIndustry(c.contributor_employer, c.contributor_occupation)
            const contributorState = c.contributor_state || null
            const receiptDate = c.receipt_date || null

            const contributionUid = generateContributionUid(c, member.id)
            
            allContributions.push({
              member_id: member.id,
              contributor_name: contributorName,
              contributor_type: contributorType,
              amount: amount,
              cycle: CURRENT_CYCLE,
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
                count: existingIndustry.count + 1 
              })
            }
          }

          // Identify sponsors from aggregates
          for (const [name, data] of contributorAggregates) {
            if (data.amount >= SPONSOR_THRESHOLD && (data.type === 'pac' || data.type === 'corporate' || data.type === 'union')) {
              sponsors.push({
                member_id: member.id,
                sponsor_name: name,
                sponsor_type: data.type,
                relationship_type: 'major_donor',
                total_support: data.amount,
                cycle: CURRENT_CYCLE,
              })
            }
          }

          // Use upsert with contribution_uid for idempotent inserts
          if (allContributions.length > 0) {
            await supabase
              .from('member_contributions')
              .delete()
              .eq('member_id', member.id)
              .eq('cycle', CURRENT_CYCLE)

            const { error: insertError } = await supabase
              .from('member_contributions')
              .insert(allContributions)
            
            if (insertError) {
              console.error(`Error inserting contributions for ${member.full_name}:`, insertError)
            } else {
              console.log(`Inserted ${allContributions.length} contributions for ${member.full_name}`)
            }
          }
        }

        // Fetch totals for additional sponsor data
        const totalsUrl = `${FEC_API_BASE}/candidate/${candidateId}/totals/?api_key=${FEC_API_KEY}&cycle=${CURRENT_CYCLE}`
        const { response: totalsResponse, metrics: totalsMetrics } = await fetchWithRetry(totalsUrl, {}, PROVIDER, HTTP_CONFIG)
        apiCalls++
        totalWaitMs += totalsMetrics.totalWaitMs

        if (totalsResponse?.ok) {
          const totalsData = await totalsResponse.json()
          const totals = totalsData.results?.[0]

          if (totals) {
            const pacAmount = totals.other_political_committee_contributions || 0
            const existingPacTotal = sponsors
              .filter(s => s.sponsor_type === 'pac')
              .reduce((sum, s) => sum + s.total_support, 0)
            
            if (pacAmount > existingPacTotal && pacAmount > 0) {
              sponsors.push({
                member_id: member.id,
                sponsor_name: 'Other PAC Contributions',
                sponsor_type: 'pac',
                relationship_type: 'contributor',
                total_support: pacAmount - existingPacTotal,
                cycle: CURRENT_CYCLE,
              })
            }

            const partyAmount = totals.party_committee_contributions || 0
            if (partyAmount > 0) {
              sponsors.push({
                member_id: member.id,
                sponsor_name: `${member.party === 'D' ? 'Democratic' : member.party === 'R' ? 'Republican' : 'Independent'} Party Committee`,
                sponsor_type: 'party',
                relationship_type: 'party_support',
                total_support: partyAmount,
                cycle: CURRENT_CYCLE,
              })

              industryTotals.set('Party Committee Support', { 
                total: partyAmount, 
                count: 1 
              })
            }
          }
        }

        // Insert sponsors
        if (sponsors.length > 0) {
          await supabase
            .from('member_sponsors')
            .delete()
            .eq('member_id', member.id)
            .eq('cycle', CURRENT_CYCLE)

          await supabase
            .from('member_sponsors')
            .insert(sponsors)
          
          console.log(`Inserted ${sponsors.length} sponsors for ${member.full_name}`)
        }

        // Insert industry lobbying data
        if (industryTotals.size > 0) {
          const lobbyingRecords = Array.from(industryTotals.entries())
            .filter(([_, data]) => data.total >= 1000)
            .map(([industry, data]) => ({
              member_id: member.id,
              industry: industry,
              total_spent: data.total,
              client_count: data.count,
              cycle: CURRENT_CYCLE,
            }))

          if (lobbyingRecords.length > 0) {
            await supabase
              .from('member_lobbying')
              .delete()
              .eq('member_id', member.id)
              .eq('cycle', CURRENT_CYCLE)

            await supabase
              .from('member_lobbying')
              .insert(lobbyingRecords)
            
            console.log(`Inserted ${lobbyingRecords.length} industry records for ${member.full_name}`)
          }
        }

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

    await releaseLock(supabase, hasMore ? 'idle' : 'complete', matchedCount, errorCount)

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
    
    await releaseLock(supabase, 'error', 0, 1)
    
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

function categorizeContributor(employer: string | null, occupation: string | null, contributorName: string | null = null): string {
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
