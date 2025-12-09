import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEC_API_BASE = "https://api.open.fec.gov/v1";
const FEC_API_KEY = Deno.env.get('FEC_API_KEY') || "DEMO_KEY";

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
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let offset = 0;
    let limit = 20;
    let useProgressTracking = true;
    
    try {
      const body = await req.json();
      if (body.offset !== undefined) {
        offset = body.offset;
        useProgressTracking = false; // Manual offset override
      }
      limit = body.limit || 20;
      if (body.reset) {
        // Reset progress tracking
        await supabase
          .from('sync_progress')
          .update({ current_offset: 0, status: 'idle', total_processed: 0 })
          .eq('id', 'fec-finance');
        useProgressTracking = true;
      }
    } catch {
      // Use defaults if no body
    }

    // Get progress from tracking table if not manually specified
    if (useProgressTracking) {
      const { data: progress } = await supabase
        .from('sync_progress')
        .select('current_offset, status')
        .eq('id', 'fec-finance')
        .single();
      
      if (progress) {
        offset = progress.current_offset || 0;
      }
    }

    // Update status to running
    await supabase
      .from('sync_progress')
      .update({ status: 'running', last_run_at: new Date().toISOString() })
      .eq('id', 'fec-finance');

    console.log(`Starting FEC finance sync (offset: ${offset}, limit: ${limit})...`);

    const { data: members, error: membersError, count } = await supabase
      .from('members')
      .select('id, bioguide_id, first_name, last_name, full_name, state, party, chamber', { count: 'exact' })
      .eq('in_office', true)
      .order('last_name')
      .range(offset, offset + limit - 1);

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    const totalMembers = count || 0;
    
    // Check if we've processed all members
    if (!members || members.length === 0) {
      console.log('All members processed. Resetting offset to 0 for next cycle.');
      await supabase
        .from('sync_progress')
        .update({ 
          current_offset: 0, 
          status: 'complete',
          updated_at: new Date().toISOString()
        })
        .eq('id', 'fec-finance');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'All members processed. Will restart from beginning on next run.',
        totalMembers,
        processedCount: 0,
        matchedCount: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${members.length} members (${offset + 1} to ${offset + members.length} of ${totalMembers})`);

    let processedCount = 0;
    let matchedCount = 0;
    let errorCount = 0;
    const currentCycle = 2024;

    for (const member of members) {
      try {
        const stateAbbr = stateAbbreviations[member.state] || member.state;
        if (!stateAbbr || stateAbbr.length !== 2) {
          console.log(`Unknown state for ${member.full_name}: ${member.state}`);
          processedCount++;
          continue;
        }

        const lastName = member.last_name.replace(/[^a-zA-Z\s]/g, '').trim();
        const office = member.chamber === 'house' ? 'H' : 'S';
        
        const candidateSearchUrl = `${FEC_API_BASE}/candidates/?api_key=${FEC_API_KEY}&name=${encodeURIComponent(lastName)}&state=${stateAbbr}&office=${office}&is_active_candidate=true&sort=-election_years&per_page=20`;
        
        console.log(`Searching FEC for: ${member.full_name} (${stateAbbr}, ${office})`);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const candidateResponse = await fetch(candidateSearchUrl);
        if (!candidateResponse.ok) {
          if (candidateResponse.status === 429) {
            console.error(`Rate limited. Saving progress and stopping.`);
            break;
          }
          console.log(`FEC search failed: ${candidateResponse.status}`);
          processedCount++;
          continue;
        }

        const candidateData = await candidateResponse.json();
        const candidates = candidateData.results || [];
        
        let matchingCandidate = null;
        const memberLastName = member.last_name.toLowerCase().replace(/[^a-z]/g, '');
        const memberFirstName = member.first_name.toLowerCase().replace(/[^a-z]/g, '');
        
        for (const c of candidates) {
          if (!c.name) continue;
          const fecName = c.name.toLowerCase();
          const nameParts = fecName.split(',');
          const fecLastName = nameParts[0]?.trim().replace(/[^a-z]/g, '') || '';
          const fecFirstPart = nameParts[1]?.trim().split(' ')[0]?.replace(/[^a-z]/g, '') || '';
          
          const lastNameMatch = fecLastName === memberLastName;
          const firstNameMatch = fecFirstPart === memberFirstName ||
                                (fecFirstPart.length >= 3 && memberFirstName.startsWith(fecFirstPart.substring(0, 3))) ||
                                (memberFirstName.length >= 3 && fecFirstPart.startsWith(memberFirstName.substring(0, 3)));
          
          if (lastNameMatch && firstNameMatch) {
            matchingCandidate = c;
            console.log(`Matched: ${member.full_name} -> ${c.name} (${c.candidate_id})`);
            break;
          }
        }
        
        if (!matchingCandidate) {
          for (const c of candidates) {
            if (!c.name) continue;
            const fecLastName = c.name.toLowerCase().split(',')[0]?.trim().replace(/[^a-z]/g, '') || '';
            if (fecLastName === memberLastName && c.office === office) {
              matchingCandidate = c;
              console.log(`Fallback match: ${member.full_name} -> ${c.name}`);
              break;
            }
          }
        }

        if (!matchingCandidate) {
          console.log(`No FEC match for ${member.full_name}`);
          processedCount++;
          continue;
        }

        const candidateId = matchingCandidate.candidate_id;
        matchedCount++;

        await new Promise(resolve => setTimeout(resolve, 300));

        const committeesUrl = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${FEC_API_KEY}&per_page=5`;
        const committeesResponse = await fetch(committeesUrl);
        
        if (!committeesResponse.ok) {
          if (committeesResponse.status === 429) break;
          processedCount++;
          continue;
        }

        const committeesData = await committeesResponse.json();
        const committees = committeesData.results || [];

        if (committees.length === 0) {
          processedCount++;
          continue;
        }

        const principalCommittee = committees.find((c: any) => c.committee_type === 'P') || committees[0];
        const committeeId = principalCommittee.committee_id;

        await new Promise(resolve => setTimeout(resolve, 300));

        // Fetch contributions
        const contributionsUrl = `${FEC_API_BASE}/schedules/schedule_a/by_contributor/?api_key=${FEC_API_KEY}&committee_id=${committeeId}&cycle=${currentCycle}&sort=-total&per_page=15`;
        const contributionsResponse = await fetch(contributionsUrl);

        if (contributionsResponse.ok) {
          const contributionsData = await contributionsResponse.json();
          const contributions = contributionsData.results || [];

          const contributionRecords = contributions.map((c: any) => ({
            member_id: member.id,
            contributor_name: c.contributor_name || 'Unknown',
            contributor_type: categorizeContributor(c.contributor_employer, c.contributor_occupation),
            amount: c.total || 0,
            cycle: currentCycle,
            industry: inferIndustry(c.contributor_employer, c.contributor_occupation),
          })).filter((c: any) => c.amount > 0);

          if (contributionRecords.length > 0) {
            await supabase
              .from('member_contributions')
              .delete()
              .eq('member_id', member.id)
              .eq('cycle', currentCycle);

            await supabase
              .from('member_contributions')
              .insert(contributionRecords);
            
            console.log(`Inserted ${contributionRecords.length} contributions for ${member.full_name}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        // Fetch totals
        const totalsUrl = `${FEC_API_BASE}/candidate/${candidateId}/totals/?api_key=${FEC_API_KEY}&cycle=${currentCycle}`;
        const totalsResponse = await fetch(totalsUrl);

        if (totalsResponse.ok) {
          const totalsData = await totalsResponse.json();
          const totals = totalsData.results?.[0];

          if (totals) {
            const pacAmount = totals.other_political_committee_contributions || 0;
            if (pacAmount > 0) {
              await supabase
                .from('member_sponsors')
                .delete()
                .eq('member_id', member.id)
                .eq('cycle', currentCycle);

              await supabase
                .from('member_sponsors')
                .insert({
                  member_id: member.id,
                  sponsor_name: 'Political Action Committees',
                  sponsor_type: 'pac',
                  relationship_type: 'contributor',
                  total_support: pacAmount,
                  cycle: currentCycle,
                });
            }

            const partyAmount = totals.party_committee_contributions || 0;
            if (partyAmount > 0) {
              await supabase
                .from('member_lobbying')
                .delete()
                .eq('member_id', member.id)
                .eq('cycle', currentCycle);

              await supabase
                .from('member_lobbying')
                .insert({
                  member_id: member.id,
                  industry: 'Party Committee Support',
                  total_spent: partyAmount,
                  client_count: 1,
                  cycle: currentCycle,
                });
            }

            const individualAmount = totals.individual_itemized_contributions || 0;
            if (individualAmount > 0) {
              const existingContribs = await supabase
                .from('member_contributions')
                .select('id')
                .eq('member_id', member.id)
                .eq('cycle', currentCycle);
              
              if ((existingContribs.data?.length || 0) === 0) {
                await supabase
                  .from('member_contributions')
                  .insert({
                    member_id: member.id,
                    contributor_name: 'Individual Contributors (Total)',
                    contributor_type: 'individual',
                    amount: individualAmount,
                    cycle: currentCycle,
                    industry: null,
                  });
              }
            }
          }
        }

        processedCount++;

      } catch (memberError) {
        console.error(`Error processing ${member.full_name}:`, memberError);
        errorCount++;
      }
    }

    // Calculate next offset
    const nextOffset = offset + members.length;
    const hasMore = nextOffset < totalMembers;

    // Update progress tracking
    await supabase
      .from('sync_progress')
      .update({ 
        current_offset: hasMore ? nextOffset : 0,
        last_matched_count: matchedCount,
        total_processed: offset + processedCount,
        status: hasMore ? 'idle' : 'complete',
        updated_at: new Date().toISOString()
      })
      .eq('id', 'fec-finance');

    const result = {
      success: true,
      message: `FEC finance sync batch completed`,
      processedCount,
      matchedCount,
      errorCount,
      totalMembers,
      currentOffset: offset,
      nextOffset: hasMore ? nextOffset : 0,
      hasMore,
      progress: `${Math.round((nextOffset / totalMembers) * 100)}%`,
    };

    console.log("Batch complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-fec-finance:', error);
    
    // Update status to error
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase
      .from('sync_progress')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('id', 'fec-finance');
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function categorizeContributor(employer: string | null, occupation: string | null): string {
  const emp = (employer || '').toLowerCase();
  const occ = (occupation || '').toLowerCase();

  if (emp.includes('self') || emp.includes('retired') || occ.includes('retired')) return 'individual';
  if (emp.includes('llc') || emp.includes('inc') || emp.includes('corp') || emp.includes('co.')) return 'corporate';
  if (emp.includes('pac') || emp.includes('committee') || emp.includes('political')) return 'pac';
  if (emp.includes('union') || emp.includes('workers') || emp.includes('labor')) return 'union';
  return 'individual';
}

function inferIndustry(employer: string | null, occupation: string | null): string | null {
  const combined = ((employer || '') + ' ' + (occupation || '')).toLowerCase();

  if (combined.includes('law') || combined.includes('attorney') || combined.includes('legal')) return 'Legal';
  if (combined.includes('real estate') || combined.includes('realtor') || combined.includes('property')) return 'Real Estate';
  if (combined.includes('health') || combined.includes('medical') || combined.includes('doctor') || combined.includes('hospital')) return 'Healthcare';
  if (combined.includes('bank') || combined.includes('financial') || combined.includes('investment') || combined.includes('insurance')) return 'Finance & Insurance';
  if (combined.includes('tech') || combined.includes('software') || combined.includes('computer') || combined.includes('engineer')) return 'Technology';
  if (combined.includes('oil') || combined.includes('gas') || combined.includes('energy') || combined.includes('utility')) return 'Energy';
  if (combined.includes('construction') || combined.includes('builder') || combined.includes('contractor')) return 'Construction';
  if (combined.includes('retired')) return 'Retired';
  if (combined.includes('education') || combined.includes('teacher') || combined.includes('professor') || combined.includes('university')) return 'Education';
  if (combined.includes('farm') || combined.includes('agri') || combined.includes('ranch')) return 'Agriculture';
  if (combined.includes('media') || combined.includes('entertainment') || combined.includes('film') || combined.includes('tv')) return 'Media & Entertainment';
  if (combined.includes('defense') || combined.includes('military') || combined.includes('aerospace')) return 'Defense & Aerospace';
  return null;
}
