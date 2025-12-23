import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Parse bill reference from vote description like "HR 2670", "HRES 583", "S 123", etc.
function parseBillReference(description: string | null): { billType: string; billNumber: number; congress: number } | null {
  if (!description) return null
  
  // Match patterns like "HR 2670", "H.R. 2670", "HRES 583", "H.Res. 583", "S 123", "S. 123", etc.
  const patterns = [
    /\b(HR|H\.R\.?)\s*(\d+)/i,
    /\b(HRES|H\.?\s*RES\.?)\s*(\d+)/i,
    /\b(HJRES|H\.?\s*J\.?\s*RES\.?)\s*(\d+)/i,
    /\b(HCONRES|H\.?\s*CON\.?\s*RES\.?)\s*(\d+)/i,
    /\b(S|S\.)\s*(\d+)/i,
    /\b(SRES|S\.?\s*RES\.?)\s*(\d+)/i,
    /\b(SJRES|S\.?\s*J\.?\s*RES\.?)\s*(\d+)/i,
    /\b(SCONRES|S\.?\s*CON\.?\s*RES\.?)\s*(\d+)/i,
  ]
  
  const typeMapping: { [key: string]: string } = {
    'hr': 'hr', 'h.r.': 'hr', 'h.r': 'hr',
    'hres': 'hres', 'h.res.': 'hres', 'h.res': 'hres', 'h res': 'hres',
    'hjres': 'hjres', 'h.j.res.': 'hjres', 'h j res': 'hjres',
    'hconres': 'hconres', 'h.con.res.': 'hconres', 'h con res': 'hconres',
    's': 's', 's.': 's',
    'sres': 'sres', 's.res.': 'sres', 's.res': 'sres', 's res': 'sres',
    'sjres': 'sjres', 's.j.res.': 'sjres', 's j res': 'sjres',
    'sconres': 'sconres', 's.con.res.': 'sconres', 's con res': 'sconres',
  }
  
  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      const rawType = match[1].toLowerCase().replace(/\s+/g, '').replace(/\./g, '')
      const billType = typeMapping[rawType] || rawType
      const billNumber = parseInt(match[2])
      return { billType, billNumber, congress: 119 } // Default to current congress
    }
  }
  
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let body: Record<string, any> = {}
    try {
      const text = await req.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch {
      // Ignore parse errors, use defaults
    }
    const batchSize = body.batch_size || 500
    const forceRelink = body.force || false

    console.log(`Starting vote-to-bill linking (batch: ${batchSize}, force: ${forceRelink})...`)

    // Get votes without bill_id (or all if force)
    const query = supabase
      .from('votes')
      .select('id, description, question, congress')
      .order('vote_date', { ascending: false })
      .limit(batchSize)
    
    if (!forceRelink) {
      query.is('bill_id', null)
    }

    const { data: votes, error: votesError } = await query

    if (votesError) {
      throw new Error(`Failed to fetch votes: ${votesError.message}`)
    }

    if (!votes || votes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No votes to link', linked: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${votes.length} votes...`)

    // Pre-fetch all bills for efficiency
    const { data: bills } = await supabase
      .from('bills')
      .select('id, bill_type, bill_number, congress, policy_area')

    const billMap = new Map<string, { id: string; policyArea: string | null }>()
    for (const bill of bills || []) {
      const key = `${bill.bill_type}-${bill.bill_number}-${bill.congress}`
      billMap.set(key, { id: bill.id, policyArea: bill.policy_area })
    }
    console.log(`Loaded ${billMap.size} bills for matching`)

    let linked = 0
    let notFound = 0
    const updates: { id: string; bill_id: string }[] = []

    for (const vote of votes) {
      // Try to parse from description first, then question
      const ref = parseBillReference(vote.description) || parseBillReference(vote.question)
      
      if (!ref) {
        notFound++
        continue
      }

      // Use vote's congress or default
      const congress = vote.congress || ref.congress
      const key = `${ref.billType}-${ref.billNumber}-${congress}`
      const bill = billMap.get(key)

      if (bill) {
        updates.push({ id: vote.id, bill_id: bill.id })
        linked++
      } else {
        // Try adjacent congress (some votes reference previous congress bills)
        const altKey = `${ref.billType}-${ref.billNumber}-${congress - 1}`
        const altBill = billMap.get(altKey)
        if (altBill) {
          updates.push({ id: vote.id, bill_id: altBill.id })
          linked++
        } else {
          notFound++
        }
      }
    }

    // Batch update votes with bill_id
    for (const update of updates) {
      await supabase
        .from('votes')
        .update({ bill_id: update.bill_id })
        .eq('id', update.id)
    }

    const result = {
      success: true,
      processed: votes.length,
      linked,
      notFound,
      message: `Linked ${linked} votes to bills, ${notFound} bills not found`
    }

    console.log('Link votes to bills completed:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Link votes to bills error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
