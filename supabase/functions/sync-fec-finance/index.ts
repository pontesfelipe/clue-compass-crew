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

// Threshold for identifying major sponsors (contributors above this are sponsors)
const SPONSOR_THRESHOLD = 5000;

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
        useProgressTracking = false;
      }
      limit = body.limit || 20;
      if (body.reset) {
        await supabase
          .from('sync_progress')
          .update({ current_offset: 0, status: 'idle', total_processed: 0 })
          .eq('id', 'fec-finance');
        useProgressTracking = true;
      }
    } catch {
      // Use defaults if no body
    }

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

        // Fetch itemized contributions with actual donor names
        const contributionsUrl = `${FEC_API_BASE}/schedules/schedule_a/?api_key=${FEC_API_KEY}&committee_id=${committeeId}&two_year_transaction_period=${currentCycle}&sort=-contribution_receipt_amount&per_page=50`;
        const contributionsResponse = await fetch(contributionsUrl);

        const allContributions: any[] = [];
        const sponsors: any[] = [];
        const industryTotals = new Map<string, { total: number; count: number }>();
        const contributorAggregates = new Map<string, { name: string; type: string; amount: number; industry: string | null; state: string | null }>();

        if (contributionsResponse.ok) {
          const contributionsData = await contributionsResponse.json();
          const contributions = contributionsData.results || [];

          for (const c of contributions) {
            const amount = c.contribution_receipt_amount || 0;
            if (amount <= 0) continue;

            // Get actual donor name - use committee name for PACs, contributor name for individuals
            let contributorName = c.contributor_name || 'Unknown';
            const contributorType = categorizeContributor(c.contributor_employer, c.contributor_occupation);
            
            // For PACs/committees, use the committee name if available
            if (c.committee && c.committee.name) {
              contributorName = c.committee.name;
            } else if (c.contributor_aggregate_ytd > 200 && contributorType === 'pac') {
              // This is likely a PAC contribution - the contributor_name should have the PAC name
              contributorName = c.contributor_name || 'Unknown PAC';
            }
            
            const industry = inferIndustry(c.contributor_employer, c.contributor_occupation);
            const contributorState = c.contributor_state || null;

            // Aggregate contributions by contributor name
            const existing = contributorAggregates.get(contributorName);
            if (existing) {
              existing.amount += amount;
              // Keep the first state we see for this contributor
              if (!existing.state && contributorState) {
                existing.state = contributorState;
              }
            } else {
              contributorAggregates.set(contributorName, {
                name: contributorName,
                type: contributorType,
                amount: amount,
                industry: industry,
                state: contributorState,
              });
            }

            // Track industry totals for lobbying data
            if (industry) {
              const existingIndustry = industryTotals.get(industry) || { total: 0, count: 0 };
              industryTotals.set(industry, { 
                total: existingIndustry.total + amount, 
                count: existingIndustry.count + 1 
              });
            }
          }

          // Convert aggregated contributors to contribution records
          for (const [name, data] of contributorAggregates) {
            allContributions.push({
              member_id: member.id,
              contributor_name: data.name,
              contributor_type: data.type,
              amount: data.amount,
              cycle: currentCycle,
              industry: data.industry,
              contributor_state: data.state,
            });

            // Identify sponsors: large contributors that are PACs, corporations, or unions
            if (data.amount >= SPONSOR_THRESHOLD && (data.type === 'pac' || data.type === 'corporate' || data.type === 'union')) {
              sponsors.push({
                member_id: member.id,
                sponsor_name: data.name,
                sponsor_type: data.type,
                relationship_type: 'major_donor',
                total_support: data.amount,
                cycle: currentCycle,
              });
            }
          }
          // Always delete old contributions first to prevent duplicates
          await supabase
            .from('member_contributions')
            .delete()
            .eq('member_id', member.id)
            .eq('cycle', currentCycle);

          // Insert contributions if we have them
          if (allContributions.length > 0) {
            await supabase
              .from('member_contributions')
              .insert(allContributions);
            
            console.log(`Inserted ${allContributions.length} contributions for ${member.full_name}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        // Fetch totals for additional sponsor/lobbying data
        const totalsUrl = `${FEC_API_BASE}/candidate/${candidateId}/totals/?api_key=${FEC_API_KEY}&cycle=${currentCycle}`;
        const totalsResponse = await fetch(totalsUrl);

        if (totalsResponse.ok) {
          const totalsData = await totalsResponse.json();
          const totals = totalsData.results?.[0];

          if (totals) {
            // Add PAC total as sponsor if not already captured in detail
            const pacAmount = totals.other_political_committee_contributions || 0;
            const existingPacTotal = sponsors
              .filter(s => s.sponsor_type === 'pac')
              .reduce((sum, s) => sum + s.total_support, 0);
            
            if (pacAmount > existingPacTotal && pacAmount > 0) {
              sponsors.push({
                member_id: member.id,
                sponsor_name: 'Other PAC Contributions',
                sponsor_type: 'pac',
                relationship_type: 'contributor',
                total_support: pacAmount - existingPacTotal,
                cycle: currentCycle,
              });
            }

            // Add party committee contributions as sponsor
            const partyAmount = totals.party_committee_contributions || 0;
            if (partyAmount > 0) {
              sponsors.push({
                member_id: member.id,
                sponsor_name: `${member.party === 'D' ? 'Democratic' : member.party === 'R' ? 'Republican' : 'Independent'} Party Committee`,
                sponsor_type: 'party',
                relationship_type: 'party_support',
                total_support: partyAmount,
                cycle: currentCycle,
              });

              // Also add to industry totals
              industryTotals.set('Party Committee Support', { 
                total: partyAmount, 
                count: 1 
              });
            }

            // Only add individual total if we got NO detailed contributions at all
            // This prevents showing generic "Individual Contributors (Total)" when we have actual donor names
            const individualAmount = totals.individual_itemized_contributions || 0;
            if (individualAmount > 0 && allContributions.length === 0) {
              // Only as fallback when FEC API didn't return any itemized contributions
              console.log(`No itemized contributions found for ${member.full_name}, adding total as fallback`);
            }
          }
        }

        // Insert sponsors
        if (sponsors.length > 0) {
          await supabase
            .from('member_sponsors')
            .delete()
            .eq('member_id', member.id)
            .eq('cycle', currentCycle);

          await supabase
            .from('member_sponsors')
            .insert(sponsors);
          
          console.log(`Inserted ${sponsors.length} sponsors for ${member.full_name}`);
        }

        // Insert industry lobbying data (aggregated by industry)
        if (industryTotals.size > 0) {
          const lobbyingRecords = Array.from(industryTotals.entries())
            .filter(([_, data]) => data.total >= 1000) // Only significant industries
            .map(([industry, data]) => ({
              member_id: member.id,
              industry: industry,
              total_spent: data.total,
              client_count: data.count,
              cycle: currentCycle,
            }));

          if (lobbyingRecords.length > 0) {
            await supabase
              .from('member_lobbying')
              .delete()
              .eq('member_id', member.id)
              .eq('cycle', currentCycle);

            await supabase
              .from('member_lobbying')
              .insert(lobbyingRecords);
            
            console.log(`Inserted ${lobbyingRecords.length} industry records for ${member.full_name}`);
          }
        }

        processedCount++;

      } catch (memberError) {
        console.error(`Error processing ${member.full_name}:`, memberError);
        errorCount++;
      }
    }

    const nextOffset = offset + members.length;
    const hasMore = nextOffset < totalMembers;

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

  // PACs and political committees
  if (emp.includes('pac') || emp.includes('committee') || emp.includes('political') || 
      emp.includes('action committee') || emp.includes('for congress') || emp.includes('for senate')) {
    return 'pac';
  }
  
  // Unions and labor organizations
  if (emp.includes('union') || emp.includes('workers') || emp.includes('labor') || 
      emp.includes('brotherhood') || emp.includes('afl-cio') || emp.includes('teamsters') ||
      emp.includes('seiu') || emp.includes('afscme')) {
    return 'union';
  }
  
  // Corporate entities
  if (emp.includes('llc') || emp.includes('inc') || emp.includes('corp') || 
      emp.includes('co.') || emp.includes('company') || emp.includes('group') ||
      emp.includes('holdings') || emp.includes('partners') || emp.includes('capital') ||
      emp.includes('associates') || emp.includes('industries')) {
    return 'corporate';
  }

  // Individual indicators
  if (emp.includes('self') || emp.includes('retired') || emp.includes('homemaker') ||
      emp.includes('not employed') || emp.includes('none') || emp === '' ||
      occ.includes('retired') || occ.includes('homemaker')) {
    return 'individual';
  }
  
  return 'individual';
}

function inferIndustry(employer: string | null, occupation: string | null): string | null {
  const combined = ((employer || '') + ' ' + (occupation || '')).toLowerCase();

  if (combined.includes('law') || combined.includes('attorney') || combined.includes('legal') || combined.includes('lawyer')) return 'Legal';
  if (combined.includes('real estate') || combined.includes('realtor') || combined.includes('property') || combined.includes('realty')) return 'Real Estate';
  if (combined.includes('health') || combined.includes('medical') || combined.includes('doctor') || combined.includes('hospital') || combined.includes('physician') || combined.includes('nurse') || combined.includes('pharma')) return 'Healthcare';
  if (combined.includes('bank') || combined.includes('financial') || combined.includes('investment') || combined.includes('insurance') || combined.includes('hedge') || combined.includes('private equity') || combined.includes('venture')) return 'Finance & Insurance';
  if (combined.includes('tech') || combined.includes('software') || combined.includes('computer') || combined.includes('engineer') || combined.includes('google') || combined.includes('microsoft') || combined.includes('apple') || combined.includes('meta') || combined.includes('amazon')) return 'Technology';
  if (combined.includes('oil') || combined.includes('gas') || combined.includes('energy') || combined.includes('utility') || combined.includes('petroleum') || combined.includes('solar') || combined.includes('renewable')) return 'Energy';
  if (combined.includes('construction') || combined.includes('builder') || combined.includes('contractor') || combined.includes('architect')) return 'Construction';
  if (combined.includes('retired')) return 'Retired';
  if (combined.includes('education') || combined.includes('teacher') || combined.includes('professor') || combined.includes('university') || combined.includes('school')) return 'Education';
  if (combined.includes('farm') || combined.includes('agri') || combined.includes('ranch') || combined.includes('cattle')) return 'Agriculture';
  if (combined.includes('media') || combined.includes('entertainment') || combined.includes('film') || combined.includes('tv') || combined.includes('broadcast') || combined.includes('news')) return 'Media & Entertainment';
  if (combined.includes('defense') || combined.includes('military') || combined.includes('aerospace') || combined.includes('lockheed') || combined.includes('boeing') || combined.includes('raytheon')) return 'Defense & Aerospace';
  if (combined.includes('telecom') || combined.includes('communications') || combined.includes('wireless') || combined.includes('verizon') || combined.includes('at&t')) return 'Telecommunications';
  if (combined.includes('retail') || combined.includes('store') || combined.includes('walmart') || combined.includes('target')) return 'Retail';
  if (combined.includes('transport') || combined.includes('logistics') || combined.includes('shipping') || combined.includes('airline') || combined.includes('trucking')) return 'Transportation';
  if (combined.includes('lobby') || combined.includes('government relations') || combined.includes('public affairs')) return 'Lobbying';
  
  return null;
}
