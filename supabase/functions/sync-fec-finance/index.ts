import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEC_API_BASE = "https://api.open.fec.gov/v1";
const FEC_API_KEY = "DEMO_KEY"; // FEC provides a demo key for basic access

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

interface FecContribution {
  contributor_name: string;
  contributor_employer: string;
  contributor_occupation: string;
  contribution_receipt_amount: number;
  contribution_receipt_date: string;
  committee: {
    name: string;
    committee_type: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting FEC finance data sync...");

    // Get all members from database
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id, first_name, last_name, full_name, state, party, chamber')
      .eq('in_office', true);

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    console.log(`Found ${members?.length || 0} members to process`);

    let processedCount = 0;
    let errorCount = 0;
    const currentCycle = 2024;

    for (const member of members || []) {
      try {
        // Search for FEC candidate by name and state
        const candidateSearchUrl = `${FEC_API_BASE}/candidates/search/?api_key=${FEC_API_KEY}&name=${encodeURIComponent(member.last_name)}&state=${member.state}&election_year=${currentCycle}&per_page=5`;
        
        console.log(`Searching FEC for: ${member.full_name} (${member.state})`);
        
        const candidateResponse = await fetch(candidateSearchUrl);
        if (!candidateResponse.ok) {
          console.error(`FEC API error for ${member.full_name}: ${candidateResponse.status}`);
          errorCount++;
          continue;
        }

        const candidateData = await candidateResponse.json();
        const candidates = candidateData.results || [];

        // Find best matching candidate
        const matchingCandidate = candidates.find((c: FecCandidate) => {
          const nameParts = c.name?.toLowerCase().split(',') || [];
          const lastName = nameParts[0]?.trim();
          return lastName === member.last_name.toLowerCase() && 
                 c.state === member.state;
        });

        if (!matchingCandidate) {
          console.log(`No FEC match found for ${member.full_name}`);
          continue;
        }

        const candidateId = matchingCandidate.candidate_id;
        console.log(`Found FEC candidate: ${candidateId} for ${member.full_name}`);

        // Get committee(s) for this candidate
        const committeesUrl = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${FEC_API_KEY}&cycle=${currentCycle}&per_page=5`;
        const committeesResponse = await fetch(committeesUrl);
        
        if (!committeesResponse.ok) {
          console.error(`Failed to fetch committees for ${candidateId}`);
          continue;
        }

        const committeesData = await committeesResponse.json();
        const committees = committeesData.results || [];

        if (committees.length === 0) {
          console.log(`No committees found for ${member.full_name}`);
          continue;
        }

        // Get contributions for the principal campaign committee
        const principalCommittee = committees.find((c: FecCommittee) => c.committee_type === 'P') || committees[0];
        const committeeId = principalCommittee.committee_id;

        // Fetch schedule A (itemized contributions) aggregated by contributor
        const contributionsUrl = `${FEC_API_BASE}/schedules/schedule_a/by_contributor/?api_key=${FEC_API_KEY}&committee_id=${committeeId}&cycle=${currentCycle}&sort=-total&per_page=10`;
        const contributionsResponse = await fetch(contributionsUrl);

        if (contributionsResponse.ok) {
          const contributionsData = await contributionsResponse.json();
          const contributions = contributionsData.results || [];

          // Prepare contribution records
          const contributionRecords = contributions.map((c: any) => ({
            member_id: member.id,
            contributor_name: c.contributor_name || 'Unknown',
            contributor_type: categorizeContributor(c.contributor_employer, c.contributor_occupation),
            amount: c.total || 0,
            cycle: currentCycle,
            industry: inferIndustry(c.contributor_employer, c.contributor_occupation),
          })).filter((c: any) => c.amount > 0);

          if (contributionRecords.length > 0) {
            // Delete existing contributions for this member and cycle
            await supabase
              .from('member_contributions')
              .delete()
              .eq('member_id', member.id)
              .eq('cycle', currentCycle);

            // Insert new contributions
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

        // Fetch totals/summary for the candidate
        const totalsUrl = `${FEC_API_BASE}/candidate/${candidateId}/totals/?api_key=${FEC_API_KEY}&cycle=${currentCycle}`;
        const totalsResponse = await fetch(totalsUrl);

        if (totalsResponse.ok) {
          const totalsData = await totalsResponse.json();
          const totals = totalsData.results?.[0];

          if (totals) {
            // Create sponsor record from PAC contributions
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

            // Create lobbying-like record from party contributions
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

        // Rate limiting - FEC API has limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (memberError) {
        console.error(`Error processing ${member.full_name}:`, memberError);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `FEC finance sync completed`,
      processedCount,
      errorCount,
      totalMembers: members?.length || 0,
    };

    console.log("Sync complete:", result);

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

  if (emp.includes('self') || emp.includes('retired') || occ.includes('retired')) {
    return 'individual';
  }
  if (emp.includes('llc') || emp.includes('inc') || emp.includes('corp') || emp.includes('co.')) {
    return 'corporate';
  }
  if (emp.includes('pac') || emp.includes('committee') || emp.includes('political')) {
    return 'pac';
  }
  if (emp.includes('union') || emp.includes('workers') || emp.includes('labor')) {
    return 'union';
  }
  return 'individual';
}

function inferIndustry(employer: string | null, occupation: string | null): string | null {
  const emp = (employer || '').toLowerCase();
  const occ = (occupation || '').toLowerCase();
  const combined = emp + ' ' + occ;

  if (combined.includes('law') || combined.includes('attorney') || combined.includes('legal')) {
    return 'Legal';
  }
  if (combined.includes('real estate') || combined.includes('realtor') || combined.includes('property')) {
    return 'Real Estate';
  }
  if (combined.includes('health') || combined.includes('medical') || combined.includes('doctor') || combined.includes('hospital')) {
    return 'Healthcare';
  }
  if (combined.includes('bank') || combined.includes('financial') || combined.includes('investment') || combined.includes('insurance')) {
    return 'Finance & Insurance';
  }
  if (combined.includes('tech') || combined.includes('software') || combined.includes('computer') || combined.includes('engineer')) {
    return 'Technology';
  }
  if (combined.includes('oil') || combined.includes('gas') || combined.includes('energy') || combined.includes('utility')) {
    return 'Energy';
  }
  if (combined.includes('construction') || combined.includes('builder') || combined.includes('contractor')) {
    return 'Construction';
  }
  if (combined.includes('retired')) {
    return 'Retired';
  }
  if (combined.includes('education') || combined.includes('teacher') || combined.includes('professor') || combined.includes('university')) {
    return 'Education';
  }
  return null;
}
