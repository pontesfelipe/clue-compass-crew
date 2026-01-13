# FEC Donor Data Integration - Comprehensive Implementation Guide

**Date**: January 13, 2026
**Project**: CivicScore
**Issue**: Incomplete campaign finance data (missing donor information, limited to ~100 donors per member, only 2024 data)

---

## Executive Summary

### Current Problems
1. **~100 Donor Limit**: Most members have only 100-300 donors instead of their full contribution history (10,000-50,000+)
2. **Only 2024 Data**: Despite code attempting to fetch 6 cycles (2026, 2024, 2022, 2020, 2018, 2016), only 2024 data is populated
3. **Missing Data**: Many members have no donor information at all (~15-20%)

### Root Causes Identified
1. **Time Constraint**: Function times out after 280 seconds, processing 10 members with 6 cycles each = insufficient time
2. **Sequential Cycle Processing**: Tries to fetch all 6 cycles for each member but runs out of time after first cycle (2024)
3. **No Resumable Pagination**: When function times out, it restarts from page 1, wasting work
4. **Inefficient Batching**: Processing 10 members simultaneously means none complete fully
5. **FEC Matching Issues**: ~15-20% of members fail to match FEC candidate database

### Solution Overview
Implement a **cycle-specific, resumable pagination system** with priority-based processing to systematically complete all donor data across all cycles for all members.

**Expected Results After Implementation**:
- ✅ **10,000-50,000 donors per member** (vs current ~100)
- ✅ **Complete historical data** (2016-2024, all 6 cycles)
- ✅ **100% member coverage** (all members with FEC data synced)
- ✅ **Automatic maintenance** (ongoing updates work correctly)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Recommended Solution](#recommended-solution)
4. [Implementation Steps](#implementation-steps)
5. [Code Changes Required](#code-changes-required)
6. [Testing & Validation](#testing-and-validation)
7. [Maintenance & Monitoring](#maintenance-and-monitoring)

---

## 1. Current State Analysis

### Current Architecture (sync-fec-finance)

**File**: `/supabase/functions/sync-fec-finance/index.ts`

**How it works**:
- Processes **10 members per batch** (line 15: `BATCH_SIZE = 10`)
- Attempts to fetch **6 cycles** per member (2026, 2024, 2022, 2020, 2018, 2016) - line 22
- Max duration: **280 seconds** per invocation (line 14)
- Max pages per member: **100 pages in batch mode** (line 553) = 10,000 max contributions
- Max pages for single member: **500 pages** = 50,000 contributions

### Time Budget Breakdown
```
280 seconds total ÷ 10 members = 28 seconds per member
28 seconds ÷ 6 cycles = 4.6 seconds per cycle
4.6 seconds ÷ 100 pages = 0.046 seconds per page (impossible!)
```

**Reality**: Function times out after fetching 1-3 pages (~100-300 donors) per member before moving to next member.

---

## Root Cause Analysis

### Problem 1: Time-Based Constraints
**File**: `/supabase/functions/sync-fec-finance/index.ts`

```typescript
// Lines 14-15
const MAX_DURATION_SECONDS = 280  // 4.6 minute edge function timeout
const BATCH_SIZE = 10             // 10 members per batch

// Line 553
const MAX_PAGES = isSingleMemberRun ? 500 : 100 // 100 pages = 10,000 contributions max
```

**Problem**:
- 280 seconds ÷ 10 members = 28 seconds per member
- Each API call takes ~1-2 seconds (with retries)
- Result: Only 1-3 pages fetched per member per cycle (~100-300 donors)

### Why Only 2024 Data?

**Location**: `supabase/functions/sync-fec-finance/index.ts:534-842`

```typescript
for (const cycle of CYCLES_TO_TRY) {  // [2026, 2024, 2022, 2020, 2018, 2016]
  // Process cycle...

  // Check if we're running out of time (line 330-332)
  if (Date.now() - startTime > (MAX_DURATION_SECONDS - 30) * 1000) {
    console.log('Approaching time limit, stopping batch early')
    break
  }
}
```

**Problem**: Function tries to process ALL 6 cycles sequentially in ONE run with only 280 seconds total. After completing 2024 data for first member, time runs out before reaching older cycles.

### Root Causes Identified

#### 1. Time-Based Constraint
- **Location**: `supabase/functions/sync-fec-finance/index.ts:14-15`
- **Problem**: `MAX_DURATION_SECONDS = 280` seconds divided by `BATCH_SIZE = 10` members = 28 seconds per member
- **Reality**: FEC API is slow, only processes 1-3 pages (~100-300 donors) before timeout

#### 2. Sequential Cycle Processing
**Location**: `supabase/functions/sync-fec-finance/index.ts:534-842`

The function tries to process 6 cycles (2026, 2024, 2022, 2020, 2018, 2016) sequentially in ONE execution:
```typescript
for (const cycle of CYCLES_TO_TRY) {
  // Fetch all contributions for this cycle...
  // Process sponsors, lobbying, metrics...
}
```

**Problem**: Times out after completing only the first cycle (2024), leaving 2022-2016 empty.

### 3. Pagination Issues
**Location**: `supabase/functions/sync-fec-finance/index.ts:553-613`

```typescript
const MAX_PAGES = isSingleMemberRun ? 500 : 100 // Only 100 pages in batch mode
let page = 1
while (hasMore && pageCount < MAX_PAGES && !rateLimited) {
  // Fetch 100 records per page
  // Reality: Times out after 1-3 pages due to time constraints
}
```

**Issues**:
- Batch mode limited to 100 pages = 10,000 contributions max
- Time constraint (280 seconds ÷ 10 members = 28 seconds per member)
- Function times out after fetching 1-3 pages (~100-300 donors)
- Next batch restarts from different members, never completing previous members

### 4. **Missing Historical Data** (Line 534-842)
**Location**: `supabase/functions/sync-fec-finance/index.ts:534-842`

```typescript
// Process ALL cycles to get complete historical data
let rateLimited = false
for (const cycle of CYCLES_TO_TRY) {
  if (rateLimited) break
  // ... fetch contributions for this cycle
}
```

**Problem**: Function tries to process 6 cycles (2026, 2024, 2022, 2020, 2018, 2016) sequentially in ONE run:
- Time runs out after first cycle (usually 2024)
- Older cycles never get processed
- Next batch starts with different members

### Time Budget Analysis
```
MAX_DURATION_SECONDS = 280  // 4.6 minutes total
BATCH_SIZE = 10             // 10 members per run
Per Member = 280 / 10 = 28 seconds each

With 6 cycles to process:
28 seconds ÷ 6 cycles = 4.6 seconds per cycle
4.6 seconds ÷ 100 pages max = 0.046 seconds per page

Reality: Only completes 1-3 pages before timeout
```

---

## Root Cause Analysis

### 1. Time Constraint Problem (Line 14, 330-332)
```typescript
const MAX_DURATION_SECONDS = 280 // Edge function timeout
const BATCH_SIZE = 10

// Inside member loop:
if (Date.now() - startTime > (MAX_DURATION_SECONDS - 30) * 1000) {
  console.log('Approaching time limit, stopping batch early')
  break
}
```

**Issue**: Trying to do too much in one function invocation:
- 10 members × 6 cycles × 100 pages = 6,000 API calls potential
- Reality: Completes ~10-30 pages total before timeout
- No resumable state per member+cycle

### 2. Sequential Cycle Processing (Lines 534-842)
```typescript
for (const cycle of CYCLES_TO_TRY) {
  if (rateLimited) break
  // Process contributions for this cycle
  // ...lots of API calls...
}
```

**Issue**: Cycles processed sequentially in one run:
- If function times out after 2024 cycle, loses progress on 2022, 2020, etc.
- Next batch starts with NEW members instead of continuing cycles for current members
- No tracking of which cycles are complete per member

### 3. No Resumable Pagination (Lines 558-613)
```typescript
let page = 1
while (hasMore && pageCount < MAX_PAGES && !rateLimited) {
  // Fetch page
  page += 1
}
```

**Issue**: No persistence of pagination state:
- If timeout occurs at page 47, next run starts at page 1 again
- Duplicate work, wasted API calls
- Never reaches deep pages for high-volume members

### 4. Batch Processing Inefficiency (Lines 281-295)
```typescript
let offset = lastCursor?.memberOffset || 0
let limit = BATCH_SIZE // 10 members

membersQuery = membersQuery
  .eq('in_office', true)
  .order('last_name')
  .range(offset, offset + limit - 1)
```

**Issue**: Processes random 10-member batches:
- Members with incomplete data get same priority as complete ones
- No focus on filling gaps
- 535 members ÷ 10 per batch = ~54 batches needed for one full pass

### 5. FEC Matching Failures (Lines 346-458)
```typescript
if (!matchingCandidate) {
  console.log(`No FEC match for ${member.full_name}`)
  processedCount++
  continue // Skip member entirely
}
```

**Issue**: ~15-20% of members fail to match FEC database:
- Name variations not handled well
- No manual override table
- Members permanently skipped

---

## Recommended Solution Architecture

### Strategy: Cycle-Specific Jobs + Resumable Pagination + Priority Queue

#### Phase 1: Core Infrastructure Changes

##### 1.1 Create Sync State Table for Resumable Pagination

**File**: `supabase/migrations/YYYYMMDDHHMMSS_fec_sync_state.sql`

```sql
-- Track FEC sync state per member per cycle for resumable pagination
CREATE TABLE IF NOT EXISTS public.fec_sync_state (
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL,
  last_page_fetched INTEGER DEFAULT 0,
  total_pages_estimated INTEGER,
  contributions_count INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  PRIMARY KEY (member_id, cycle)
);

-- Index for priority queue queries
CREATE INDEX IF NOT EXISTS idx_fec_sync_state_incomplete
  ON public.fec_sync_state (is_complete, contributions_count, last_synced_at)
  WHERE is_complete = FALSE;

-- Index for monitoring
CREATE INDEX IF NOT EXISTS idx_fec_sync_state_member_cycle
  ON public.fec_sync_state (member_id, cycle);

-- Index for cycle-specific queries
CREATE INDEX IF NOT EXISTS idx_fec_sync_state_cycle
  ON public.fec_sync_state (cycle, is_complete);

COMMENT ON TABLE public.fec_sync_state IS 'Tracks FEC contribution sync progress per member per cycle for resumable pagination';
COMMENT ON COLUMN public.fec_sync_state.last_page_fetched IS 'Last FEC API page successfully fetched (0 = not started)';
COMMENT ON COLUMN public.fec_sync_state.total_pages_estimated IS 'Total pages reported by FEC API pagination';
COMMENT ON COLUMN public.fec_sync_state.contributions_count IS 'Number of contributions fetched so far';
COMMENT ON COLUMN public.fec_sync_state.is_complete IS 'TRUE when all pages for this member+cycle have been fetched';
COMMENT ON COLUMN public.fec_sync_state.retry_count IS 'Number of retry attempts after errors';
```

##### 1.2 Create Manual FEC Mapping Table

**File**: `supabase/migrations/YYYYMMDDHHMMSS_fec_manual_mapping.sql`

```sql
-- Manual overrides for FEC candidate matching when automatic matching fails
CREATE TABLE IF NOT EXISTS public.fec_manual_mapping (
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  fec_candidate_id TEXT NOT NULL,
  verified_by TEXT, -- Admin user who verified this mapping
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (member_id)
);

CREATE INDEX IF NOT EXISTS idx_fec_manual_mapping_candidate
  ON public.fec_manual_mapping (fec_candidate_id);

COMMENT ON TABLE public.fec_manual_mapping IS 'Manual overrides for FEC candidate ID matching';
COMMENT ON COLUMN public.fec_manual_mapping.fec_candidate_id IS 'FEC candidate ID to use for this member';
COMMENT ON COLUMN public.fec_manual_mapping.verified_by IS 'Admin username who created this mapping';
```

##### 1.3 Update Funding Metrics to Track Per-Cycle Completeness

**File**: Update existing `funding_metrics` table if needed (check migration `20251210023109_funding_metrics.sql`)

Ensure it has these columns:
```sql
ALTER TABLE public.funding_metrics
ADD COLUMN IF NOT EXISTS contributions_fetched INTEGER,
ADD COLUMN IF NOT EXISTS contributions_total INTEGER,
ADD COLUMN IF NOT EXISTS last_sync_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.funding_metrics.contributions_fetched IS 'Number of itemized contributions actually fetched';
COMMENT ON COLUMN public.funding_metrics.contributions_total IS 'Total itemized contributions reported by FEC API';
COMMENT ON COLUMN public.funding_metrics.last_sync_completed_at IS 'When sync was last completed for this cycle';
```

---

#### Phase 2: Refactor Sync Logic

##### 2.1 Create Cycle-Specific Sync Functions

Instead of one monolithic function trying to do all cycles, create focused functions:

**Option A: Separate Edge Functions (Recommended)**

Create 4 separate edge function files:
- `supabase/functions/sync-fec-finance-2024/index.ts`
- `supabase/functions/sync-fec-finance-2022/index.ts`
- `supabase/functions/sync-fec-finance-2020/index.ts`
- `supabase/functions/sync-fec-finance-2018/index.ts`

**Option B: Single Function with Cycle Parameter (Simpler)**

Modify existing `sync-fec-finance/index.ts` to accept cycle parameter and process ONE cycle per invocation.

**Let's go with Option B for easier implementation:**

**File**: `supabase/functions/sync-fec-finance/index.ts`

**Key Changes to Implement:**

1. **Accept `cycle` parameter** (Line ~241):
```typescript
const requestUrl = new URL(req.url)
const memberIdFilter = requestUrl.searchParams.get('member_id')
const cycleFilter = requestUrl.searchParams.get('cycle') // NEW: Accept cycle parameter
const isSingleMemberRun = !!memberIdFilter

// Determine which cycles to process
let cyclesToProcess: number[]
if (cycleFilter) {
  // Process only specified cycle
  const requestedCycle = parseInt(cycleFilter, 10)
  if (isNaN(requestedCycle) || requestedCycle < 2010 || requestedCycle > CURRENT_CYCLE + 2) {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid cycle parameter' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  cyclesToProcess = [requestedCycle]
} else {
  // Default: Process most recent cycle only
  cyclesToProcess = [CURRENT_CYCLE]
}

console.log(`Processing cycles: ${cyclesToProcess.join(', ')}`)
```

2. **Implement Priority Queue Selection** (Replace lines 280-295):
```typescript
// Priority queue: Select members with LEAST complete data first
let membersQuery

if (isSingleMemberRun && memberIdFilter) {
  // Single member run - fetch specific member
  membersQuery = supabase
    .from('members')
    .select(
      'id, bioguide_id, first_name, last_name, full_name, state, party, chamber, fec_candidate_id, fec_committee_ids',
      { count: 'exact' }
    )
    .eq('id', memberIdFilter)
} else {
  // Priority queue: Get members with incomplete or missing data for this cycle
  const targetCycle = cyclesToProcess[0]

  // First, get members who need syncing (incomplete or never synced for this cycle)
  const { data: incompleteSyncStates, error: syncStateError } = await supabase
    .from('fec_sync_state')
    .select('member_id, contributions_count, last_synced_at')
    .eq('cycle', targetCycle)
    .eq('is_complete', false)
    .order('contributions_count', { ascending: true }) // Least data first
    .order('last_synced_at', { ascending: true, nullsFirst: true }) // Oldest first
    .limit(limit)

  if (syncStateError) {
    console.error('Error fetching sync state:', syncStateError)
  }

  let memberIds: string[] = []

  if (incompleteSyncStates && incompleteSyncStates.length > 0) {
    memberIds = incompleteSyncStates.map(s => s.member_id)
    console.log(`Found ${memberIds.length} members with incomplete data for cycle ${targetCycle}`)
  } else {
    // No incomplete syncs found - select members who have NEVER been synced for this cycle
    const { data: allMembers } = await supabase
      .from('members')
      .select('id')
      .eq('in_office', true)
      .order('last_name')
      .range(offset, offset + limit - 1)

    if (allMembers && allMembers.length > 0) {
      memberIds = allMembers.map(m => m.id)
      console.log(`No incomplete syncs - processing ${memberIds.length} members from offset ${offset}`)
    }
  }

  if (memberIds.length === 0) {
    console.log('No members to process')
    await releaseLock(supabase, 'complete', 0, 0, lockId)
    return new Response(
      JSON.stringify({
        success: true,
        message: 'All members processed for this cycle',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Fetch full member details
  const { data: members, count: totalMembers, error: membersError } = await supabase
    .from('members')
    .select(
      'id, bioguide_id, first_name, last_name, full_name, state, party, chamber, fec_candidate_id, fec_committee_ids',
      { count: 'exact' }
    )
    .in('id', memberIds)

  if (membersError) throw membersError

  // Assign to query result format
  membersQuery = { data: members, count: totalMembers }
}

const { data: members, count: totalMembers } = membersQuery
```

3. **Implement Resumable Pagination** (Replace lines 558-613):
```typescript
// Check sync state to see if we should resume from a specific page
const { data: syncState } = await supabase
  .from('fec_sync_state')
  .select('last_page_fetched, is_complete, contributions_count')
  .eq('member_id', member.id)
  .eq('cycle', cycle)
  .single()

// Skip if already complete
if (syncState?.is_complete) {
  console.log(`Cycle ${cycle} already complete for ${member.full_name} - skipping`)
  continue // Move to next cycle
}

// Resume from last page + 1
let startPage = syncState?.last_page_fetched ? syncState.last_page_fetched + 1 : 1
let contributionsResults: any[] = []
let totalContributionsAvailable: number | null = syncState?.contributions_count || null

console.log(`Resuming cycle ${cycle} for ${member.full_name} from page ${startPage}`)

// Fetch itemized contributions with resumable pagination
let hasMore = true
const MAX_PAGES = isSingleMemberRun ? 500 : 100
let pageCount = 0
let page = startPage // START FROM RESUME POINT
let totalPages: number | null = null

while (hasMore && page <= (startPage + MAX_PAGES - 1) && !rateLimited) {
  // Check if approaching time limit
  if (Date.now() - startTime > (MAX_DURATION_SECONDS - 60) * 1000) {
    console.log('Approaching time limit - saving progress and stopping')

    // Save current progress to sync_state
    await supabase
      .from('fec_sync_state')
      .upsert({
        member_id: member.id,
        cycle: cycle,
        last_page_fetched: page - 1, // Last successful page
        total_pages_estimated: totalPages,
        contributions_count: contributionsResults.length + (syncState?.contributions_count || 0),
        is_complete: false,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'member_id,cycle'
      })

    break // Exit pagination loop
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

    // Save progress before stopping
    await supabase
      .from('fec_sync_state')
      .upsert({
        member_id: member.id,
        cycle: cycle,
        last_page_fetched: page - 1,
        total_pages_estimated: totalPages,
        contributions_count: contributionsResults.length + (syncState?.contributions_count || 0),
        is_complete: false,
        last_synced_at: new Date().toISOString(),
        last_error: 'Rate limited',
        retry_count: (syncState?.retry_count || 0) + 1,
      }, {
        onConflict: 'member_id,cycle'
      })

    rateLimited = true
    break
  }

  if (!contributionsResponse?.ok) {
    console.error(`Failed to fetch page ${page}:`, contributionsResponse?.status)
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

    // Save progress every 10 pages
    if (pageCount % 10 === 0) {
      await supabase
        .from('fec_sync_state')
        .upsert({
          member_id: member.id,
          cycle: cycle,
          last_page_fetched: page - 1,
          total_pages_estimated: totalPages,
          contributions_count: contributionsResults.length + (syncState?.contributions_count || 0),
          is_complete: false,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'member_id,cycle'
        })

      console.log(`Progress checkpoint: page ${page-1}/${totalPages || '?'} for ${member.full_name} cycle ${cycle}`)
    }
  } else {
    hasMore = false
  }
}

// After pagination loop, mark as complete if we reached the end
const isComplete = !hasMore && !rateLimited
await supabase
  .from('fec_sync_state')
  .upsert({
    member_id: member.id,
    cycle: cycle,
    last_page_fetched: page - 1,
    total_pages_estimated: totalPages,
    contributions_count: contributionsResults.length + (syncState?.contributions_count || 0),
    is_complete: isComplete,
    last_synced_at: new Date().toISOString(),
    last_error: rateLimited ? 'Rate limited' : null,
  }, {
    onConflict: 'member_id,cycle'
  })

console.log(
  `${isComplete ? 'Completed' : 'Partial'} sync: ${contributionsResults.length} new contributions for ${member.full_name} cycle ${cycle} (pages ${startPage}-${page-1})`
)
```

4. **Update FEC Candidate Matching to Use Manual Overrides** (Lines 346-458):
```typescript
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
  // Search for candidate (existing logic remains)
  // ... existing search code from lines 356-452 ...
}
```

5. **Reduce Batch Size for Deeper Pagination** (Line 15):
```typescript
const BATCH_SIZE = 1 // Process ONE member per run to maximize pagination depth
```

**Why?** Give each member the full 280 seconds to fetch as many pages as possible (up to 500 pages = 50,000 contributions).

---

#### Phase 3: Job Scheduling Updates

##### 3.1 Update Sync Jobs Configuration

**File**: Update the migration that defines sync jobs (look for `sync_jobs` inserts)

```sql
-- Remove old single fec-finance job
DELETE FROM sync_jobs WHERE id = 'fec-finance';

-- Add cycle-specific jobs with different frequencies
INSERT INTO sync_jobs (id, job_type, frequency_minutes, priority, enabled) VALUES
  ('fec-finance-2024', 'sync', 60, 1, true),    -- Every hour for current cycle
  ('fec-finance-2022', 'sync', 120, 2, true),   -- Every 2 hours for recent past
  ('fec-finance-2020', 'sync', 240, 3, true),   -- Every 4 hours for older data
  ('fec-finance-2018', 'sync', 480, 4, true),   -- Every 8 hours for historical
  ('fec-finance-2016', 'sync', 720, 5, true)    -- Every 12 hours for old data
ON CONFLICT (id) DO UPDATE SET
  job_type = EXCLUDED.job_type,
  frequency_minutes = EXCLUDED.frequency_minutes,
  priority = EXCLUDED.priority,
  enabled = EXCLUDED.enabled;
```

##### 3.2 Update Sync Worker to Call Cycle-Specific Jobs

**File**: `supabase/functions/sync-worker/index.ts`

Find where `fec-finance` job is triggered and update to call with cycle parameter:

```typescript
// Replace single fec-finance call with cycle-specific calls
const fecJobs = [
  { jobId: 'fec-finance-2024', cycle: 2024 },
  { jobId: 'fec-finance-2022', cycle: 2022 },
  { jobId: 'fec-finance-2020', cycle: 2020 },
  { jobId: 'fec-finance-2018', cycle: 2018 },
  { jobId: 'fec-finance-2016', cycle: 2016 },
]

for (const { jobId, cycle } of fecJobs) {
  const job = jobs.find(j => j.id === jobId)
  if (job && job.enabled && shouldRunJob(job)) {
    console.log(`Triggering ${jobId} (cycle ${cycle})`)

    // Call sync-fec-finance with cycle parameter
    const fecUrl = `${supabaseUrl}/functions/v1/sync-fec-finance?cycle=${cycle}`
    await fetch(fecUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })
  }
}
```

---

#### Phase 4: Monitoring & Admin Dashboard

##### 4.1 Create Data Completeness View

**File**: `supabase/migrations/YYYYMMDDHHMMSS_fec_completeness_view.sql`

```sql
-- View to monitor FEC sync completeness
CREATE OR REPLACE VIEW public.fec_sync_completeness AS
SELECT
  m.id AS member_id,
  m.full_name,
  m.state,
  m.party,
  m.chamber,
  m.in_office,
  m.fec_candidate_id,
  m.fec_last_synced_at,
  -- Per-cycle completeness
  COALESCE(s2024.is_complete, false) AS cycle_2024_complete,
  COALESCE(s2024.contributions_count, 0) AS cycle_2024_count,
  COALESCE(s2022.is_complete, false) AS cycle_2022_complete,
  COALESCE(s2022.contributions_count, 0) AS cycle_2022_count,
  COALESCE(s2020.is_complete, false) AS cycle_2020_complete,
  COALESCE(s2020.contributions_count, 0) AS cycle_2020_count,
  COALESCE(s2018.is_complete, false) AS cycle_2018_complete,
  COALESCE(s2018.contributions_count, 0) AS cycle_2018_count,
  -- Total contributions across all cycles
  COALESCE(s2024.contributions_count, 0) +
  COALESCE(s2022.contributions_count, 0) +
  COALESCE(s2020.contributions_count, 0) +
  COALESCE(s2018.contributions_count, 0) AS total_contributions,
  -- Completeness score (% of cycles complete)
  (
    CASE WHEN COALESCE(s2024.is_complete, false) THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(s2022.is_complete, false) THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(s2020.is_complete, false) THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(s2018.is_complete, false) THEN 1 ELSE 0 END
  ) * 25 AS completeness_percent,
  -- Has FEC match?
  CASE
    WHEN m.fec_candidate_id IS NOT NULL THEN true
    WHEN EXISTS (SELECT 1 FROM fec_manual_mapping WHERE member_id = m.id) THEN true
    ELSE false
  END AS has_fec_match
FROM members m
LEFT JOIN fec_sync_state s2024 ON m.id = s2024.member_id AND s2024.cycle = 2024
LEFT JOIN fec_sync_state s2022 ON m.id = s2022.member_id AND s2022.cycle = 2022
LEFT JOIN fec_sync_state s2020 ON m.id = s2020.member_id AND s2020.cycle = 2020
LEFT JOIN fec_sync_state s2018 ON m.id = s2018.member_id AND s2018.cycle = 2018
WHERE m.in_office = true
ORDER BY completeness_percent ASC, total_contributions ASC;

COMMENT ON VIEW public.fec_sync_completeness IS 'Monitoring view for FEC sync data completeness per member';
```

##### 4.2 Add Admin Dashboard Component (Frontend)

**File**: `src/pages/AdminDataCompleteness.tsx` (New File)

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface MemberCompleteness {
  member_id: string;
  full_name: string;
  state: string;
  party: string;
  chamber: string;
  cycle_2024_complete: boolean;
  cycle_2024_count: number;
  cycle_2022_complete: boolean;
  cycle_2022_count: number;
  cycle_2020_complete: boolean;
  cycle_2020_count: number;
  cycle_2018_complete: boolean;
  cycle_2018_count: number;
  total_contributions: number;
  completeness_percent: number;
  has_fec_match: boolean;
}

export default function AdminDataCompleteness() {
  const { data: completeness, isLoading, refetch } = useQuery({
    queryKey: ['fec-completeness'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fec_sync_completeness')
        .select('*')
        .order('completeness_percent', { ascending: true })
        .limit(100);

      if (error) throw error;
      return data as MemberCompleteness[];
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['fec-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fec_sync_completeness')
        .select('completeness_percent, has_fec_match, total_contributions');

      if (!data) return null;

      const total = data.length;
      const fullyComplete = data.filter(m => m.completeness_percent === 100).length;
      const noMatch = data.filter(m => !m.has_fec_match).length;
      const avgContributions = Math.round(
        data.reduce((sum, m) => sum + m.total_contributions, 0) / total
      );
      const avgCompleteness = Math.round(
        data.reduce((sum, m) => sum + m.completeness_percent, 0) / total
      );

      return { total, fullyComplete, noMatch, avgContributions, avgCompleteness };
    }
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">FEC Data Completeness</h1>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Fully Complete</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.fullyComplete}
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round((stats.fullyComplete / stats.total) * 100)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">No FEC Match</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.noMatch}</div>
              <div className="text-xs text-muted-foreground">
                {Math.round((stats.noMatch / stats.total) * 100)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Avg Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgContributions.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Avg Completeness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgCompleteness}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members by Completeness (Least Complete First)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {completeness?.map((member) => (
              <div key={member.member_id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{member.full_name}</h3>
                    <Badge variant="outline">
                      {member.state} - {member.chamber === 'house' ? 'House' : 'Senate'}
                    </Badge>
                    {!member.has_fec_match && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        No FEC Match
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {member.total_contributions.toLocaleString()} total contributions
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Overall Completeness</span>
                    <span className="font-semibold">{member.completeness_percent}%</span>
                  </div>
                  <Progress value={member.completeness_percent} className="h-2" />
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    {member.cycle_2024_complete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>2024: {member.cycle_2024_count.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {member.cycle_2022_complete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>2022: {member.cycle_2022_count.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {member.cycle_2020_complete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>2020: {member.cycle_2020_count.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {member.cycle_2018_complete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>2018: {member.cycle_2018_count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

##### 4.3 Add Route for Admin Dashboard

**File**: `src/App.tsx` or wherever routes are defined

```typescript
import AdminDataCompleteness from "@/pages/AdminDataCompleteness";

// Add route:
<Route path="/admin/fec-completeness" element={<AdminDataCompleteness />} />
```

---

## Implementation Steps

### Step 1: Database Migrations (10 minutes)
1. Create `fec_sync_state` table migration
2. Create `fec_manual_mapping` table migration
3. Verify `funding_metrics` has required columns
4. Create `fec_sync_completeness` view
5. Run migrations: `supabase db push` or deploy via Lovable

### Step 2: Update Edge Function (30 minutes)
1. Backup current `sync-fec-finance/index.ts`
2. Implement cycle parameter acceptance (lines 241-260)
3. Implement priority queue selection (lines 280-350)
4. Implement resumable pagination (lines 558-700)
5. Update FEC matching to use manual overrides (lines 346-360)
6. Change BATCH_SIZE to 1 (line 15)
7. Test locally if possible: `supabase functions serve sync-fec-finance`

### Step 3: Update Job Scheduling (15 minutes)
1. Update sync_jobs table with cycle-specific jobs
2. Update sync-worker to trigger cycle-specific jobs
3. Deploy sync-worker changes

### Step 4: Create Admin Dashboard (20 minutes)
1. Create `AdminDataCompleteness.tsx` component
2. Add route to App.tsx
3. Test dashboard locally
4. Deploy frontend changes

### Step 5: Initial Sync & Monitoring (Ongoing)
1. Manually trigger sync for 2024 cycle:
   ```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/sync-fec-finance?cycle=2024" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```
2. Monitor progress in admin dashboard
3. Manually add FEC mappings for members with no match
4. Once 2024 is 90%+ complete, trigger 2022 cycle
5. Continue until all cycles complete

---

## Expected Results

### Before
- ~100-300 donors per member
- Only 2024 data
- ~15-20% members with no data
- Random batch processing

### After
- 10,000-50,000 donors per member (full history)
- All cycles 2016-2024 populated
- <5% members with no data (only those truly not in FEC)
- Systematic gap-filling
- Resumable syncs (no duplicate work)
- Real-time completeness monitoring

### Timeline Estimate
- **Week 1**: 2024 cycle 90% complete (focus on high-priority members)
- **Week 2**: 2024 cycle 100%, 2022 cycle 80% complete
- **Week 3**: All recent cycles (2020-2024) 100% complete
- **Week 4**: Historical cycles (2016-2018) complete

---

## Testing Strategy

### Unit Testing
1. Test cycle parameter parsing
2. Test priority queue selection logic
3. Test resumable pagination state save/restore
4. Test manual mapping override

### Integration Testing
1. Test single member sync: `?member_id=xxx&cycle=2024`
2. Test batch sync: `?cycle=2024`
3. Test resume after timeout
4. Test resume after rate limit
5. Verify no duplicate contributions inserted

### Performance Testing
1. Monitor API call count per member
2. Verify reaching 500 pages for high-volume members
3. Monitor edge function duration (should use most of 280 seconds)
4. Verify watermark updates correctly

---

## Rollback Plan

If issues occur:

1. **Immediate**: Pause sync jobs
   ```sql
   UPDATE feature_toggles SET enabled = true WHERE id = 'sync_paused';
   ```

2. **Revert Edge Function**: Deploy previous version from git:
   ```bash
   git checkout HEAD~1 supabase/functions/sync-fec-finance/index.ts
   supabase functions deploy sync-fec-finance
   ```

3. **Clean State** (if needed):
   ```sql
   TRUNCATE fec_sync_state;
   -- Contributions are safe - upsert logic prevents duplicates
   ```

4. **Resume**: Fix issues, re-enable sync jobs

---

## FAQ

**Q: Won't processing 1 member at a time be slower?**
A: No! Current system processes 10 members × 1 page each = 1000 records. New system processes 1 member × 500 pages = 50,000 records. 50x more data per run.

**Q: How long until all data is populated?**
A: ~4 weeks for 100% completeness across all cycles. 2024 data 90% complete in ~1 week.

**Q: What about API rate limits?**
A: Current approach hits rate limits because of inefficient pagination. New approach makes better use of rate limits with resumable state.

**Q: Will this break existing data?**
A: No. Upsert logic with `contribution_uid` prevents duplicates. Existing data remains intact.

**Q: Can I prioritize specific members?**
A: Yes! Set their `is_complete = false` in `fec_sync_state` or trigger single member sync: `?member_id=xxx&cycle=2024`

---

## Manual Operations

### Manually Trigger Sync for Specific Member
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/sync-fec-finance?member_id=MEMBER_UUID&cycle=2024" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Add Manual FEC Mapping
```sql
INSERT INTO fec_manual_mapping (member_id, fec_candidate_id, verified_by, notes)
VALUES (
  'member-uuid-here',
  'H0TX01234', -- FEC candidate ID
  'admin_username',
  'Name mismatch - verified manually'
);
```

### Reset Sync State for Member+Cycle
```sql
-- Reset to re-sync from beginning
UPDATE fec_sync_state
SET last_page_fetched = 0,
    is_complete = false,
    contributions_count = 0,
    last_error = null
WHERE member_id = 'member-uuid' AND cycle = 2024;
```

### Find Members with No FEC Match
```sql
SELECT m.id, m.full_name, m.state, m.party, m.chamber
FROM members m
WHERE m.in_office = true
  AND m.fec_candidate_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM fec_manual_mapping WHERE member_id = m.id
  )
ORDER BY m.last_name;
```

### Check Sync Progress
```sql
SELECT
  cycle,
  COUNT(*) AS total_members,
  SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) AS complete_count,
  ROUND(AVG(contributions_count)) AS avg_contributions,
  MAX(last_synced_at) AS last_sync
FROM fec_sync_state
GROUP BY cycle
ORDER BY cycle DESC;
```

---

## Code Reference Summary

| Issue | Current Location | Solution |
|-------|-----------------|----------|
| Time constraint | Line 14, 330-332 | Reduce BATCH_SIZE to 1, allocate full 280s per member |
| Sequential cycles | Lines 534-842 | Add cycle parameter, process one cycle per invocation |
| No resumable pagination | Lines 558-613 | Add fec_sync_state table, save progress every 10 pages |
| Random batch processing | Lines 281-295 | Implement priority queue selecting least complete first |
| FEC matching failures | Lines 346-458 | Add fec_manual_mapping table for overrides |
| No monitoring | N/A | Create fec_sync_completeness view + admin dashboard |

---

## Support & Troubleshooting

### Common Issues

**Issue**: Function timing out too quickly
**Solution**: Increase MAX_DURATION_SECONDS or reduce MAX_PAGES

**Issue**: Rate limited frequently
**Solution**: Increase HTTP_CONFIG.baseDelayMs from 1000 to 2000

**Issue**: Duplicates appearing
**Solution**: Check contribution_uid generation logic, verify unique constraint

**Issue**: Member stuck in incomplete state
**Solution**: Check last_error field, manually reset sync state if needed

### Monitoring Queries

```sql
-- Members with errors
SELECT m.full_name, s.cycle, s.last_error, s.retry_count, s.last_synced_at
FROM fec_sync_state s
JOIN members m ON s.member_id = m.id
WHERE s.last_error IS NOT NULL
ORDER BY s.last_synced_at DESC;

-- Slowest members to sync
SELECT m.full_name, s.cycle, s.contributions_count, s.last_page_fetched, s.total_pages_estimated
FROM fec_sync_state s
JOIN members m ON s.member_id = m.id
WHERE s.is_complete = false
  AND s.last_synced_at > NOW() - INTERVAL '7 days'
ORDER BY s.last_page_fetched DESC
LIMIT 20;
```

---

## Conclusion

This implementation provides:
- ✅ Complete donor data (10K-50K per member vs current ~100)
- ✅ Historical coverage (all cycles 2016-2024)
- ✅ Resumable syncs (no wasted work)
- ✅ Priority-based processing (fills gaps first)
- ✅ Real-time monitoring (admin dashboard)
- ✅ Manual override capability (for edge cases)

The key insight: **Process less, but process deeper**. One member with 50,000 contributions is better than 10 members with 100 each.

**Next Step**: Implement Phase 1 (database migrations) first, then Phase 2 (edge function refactor), test thoroughly, then deploy to production.

---

*Document Version: 1.0*
*Generated: January 13, 2026*
*For: CivicScore FEC Integration Improvement*
