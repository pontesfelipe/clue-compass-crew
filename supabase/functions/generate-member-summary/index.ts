import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIProvider {
  name: string
  url: string
  apiKey: string
  model: string
}

async function callAI(provider: AIProvider, systemPrompt: string, userPrompt: string): Promise<{ content: string; tokens?: number }> {
  console.log(`Calling ${provider.name}...`)
  
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`${provider.name} API error:`, response.status, errorText)
    throw { status: response.status, message: errorText, provider: provider.name }
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content,
    tokens: data.usage?.total_tokens
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { memberId, force } = await req.json()
    
    if (!memberId) {
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('No AI API key configured (need OPENAI_API_KEY or LOVABLE_API_KEY)')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`Generating summary for member: ${memberId}`)

    // Check if summary was generated within the last 24 hours (unless force=true)
    if (!force) {
      const { data: existingSummary } = await supabase
        .from('member_summaries')
        .select('generated_at, summary')
        .eq('member_id', memberId)
        .single()

      if (existingSummary) {
        const generatedAt = new Date(existingSummary.generated_at)
        const oneDayAgo = new Date()
        oneDayAgo.setHours(oneDayAgo.getHours() - 24)
        
        if (generatedAt > oneDayAgo) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              summary: existingSummary.summary,
              cached: true,
              message: 'Using cached summary (generated within 24 hours)'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
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

    const systemPrompt = 'You are a helpful, non-partisan political analyst who explains congressional activity in simple terms for everyday citizens.'
    
    const userPrompt = `You are a non-partisan political analyst. Summarize this Congress member's activity in simple, accessible terms that a regular citizen can understand. Be objective and factual.

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

    // Define providers with fallback order
    const providers: AIProvider[] = []
    
    // Try OpenAI first if available
    if (OPENAI_API_KEY) {
      providers.push({
        name: 'OpenAI',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: OPENAI_API_KEY,
        model: 'gpt-4o-mini'
      })
    }
    
    // Lovable AI as fallback (or primary if OpenAI not configured)
    if (LOVABLE_API_KEY) {
      providers.push({
        name: 'Lovable AI',
        url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        apiKey: LOVABLE_API_KEY,
        model: 'google/gemini-2.5-flash'
      })
    }

    let summary: string | null = null
    let tokensUsed: number | undefined
    let usedProvider: string = ''

    // Try each provider in order, falling back on quota/rate limit errors
    for (const provider of providers) {
      try {
        const result = await callAI(provider, systemPrompt, userPrompt)
        summary = result.content
        tokensUsed = result.tokens
        usedProvider = provider.name
        console.log(`Successfully generated summary using ${provider.name}`)
        break
      } catch (error: any) {
        const isQuotaError = error.status === 429 || 
                            error.status === 402 || 
                            error.message?.includes('insufficient_quota') ||
                            error.message?.includes('exceeded')
        
        if (isQuotaError && providers.indexOf(provider) < providers.length - 1) {
          console.log(`${provider.name} quota/rate limit exceeded, falling back to next provider...`)
          continue
        }
        
        // If it's the last provider or a non-quota error, throw
        if (error.status === 429) {
          return new Response(
            JSON.stringify({ error: 'All AI providers rate limited. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (error.status === 402) {
          return new Response(
            JSON.stringify({ error: 'All AI providers out of credits. Please check billing.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        throw error
      }
    }

    if (!summary) {
      throw new Error('No summary generated from any provider')
    }

    console.log('Summary generated, saving to database...')

    // Log AI usage
    await supabase.from('ai_usage_log').insert({
      operation_type: 'member_summary',
      tokens_used: tokensUsed,
      model: usedProvider === 'OpenAI' ? 'gpt-4o-mini' : 'google/gemini-2.5-flash',
      success: true,
      metadata: { member_id: memberId, member_name: member.full_name, provider: usedProvider }
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

    console.log(`Summary saved successfully (provider: ${usedProvider})`)

    return new Response(
      JSON.stringify({ success: true, summary, provider: usedProvider }),
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
      model: 'unknown',
      success: false,
      error_message: errorMessage
    })
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
