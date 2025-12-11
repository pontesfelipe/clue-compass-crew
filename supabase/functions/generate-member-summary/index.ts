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
    const { memberId } = await req.json()
    
    if (!memberId) {
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`Generating summary for member: ${memberId}`)

    // Check if summary was generated within the last month
    const { data: existingSummary } = await supabase
      .from('member_summaries')
      .select('generated_at')
      .eq('member_id', memberId)
      .single()

    if (existingSummary) {
      const generatedAt = new Date(existingSummary.generated_at)
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      
      if (generatedAt > oneMonthAgo) {
        return new Response(
          JSON.stringify({ error: 'Summary already generated this month', nextAvailable: generatedAt.toISOString() }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch member details
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch member's scores
    const { data: scores } = await supabase
      .from('member_scores')
      .select('*')
      .eq('member_id', memberId)
      .is('user_id', null)
      .single()

    // Fetch sponsored bills
    const { data: sponsoredBills } = await supabase
      .from('bill_sponsorships')
      .select(`
        is_sponsor,
        bills (
          title,
          short_title,
          bill_type,
          bill_number,
          policy_area,
          enacted,
          latest_action_text
        )
      `)
      .eq('member_id', memberId)
      .eq('is_sponsor', true)
      .limit(20)

    // Fetch recent votes with bill info
    const { data: recentVotes } = await supabase
      .from('member_votes')
      .select(`
        position,
        votes (
          question,
          description,
          result,
          vote_date
        )
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(30)

    // Build context for AI
    const partyName = member.party === 'D' ? 'Democrat' : member.party === 'R' ? 'Republican' : 'Independent'
    const chamber = member.chamber === 'senate' ? 'Senator' : 'Representative'
    
    const billsSummary = sponsoredBills?.map((b: any) => {
      const bill = b.bills
      if (!bill) return null
      return `- ${bill.short_title || bill.title} (${bill.policy_area || 'General'})${bill.enacted ? ' [ENACTED]' : ''}`
    }).filter(Boolean).join('\n') || 'No sponsored bills found'

    const votesSummary = recentVotes?.map((v: any) => {
      const vote = v.votes
      if (!vote) return null
      return `- ${v.position.toUpperCase()} on: ${vote.question || vote.description} (${vote.result})`
    }).filter(Boolean).join('\n') || 'No recent votes found'

    const prompt = `You are a non-partisan political analyst. Summarize this Congress member's activity in simple, accessible terms that a regular citizen can understand. Be objective and factual.

MEMBER PROFILE:
- Name: ${member.full_name}
- Role: ${chamber} (${partyName}) from ${member.state}${member.district ? `, District ${member.district}` : ''}
- In office since: ${member.start_date || 'Unknown'}

PERFORMANCE METRICS:
- Bills Sponsored: ${scores?.bills_sponsored || 0}
- Bills Co-sponsored: ${scores?.bills_cosponsored || 0}
- Bills Enacted: ${scores?.bills_enacted || 0}
- Attendance Rate: ${scores?.attendance_score || 0}%
- Bipartisanship Score: ${scores?.bipartisanship_score || 0}%

RECENT SPONSORED LEGISLATION:
${billsSummary}

RECENT VOTING RECORD:
${votesSummary}

Please provide a 2-3 paragraph summary that:
1. Explains their main legislative priorities and focus areas in plain language
2. Describes their voting patterns and what positions they tend to take
3. Highlights any notable achievements or areas where they've been particularly active

Keep the language simple and avoid political jargon. Focus on facts, not opinions.`

    console.log('Calling Lovable AI...')

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful, non-partisan political analyst who explains congressional activity in simple terms for everyday citizens.' },
          { role: 'user', content: prompt }
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('AI API error:', aiResponse.status, errorText)
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const summary = aiData.choices?.[0]?.message?.content
    const tokensUsed = aiData.usage?.total_tokens

    if (!summary) {
      throw new Error('No summary generated')
    }

    console.log('Summary generated, saving to database...')

    // Log AI usage
    await supabase.from('ai_usage_log').insert({
      operation_type: 'member_summary',
      tokens_used: tokensUsed,
      model: 'google/gemini-2.5-flash',
      success: true,
      metadata: { member_id: memberId, member_name: member.full_name }
    })

    // Save or update the summary
    const { error: upsertError } = await supabase
      .from('member_summaries')
      .upsert({
        member_id: memberId,
        summary: summary,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' })

    if (upsertError) {
      console.error('Error saving summary:', upsertError)
      throw upsertError
    }

    console.log('Summary saved successfully')

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Generate summary error:', errorMessage)
    
    // Log failed AI usage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    await supabase.from('ai_usage_log').insert({
      operation_type: 'member_summary',
      model: 'google/gemini-2.5-flash',
      success: false,
      error_message: errorMessage
    })
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
