import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEC_API_BASE = "https://api.open.fec.gov/v1";
const FEC_API_KEY = Deno.env.get('FEC_API_KEY') || "DEMO_KEY";

// State name to abbreviation mapping
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

interface FecCandidate {
  candidate_id: string;
  name: string;
  party: string;
  state: string;
  district: string;
  office: string;
  election_years: number[];
}

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
    try {
      const body = await req.json();
      offset = body.offset || 0;
      limit = body.limit || 20;
    } catch {
      // Use defaults if no body
    }

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

    console.log(`Processing ${members?.length || 0} members (${offset + 1} to ${offset + (members?.length || 0)} of ${count})`);

    let processedCount = 0;
    let matchedCount = 0;
    let errorCount = 0;
    const currentCycle = 2024;

    for (const member of members || []) {
      try {
        // Convert state name to abbreviation
        const stateAbbr = stateAbbreviations[member.state] || member.state;
        if (!stateAbbr || stateAbbr.length !== 2) {
          console.log(`Unknown state for ${member.full_name}: ${member.state}`);
          processedCount++;
          continue;
        }

        // Search by last name with state filter
        const lastName = member.last_name.replace(/[^a-zA-Z\s]/g, '').trim();
        const office = member.chamber === 'house' ? 'H' : 'S';
        
        const candidateSearchUrl = `${FEC_API_BASE}/candidates/?api_key=${FEC_API_KEY}&name=${encodeURIComponent(lastName)}&state=${stateAbbr}&office=${office}&is_active_candidate=true&sort=-election_years&per_page=20`;
        
        console.log(`Searching FEC for: ${member.full_name} (${stateAbbr}, ${office})`);
        
        await new Promise(resolve => setTimeout(resolve, 250));
        
        const candidateResponse = await fetch(candidateSearchUrl);
        if (!candidateResponse.ok) {
          if (candidateResponse.status === 429) {
            console.error(`Rate limited. Stopping sync.`);
            break;
          }
          console.log(`FEC search failed for ${member.full_name}: ${candidateResponse.status}`);
          processedCount++;
          continue;
        }

        const candidateData = await candidateResponse.json();
        const candidates = candidateData.results || [];
        
        console.log(`Found ${candidates.length} FEC candidates for ${lastName} in ${stateAbbr}`);

        // Find best matching candidate
        let matchingCandidate = null;
        const memberLastName = member.last_name.toLowerCase().replace(/[^a-z]/g, '');
        const memberFirstName = member.first_name.toLowerCase().replace(/[^a-z]/g, '');
        
        for (const c of candidates) {
          if (!c.name) continue;
          
          // FEC format is typically "LASTNAME, FIRSTNAME MIDDLE"
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
        
        // Fallback: just last name with same office
        if (!matchingCandidate) {
          for (const c of candidates) {
            if (!c.name) continue;
            const fecLastName = c.name.toLowerCase().split(',')[0]?.trim().replace(/[^a-z]/g, '') || '';
            if (fecLastName === memberLastName && c.office === office) {
              matchingCandidate = c;
              console.log(`Fallback match: ${member.full_name} -> ${c.name} (${c.candidate_id})`);
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

        await new Promise(resolve => setTimeout(resolve, 250));

        // Get committees
        const committeesUrl = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${FEC_API_KEY}&per_page=5`;
        const committeesResponse = await fetch(committeesUrl);
        
        if (!committeesResponse.ok) {
          if (committeesResponse.status === 429) {
            console.error(`Rate limited at committees. Stopping.`);
            break;
          }
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

        const principalCommittee = committees.find((c: any) => c.committee_type === 'P') || committees[0];
        const committeeId = principalCommittee.committee_id;
        console.log(`Found committee ${committeeId} for ${member.full_name}`);

        await new Promise(resolve => setTimeout(resolve, 250));

        // Fetch contributions
        const contributionsUrl = `${FEC_API_BASE}/schedules/schedule_a/by_contributor/?api_key=${FEC_API_KEY}&committee_id=${committeeId}&cycle=${currentCycle}&sort=-total&per_page=15`;
        const contributionsResponse = await fetch(contributionsUrl);

        if (contributionsResponse.ok) {
          const contributionsData = await contributionsResponse.json();
          const contributions = contributionsData.results || [];
          console.log(`Found ${contributions.length} contributors for ${member.full_name}`);

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
              console.error(`Failed to insert contributions: ${insertError.message}`);
            } else {
              console.log(`Inserted ${contributionRecords.length} contributions for ${member.full_name}`);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 250));

        // Fetch candidate totals
        const totalsUrl = `${FEC_API_BASE}/candidate/${candidateId}/totals/?api_key=${FEC_API_KEY}&cycle=${currentCycle}`;
        const totalsResponse = await fetch(totalsUrl);

        if (totalsResponse.ok) {
          const totalsData = await totalsResponse.json();
          const totals = totalsData.results?.[0];

          if (totals) {
            console.log(`Totals for ${member.full_name}: PAC=$${totals.other_political_committee_contributions || 0}`);
            
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
  if (combined.includes('farm') || combined.includes('agri') || combined.includes('ranch')) return 'Agriculture';
  if (combined.includes('media') || combined.includes('entertainment') || combined.includes('film') || combined.includes('tv')) return 'Media & Entertainment';
  if (combined.includes('defense') || combined.includes('military') || combined.includes('aerospace')) return 'Defense & Aerospace';
  return null;
}
