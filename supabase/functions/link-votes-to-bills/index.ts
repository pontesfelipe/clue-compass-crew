import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

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
      .select('id, description, question, congress, vote_date')
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
      .select('id, bill_type, bill_number, congress')
      .eq('level', 'federal')

    const billMap = new Map<string, string>()
    for (const bill of bills || []) {
      billMap.set(`${bill.bill_type}-${bill.bill_number}-${bill.congress}`, bill.id)
    }
    console.log(`Loaded ${billMap.size} bills for matching`)

    // Derive congress from a vote_date (year >= 2025 => 119, 2023-2024 => 118, etc.)
    const congressFromDate = (dateStr: string | null): number => {
      if (!dateStr) return 119
      const year = new Date(dateStr).getUTCFullYear()
      return Math.floor((year - 1789) / 2) + 1
    }

    let linked = 0
    let notFound = 0
    const updates: { id: string; bill_id: string }[] = []

    for (const vote of votes) {
      const ref = parseBillReference(vote.description) || parseBillReference(vote.question)
      if (!ref) { notFound++; continue }

      const primaryCongress = vote.congress || congressFromDate(vote.vote_date)
      const candidates = [primaryCongress, primaryCongress - 1, primaryCongress + 1]
      let matchedId: string | null = null
      for (const c of candidates) {
        const id = billMap.get(`${ref.billType}-${ref.billNumber}-${c}`)
        if (id) { matchedId = id; break }
      }
      if (matchedId) {
        updates.push({ id: vote.id, bill_id: matchedId })
        linked++
      } else {
        notFound++
      }
    }

    // Parallel batched updates (chunks of 25)
    const chunkSize = 25
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      await Promise.all(chunk.map((u) =>
        supabase.from('votes').update({ bill_id: u.bill_id }).eq('id', u.id)
      ))
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
