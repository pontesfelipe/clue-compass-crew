import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEC_API_BASE = "https://api.open.fec.gov/v1";
const FEC_API_KEY = Deno.env.get('FEC_API_KEY') || "DEMO_KEY";

interface FecCandidate {
  candidate_id: string;
  name: string;
  party: string;
  state: string;
  district: string;
  office: string;
}

interface FecCommittee {
  committee_id: string;
  name: string;
  committee_type: string;
  party: string;
  treasurer_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for pagination
    let offset = 0;
    let limit = 50; // Process 50 members per call with real API key
    try {
      const body = await req.json();
      offset = body.offset || 0;
      limit = body.limit || 10;
    } catch {
      // Use defaults if no body
    }

    console.log(`Starting FEC finance sync (offset: ${offset}, limit: ${limit})...`);

    // Get members with pagination
    const { data: members, error: membersError, count } = await supabase
      .from('members')
      .select('id, bioguide_id, first_name, last_name, full_name, state, party, chamber', { count: 'exact' })
      .eq('in_office', true)
      .order('last_name')
      .range(offset, offset + limit - 1);

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    console.log(`Processing ${members?.length || 0} members (${offset + 1} to ${offset + (members?.length || 0)} of ${count})`);

    let processedCount = 0;
    let matchedCount = 0;
    let errorCount = 0;
    const currentCycle = 2024;

    for (const member of members || []) {
      try {
        // Search for FEC candidate by name and state - try multiple cycles
        const searchCycles = [2024, 2022, 2020];
        let matchingCandidate = null;
        let candidateResponse = null;
        
        for (const cycle of searchCycles) {
          const candidateSearchUrl = `${FEC_API_BASE}/candidates/search/?api_key=${FEC_API_KEY}&q=${encodeURIComponent(member.full_name)}&state=${member.state}&cycle=${cycle}&per_page=10&office=H&office=S`;
          
          console.log(`Searching FEC for: ${member.full_name} (${member.state}, cycle ${cycle})`);
          
          // Wait between requests
          await new Promise(resolve => setTimeout(resolve, 200));
          
          candidateResponse = await fetch(candidateSearchUrl);
          if (!candidateResponse.ok) {
            if (candidateResponse.status === 429) {
              console.error(`Rate limited. Stopping sync.`);
              break;
            }
            continue;
          }

          const candidateData = await candidateResponse.json();
          const candidates = candidateData.results || [];
          
          if (candidates.length > 0) {
            // Find best matching candidate - improved matching logic
            const memberLastName = member.last_name.toLowerCase().replace(/[^a-z]/g, '');
            const memberFirstName = member.first_name.toLowerCase().replace(/[^a-z]/g, '');
            
            matchingCandidate = candidates.find((c: FecCandidate) => {
              if (!c.name || c.state !== member.state) return false;
              
              // FEC format is typically "LASTNAME, FIRSTNAME MIDDLE"
              const fecName = c.name.toLowerCase();
              const fecLastName = fecName.split(',')[0]?.trim().replace(/[^a-z]/g, '') || '';
              const fecFirstPart = fecName.split(',')[1]?.trim().split(' ')[0]?.replace(/[^a-z]/g, '') || '';
              
              // Match last name
              const lastNameMatch = fecLastName === memberLastName || 
                                   fecLastName.includes(memberLastName) || 
                                   memberLastName.includes(fecLastName);
              
              // Match first name (at least first 3 chars)
              const firstNameMatch = fecFirstPart === memberFirstName ||
                                    fecFirstPart.startsWith(memberFirstName.substring(0, 3)) ||
                                    memberFirstName.startsWith(fecFirstPart.substring(0, 3));
              
              return lastNameMatch && firstNameMatch;
            });
            
            // If no exact match, take first result with matching state
            if (!matchingCandidate && candidates.length > 0) {
              matchingCandidate = candidates.find((c: FecCandidate) => c.state === member.state);
            }
            
            if (matchingCandidate) break;
          }
        }

        if (!matchingCandidate) {
          console.log(`No FEC match for ${member.full_name}`);
          processedCount++;
          continue;
        }

        const candidateId = matchingCandidate.candidate_id;
        console.log(`Found FEC candidate: ${candidateId} for ${member.full_name}`);
        matchedCount++;

        // Wait before next API call
        await new Promise(resolve => setTimeout(resolve, 200));

        // Get committee(s) for this candidate
        const committeesUrl = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${FEC_API_KEY}&cycle=${currentCycle}&per_page=5`;
        const committeesResponse = await fetch(committeesUrl);
        
        if (!committeesResponse.ok) {
          if (committeesResponse.status === 429) {
            console.error(`Rate limited at committees. Stopping.`);
            break;
          }
          console.error(`Failed to fetch committees for ${candidateId}`);
          processedCount++;
          continue;
        }

        const committeesData = await committeesResponse.json();
        const committees = committeesData.results || [];

        if (committees.length === 0) {
          console.log(`No committees found for ${member.full_name}`);
          processedCount++;
          continue;
        }

        // Get principal campaign committee
        const principalCommittee = committees.find((c: FecCommittee) => c.committee_type === 'P') || committees[0];
        const committeeId = principalCommittee.committee_id;

        await new Promise(resolve => setTimeout(resolve, 200));

        // Fetch schedule A (itemized contributions)
        const contributionsUrl = `${FEC_API_BASE}/schedules/schedule_a/by_contributor/?api_key=${FEC_API_KEY}&committee_id=${committeeId}&cycle=${currentCycle}&sort=-total&per_page=10`;
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

            const { error: insertError } = await supabase
              .from('member_contributions')
              .insert(contributionRecords);

            if (insertError) {
              console.error(`Failed to insert contributions for ${member.full_name}: ${insertError.message}`);
            } else {
              console.log(`Inserted ${contributionRecords.length} contributions for ${member.full_name}`);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // Fetch totals for the candidate
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
          }
        }

        processedCount++;

      } catch (memberError) {
        console.error(`Error processing ${member.full_name}:`, memberError);
        errorCount++;
      }
    }

    const hasMore = (offset + (members?.length || 0)) < (count || 0);
    const nextOffset = offset + (members?.length || 0);

    const result = {
      success: true,
      message: `FEC finance sync batch completed`,
      processedCount,
      matchedCount,
      errorCount,
      totalMembers: count || 0,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
      hint: hasMore ? `Call again with {"offset": ${nextOffset}} to continue` : 'All members processed',
    };

    console.log("Batch complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-fec-finance:', error);
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
  return null;
}
