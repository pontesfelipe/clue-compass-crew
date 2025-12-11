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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { bill_id, batch_size = 10, force = false } = await req.json()

    let billsQuery = supabase
      .from('bills')
      .select('id, congress, bill_type, bill_number, title, short_title, summary, policy_area, subjects, enacted, latest_action_text')
      .not('summary', 'is', null) // Only process bills with summaries

    if (bill_id) {
      billsQuery = billsQuery.eq('id', bill_id)
    } else if (!force) {
      // Only get bills without impact assessment
      billsQuery = billsQuery.is('bill_impact', null)
    }

    const { data: bills, error: billsError } = await billsQuery.limit(batch_size)

    if (billsError) throw billsError
    if (!bills || bills.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No bills to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${bills.length} bills for impact assessment...`)

    let processed = 0
    let errors = 0

    for (const bill of bills) {
      try {
        const prompt = buildImpactPrompt(bill)
        
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a nonpartisan legislative analyst. Your job is to explain bill impacts in plain language that any citizen can understand. Be objective, factual, and balanced. Do not show political bias.

Output format (use this exact structure):
**What This Bill Does:**
[2-3 sentences explaining the main purpose]

**Who It Affects:**
[Bullet points of groups/sectors impacted]

**Potential Benefits:**
[Bullet points of positive outcomes]

**Potential Concerns:**
[Bullet points of criticisms or risks]

**Current Status:**
[One line about where it stands in the legislative process]`
              },
              { role: 'user', content: prompt }
            ],
          }),
        })

        if (!response.ok) {
          if (response.status === 429) {
            console.log('Rate limited, pausing...')
            await new Promise(r => setTimeout(r, 5000))
            continue
          }
          throw new Error(`AI API error: ${response.status}`)
        }

        const data = await response.json()
        const impactText = data.choices?.[0]?.message?.content

        if (impactText) {
          await supabase
            .from('bills')
            .update({
              bill_impact: impactText,
              impact_generated_at: new Date().toISOString()
            })
            .eq('id', bill.id)

          processed++
          console.log(`Generated impact for ${bill.bill_type.toUpperCase()}${bill.bill_number}`)
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500))

      } catch (e) {
        console.error(`Error processing bill ${bill.id}: ${e}`)
        errors++
      }
    }

    // Update sync progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bill-impacts',
        last_run_at: new Date().toISOString(),
        status: 'complete',
        total_processed: processed,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        errors,
        message: `Generated impact assessments for ${processed} bills` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Generate bill impact error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildImpactPrompt(bill: any): string {
  const billNumber = `${bill.bill_type.toUpperCase()} ${bill.bill_number}`
  const parts = [
    `Analyze this congressional bill and explain its impact:`,
    ``,
    `Bill: ${billNumber} (${bill.congress}th Congress)`,
    `Title: ${bill.title}`,
  ]

  if (bill.short_title) {
    parts.push(`Short Title: ${bill.short_title}`)
  }

  if (bill.policy_area) {
    parts.push(`Policy Area: ${bill.policy_area}`)
  }

  if (bill.subjects && bill.subjects.length > 0) {
    parts.push(`Subjects: ${bill.subjects.slice(0, 5).join(', ')}`)
  }

  parts.push(`Status: ${bill.enacted ? 'Enacted into law' : 'Pending'}`)

  if (bill.latest_action_text) {
    parts.push(`Latest Action: ${bill.latest_action_text}`)
  }

  if (bill.summary) {
    // Truncate summary if too long
    const maxSummaryLength = 2000
    const summary = bill.summary.length > maxSummaryLength 
      ? bill.summary.substring(0, maxSummaryLength) + '...'
      : bill.summary
    parts.push(``, `Summary:`, summary)
  }

  return parts.join('\n')
}
