import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting member data completeness validation...')

    // Get all active members
    const { data: members, error: membersError } = await supabaseClient
      .from('members')
      .select('*')
      .eq('in_office', true)

    if (membersError) throw membersError

    console.log(`Validating ${members?.length || 0} members...`)

    const completenessRecords = []

    for (const member of members || []) {
      const validation = await validateMemberData(supabaseClient, member)
      completenessRecords.push(validation)
    }

    // Upsert completeness records
    const { error: upsertError } = await supabaseClient
      .from('member_data_completeness')
      .upsert(completenessRecords, { onConflict: 'member_id' })

    if (upsertError) {
      console.error('Error upserting completeness records:', upsertError)
      throw upsertError
    }

    // Calculate and store data quality metrics
    await updateDataQualityMetrics(supabaseClient, completenessRecords)

    console.log(`Validated ${completenessRecords.length} members`)

    // Summary stats
    const avgCompleteness = completenessRecords.reduce((sum, r) => sum + Number(r.completeness_percentage), 0) / completenessRecords.length
    const withFinance = completenessRecords.filter(r => r.finance_data_complete).length
    const withValidScores = completenessRecords.filter(r => r.score_data_valid).length

    return new Response(
      JSON.stringify({
        success: true,
        validated: completenessRecords.length,
        avgCompleteness: Math.round(avgCompleteness * 10) / 10,
        withFinanceData: withFinance,
        withValidScores: withValidScores,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error validating member data:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function validateMemberData(supabaseClient: any, member: any) {
  const missingFields: string[] = []

  // Validate basic info
  const basicInfoComplete = validateBasicInfo(member, missingFields)

  // Validate contact info
  const contactInfoComplete = validateContactInfo(member, missingFields)

  // Validate finance data
  const financeDataComplete = await validateFinanceData(supabaseClient, member.id, missingFields)

  // Validate committee data
  const committeeDataComplete = await validateCommitteeData(supabaseClient, member.id, missingFields)

  // Validate vote data
  const voteDataComplete = await validateVoteData(supabaseClient, member.id, missingFields)

  // Validate bills data
  const billsDataComplete = await validateBillsData(supabaseClient, member.id, missingFields)

  // Validate score data
  const scoreDataValid = await validateScoreData(supabaseClient, member.id, missingFields)

  // Calculate overall completeness percentage (weighted)
  const weights = {
    basicInfo: 20,
    contactInfo: 10,
    financeData: 25,
    committeeData: 10,
    voteData: 15,
    billsData: 10,
    scoreData: 10
  }

  let completeness = 0
  if (basicInfoComplete) completeness += weights.basicInfo
  if (contactInfoComplete) completeness += weights.contactInfo
  if (financeDataComplete) completeness += weights.financeData
  if (committeeDataComplete) completeness += weights.committeeData
  if (voteDataComplete) completeness += weights.voteData
  if (billsDataComplete) completeness += weights.billsData
  if (scoreDataValid) completeness += weights.scoreData

  return {
    member_id: member.id,
    basic_info_complete: basicInfoComplete,
    contact_info_complete: contactInfoComplete,
    finance_data_complete: financeDataComplete,
    committee_data_complete: committeeDataComplete,
    vote_data_complete: voteDataComplete,
    bills_data_complete: billsDataComplete,
    score_data_valid: scoreDataValid,
    completeness_percentage: completeness,
    missing_fields: missingFields,
    last_validated_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

function validateBasicInfo(member: any, missingFields: string[]): boolean {
  const requiredFields = [
    'bioguide_id', 'first_name', 'last_name', 'full_name',
    'party', 'state', 'chamber', 'in_office'
  ]

  let complete = true
  for (const field of requiredFields) {
    if (!member[field]) {
      missingFields.push(`basic.${field}`)
      complete = false
    }
  }

  return complete
}

function validateContactInfo(member: any, missingFields: string[]): boolean {
  // At minimum, should have DC office contact
  let hasContact = false

  if (member.phone) hasContact = true
  if (member.office_address) hasContact = true
  if (member.website_url) hasContact = true

  if (!hasContact) {
    missingFields.push('contact.any_contact_info')
  }

  // Check for optional but valuable fields
  if (!member.phone) missingFields.push('contact.phone')
  if (!member.office_address) missingFields.push('contact.office_address')
  if (!member.website_url) missingFields.push('contact.website')
  if (!member.twitter_handle) missingFields.push('contact.twitter')

  return hasContact
}

async function validateFinanceData(supabaseClient: any, memberId: string, missingFields: string[]): Promise<boolean> {
  // Check if member has funding metrics
  const { data: fundingMetrics, error } = await supabaseClient
    .from('funding_metrics')
    .select('id')
    .eq('member_id', memberId)
    .limit(1)

  if (error || !fundingMetrics || fundingMetrics.length === 0) {
    missingFields.push('finance.funding_metrics')
  }

  // Check if member has contribution data
  const { data: contributions, error: contribError } = await supabaseClient
    .from('member_contributions')
    .select('id')
    .eq('member_id', memberId)
    .limit(1)

  if (contribError || !contributions || contributions.length === 0) {
    missingFields.push('finance.contributions')
    return false
  }

  return true
}

async function validateCommitteeData(supabaseClient: any, memberId: string, missingFields: string[]): Promise<boolean> {
  const { data: committees, error } = await supabaseClient
    .from('member_committees')
    .select('id')
    .eq('member_id', memberId)

  if (error || !committees || committees.length === 0) {
    missingFields.push('committees.assignments')
    return false
  }

  return true
}

async function validateVoteData(supabaseClient: any, memberId: string, missingFields: string[]): Promise<boolean> {
  // Member should have votes in last 90 days if in office
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: memberVotes, error } = await supabaseClient
    .from('member_votes')
    .select('id, votes!inner(vote_date)')
    .eq('member_id', memberId)
    .limit(1)

  if (error || !memberVotes || memberVotes.length === 0) {
    missingFields.push('votes.recent_votes')
    return false
  }

  return true
}

async function validateBillsData(supabaseClient: any, memberId: string, missingFields: string[]): Promise<boolean> {
  const { data: bills, error } = await supabaseClient
    .from('bill_sponsorships')
    .select('id')
    .eq('member_id', memberId)
    .limit(1)

  if (error || !bills || bills.length === 0) {
    missingFields.push('bills.sponsorships')
    return false
  }

  return true
}

async function validateScoreData(supabaseClient: any, memberId: string, missingFields: string[]): Promise<boolean> {
  const { data: scores, error } = await supabaseClient
    .from('member_scores')
    .select('is_provisional, data_points_used')
    .eq('member_id', memberId)
    .is('user_id', null)
    .single()

  if (error || !scores) {
    missingFields.push('scores.missing')
    return false
  }

  if (scores.is_provisional) {
    missingFields.push('scores.provisional')
    return false
  }

  if ((scores.data_points_used || 0) < 10) {
    missingFields.push('scores.insufficient_data')
    return false
  }

  return true
}

async function updateDataQualityMetrics(supabaseClient: any, completenessRecords: any[]) {
  const now = new Date().toISOString()

  // Calculate various metrics
  const totalMembers = completenessRecords.length
  if (totalMembers === 0) return

  const membersWithoutFinance = completenessRecords.filter(r => !r.finance_data_complete).length
  const membersWithoutScores = completenessRecords.filter(r => !r.score_data_valid).length
  const membersWithoutVotes = completenessRecords.filter(r => !r.vote_data_complete).length
  const membersWithoutCommittees = completenessRecords.filter(r => !r.committee_data_complete).length

  const avgCompleteness = completenessRecords.reduce((sum, r) => sum + Number(r.completeness_percentage), 0) / totalMembers

  const metrics = [
    {
      metric_name: 'members_without_finance_data',
      metric_description: 'Number of active members missing FEC finance data',
      current_value: membersWithoutFinance,
      threshold_warning: 10,
      threshold_critical: 50,
      status: membersWithoutFinance > 50 ? 'critical' : (membersWithoutFinance > 10 ? 'warning' : 'healthy'),
      category: 'completeness',
      checked_at: now
    },
    {
      metric_name: 'members_without_valid_scores',
      metric_description: 'Number of members with provisional or missing scores',
      current_value: membersWithoutScores,
      threshold_warning: 5,
      threshold_critical: 20,
      status: membersWithoutScores > 20 ? 'critical' : (membersWithoutScores > 5 ? 'warning' : 'healthy'),
      category: 'completeness',
      checked_at: now
    },
    {
      metric_name: 'members_without_recent_votes',
      metric_description: 'Number of members missing vote data in last 90 days',
      current_value: membersWithoutVotes,
      threshold_warning: 10,
      threshold_critical: 30,
      status: membersWithoutVotes > 30 ? 'critical' : (membersWithoutVotes > 10 ? 'warning' : 'healthy'),
      category: 'freshness',
      checked_at: now
    },
    {
      metric_name: 'members_without_committee_data',
      metric_description: 'Number of members missing committee assignments',
      current_value: membersWithoutCommittees,
      threshold_warning: 20,
      threshold_critical: 50,
      status: membersWithoutCommittees > 50 ? 'critical' : (membersWithoutCommittees > 20 ? 'warning' : 'healthy'),
      category: 'completeness',
      checked_at: now
    },
    {
      metric_name: 'average_data_completeness',
      metric_description: 'Average data completeness percentage across all members',
      current_value: avgCompleteness,
      threshold_warning: 70,
      threshold_critical: 50,
      status: avgCompleteness < 50 ? 'critical' : (avgCompleteness < 70 ? 'warning' : 'healthy'),
      category: 'completeness',
      checked_at: now
    }
  ]

  // Insert metrics
  const { error } = await supabaseClient
    .from('data_quality_metrics')
    .insert(metrics)

  if (error) {
    console.error('Error inserting quality metrics:', error)
  } else {
    console.log(`Inserted ${metrics.length} quality metrics`)
  }
}
