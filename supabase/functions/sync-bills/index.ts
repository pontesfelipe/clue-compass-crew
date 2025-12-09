import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BillSponsor {
  bioguideId: string
  fullName: string
  isByRequest?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const congressApiKey = Deno.env.get('CONGRESS_GOV_API_KEY')
    if (!congressApiKey) {
      throw new Error('CONGRESS_GOV_API_KEY is not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting bills sync...')

    // Get all members from DB to map bioguide_id to member id
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id')
    
    if (membersError) throw membersError
    
    const memberMap = new Map(members?.map(m => [m.bioguide_id, m.id]) || [])
    console.log(`Loaded ${memberMap.size} members for mapping`)

    // Fetch recent bills from Congress 118 and 119
    const billTypes = ['hr', 's', 'hjres', 'sjres']
    const congresses = [118, 119]
    let totalBillsProcessed = 0
    let totalSponsorshipsCreated = 0

    for (const congress of congresses) {
      for (const billType of billTypes) {
        console.log(`Fetching ${billType} bills from Congress ${congress}...`)
        
        let offset = 0
        const limit = 250
        let hasMore = true
        let billsInType = 0
        
        while (hasMore && billsInType < 500) { // Limit per type to avoid timeout
          const url = `https://api.congress.gov/v3/bill/${congress}/${billType}?format=json&limit=${limit}&offset=${offset}&api_key=${congressApiKey}`
          
          const response = await fetch(url)
          
          if (!response.ok) {
            console.error(`Congress API error for ${billType}: ${response.status}`)
            break
          }
          
          const data = await response.json()
          const bills = data.bills || []
          
          if (bills.length === 0) {
            hasMore = false
            break
          }

          // Process each bill
          for (const bill of bills) {
            try {
              // Fetch bill details to get sponsor info
              const detailUrl = `https://api.congress.gov/v3/bill/${congress}/${billType}/${bill.number}?format=json&api_key=${congressApiKey}`
              const detailResponse = await fetch(detailUrl)
              
              if (!detailResponse.ok) {
                console.log(`Skipping bill ${bill.number}: detail fetch failed`)
                continue
              }
              
              const detailData = await detailResponse.json()
              const billDetail = detailData.bill

              // Map bill type
              const billTypeMap: Record<string, string> = {
                'hr': 'hr',
                's': 's',
                'hjres': 'hjres',
                'sjres': 'sjres',
                'hconres': 'hconres',
                'sconres': 'sconres',
                'hres': 'hres',
                'sres': 'sres'
              }

              const billRecord = {
                congress: congress,
                bill_type: billTypeMap[billType] || 'hr',
                bill_number: bill.number,
                title: billDetail.title || bill.title || 'Untitled',
                short_title: billDetail.shortTitle || null,
                introduced_date: billDetail.introducedDate || null,
                latest_action_date: billDetail.latestAction?.actionDate || null,
                latest_action_text: billDetail.latestAction?.text || null,
                policy_area: billDetail.policyArea?.name || null,
                subjects: billDetail.subjects?.legislativeSubjects?.map((s: any) => s.name) || null,
                url: bill.url || null,
                enacted: billDetail.laws?.length > 0,
                enacted_date: billDetail.laws?.[0]?.date || null,
                summary: null,
                updated_at: new Date().toISOString(),
              }

              // Upsert bill
              const { data: upsertedBill, error: billError } = await supabase
                .from('bills')
                .upsert(billRecord, {
                  onConflict: 'congress,bill_type,bill_number',
                  ignoreDuplicates: false
                })
                .select('id')
                .single()

              if (billError) {
                // Try to get existing bill
                const { data: existingBill } = await supabase
                  .from('bills')
                  .select('id')
                  .eq('congress', congress)
                  .eq('bill_type', billTypeMap[billType] || 'hr')
                  .eq('bill_number', bill.number)
                  .single()
                
                if (!existingBill) {
                  console.log(`Error upserting bill ${billType}${bill.number}: ${billError.message}`)
                  continue
                }
                
                // Process sponsorships for existing bill
                const billId = existingBill.id
                await processSponsorships(supabase, billDetail, billId, memberMap)
                totalBillsProcessed++
                continue
              }

              if (upsertedBill) {
                const sponsorshipsCreated = await processSponsorships(supabase, billDetail, upsertedBill.id, memberMap)
                totalSponsorshipsCreated += sponsorshipsCreated
                totalBillsProcessed++
              }

            } catch (billError) {
              console.log(`Error processing bill: ${billError}`)
            }
          }

          billsInType += bills.length
          offset += limit
          hasMore = bills.length === limit
          
          console.log(`Processed ${billsInType} ${billType} bills from Congress ${congress}`)
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    // Update sync progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'bills',
        last_run_at: new Date().toISOString(),
        status: 'complete',
        total_processed: totalBillsProcessed,
        current_offset: 0,
      }, { onConflict: 'id' })

    const result = {
      success: true,
      billsProcessed: totalBillsProcessed,
      sponsorshipsCreated: totalSponsorshipsCreated,
      message: `Successfully synced ${totalBillsProcessed} bills with ${totalSponsorshipsCreated} sponsorships`
    }

    console.log('Bills sync completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Bills sync error:', errorMessage)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function processSponsorships(
  supabase: any,
  billDetail: any,
  billId: string,
  memberMap: Map<string, string>
): Promise<number> {
  let created = 0

  // Process primary sponsor
  if (billDetail.sponsors?.[0]) {
    const sponsor = billDetail.sponsors[0]
    const memberId = memberMap.get(sponsor.bioguideId)
    
    if (memberId) {
      const { error } = await supabase
        .from('bill_sponsorships')
        .upsert({
          bill_id: billId,
          member_id: memberId,
          is_sponsor: true,
          is_original_cosponsor: false,
          cosponsored_date: billDetail.introducedDate || null,
        }, {
          onConflict: 'bill_id,member_id',
          ignoreDuplicates: true
        })
      
      if (!error) created++
    }
  }

  // Fetch and process cosponsors if available
  if (billDetail.cosponsors?.count > 0 && billDetail.cosponsors?.url) {
    try {
      const congressApiKey = Deno.env.get('CONGRESS_GOV_API_KEY')
      const cosponsorsUrl = `${billDetail.cosponsors.url}&format=json&api_key=${congressApiKey}`
      const response = await fetch(cosponsorsUrl)
      
      if (response.ok) {
        const data = await response.json()
        const cosponsors = data.cosponsors || []
        
        for (const cosponsor of cosponsors.slice(0, 50)) { // Limit cosponsors per bill
          const memberId = memberMap.get(cosponsor.bioguideId)
          
          if (memberId) {
            const { error } = await supabase
              .from('bill_sponsorships')
              .upsert({
                bill_id: billId,
                member_id: memberId,
                is_sponsor: false,
                is_original_cosponsor: cosponsor.isOriginalCosponsor || false,
                cosponsored_date: cosponsor.sponsorshipDate || null,
              }, {
                onConflict: 'bill_id,member_id',
                ignoreDuplicates: true
              })
            
            if (!error) created++
          }
        }
      }
    } catch (e) {
      console.log('Error fetching cosponsors:', e)
    }
  }

  return created
}
