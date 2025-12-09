import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_API_KEY = Deno.env.get('CONGRESS_GOV_API_KEY');
const CONGRESS_API_BASE = "https://api.congress.gov/v3";
const CURRENT_CONGRESS = 119;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let memberId: string | null = null;
    let syncType = 'all'; // 'committees', 'statements', or 'all'
    
    try {
      const body = await req.json();
      memberId = body.memberId || null;
      syncType = body.syncType || 'all';
    } catch {
      // No body provided
    }

    console.log(`Starting member details sync (memberId: ${memberId || 'all'}, type: ${syncType})...`);

    // Get members to sync
    let membersQuery = supabase
      .from('members')
      .select('id, bioguide_id, full_name, chamber')
      .eq('in_office', true);
    
    if (memberId) {
      membersQuery = membersQuery.eq('id', memberId);
    } else {
      membersQuery = membersQuery.limit(20);
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No members to sync',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let committeesAdded = 0;
    let statementsAdded = 0;
    let errorsCount = 0;

    for (const member of members) {
      try {
        // Sync committees
        if (syncType === 'all' || syncType === 'committees') {
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const memberUrl = `${CONGRESS_API_BASE}/member/${member.bioguide_id}?api_key=${CONGRESS_API_KEY}`;
          console.log(`Fetching details for ${member.full_name}...`);
          
          const memberResponse = await fetch(memberUrl);
          
          if (memberResponse.ok) {
            const memberData = await memberResponse.json();
            const memberInfo = memberData.member;
            
            // Extract current term's committees
            const currentTerms = memberInfo?.terms || [];
            const currentTerm = currentTerms.find((t: any) => t.congress === CURRENT_CONGRESS) || currentTerms[0];
            
            // Get committees from sponsored legislation or committee assignments
            if (memberInfo?.committeeAssignments) {
              const committees = memberInfo.committeeAssignments || [];
              
              if (committees.length > 0) {
                // Delete existing committee records for this member and congress
                await supabase
                  .from('member_committees')
                  .delete()
                  .eq('member_id', member.id)
                  .eq('congress', CURRENT_CONGRESS);
                
                const committeeRecords = committees.slice(0, 10).map((c: any, idx: number) => ({
                  member_id: member.id,
                  committee_code: c.committee?.systemCode || c.systemCode || `COMM${idx}`,
                  committee_name: c.committee?.name || c.name || 'Unknown Committee',
                  chamber: member.chamber,
                  rank: idx + 1,
                  is_chair: c.chair === true,
                  is_ranking_member: c.rankingMember === true,
                  congress: CURRENT_CONGRESS,
                }));
                
                const { error: insertError } = await supabase
                  .from('member_committees')
                  .insert(committeeRecords);
                
                if (!insertError) {
                  committeesAdded += committeeRecords.length;
                  console.log(`Added ${committeeRecords.length} committees for ${member.full_name}`);
                }
              }
            }
          }
        }

        // Sync statements/sponsored legislation as proxy for activity
        if (syncType === 'all' || syncType === 'statements') {
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const sponsoredUrl = `${CONGRESS_API_BASE}/member/${member.bioguide_id}/sponsored-legislation?api_key=${CONGRESS_API_KEY}&limit=10`;
          const sponsoredResponse = await fetch(sponsoredUrl);
          
          if (sponsoredResponse.ok) {
            const sponsoredData = await sponsoredResponse.json();
            const bills = sponsoredData.sponsoredLegislation || [];
            
            if (bills.length > 0) {
              // Delete existing statements for this member
              await supabase
                .from('member_statements')
                .delete()
                .eq('member_id', member.id);
              
              const statementRecords = bills.slice(0, 10).map((b: any) => ({
                member_id: member.id,
                title: `Sponsored: ${b.title || b.number}`,
                statement_date: b.introducedDate || new Date().toISOString().split('T')[0],
                url: b.url || null,
                statement_type: 'sponsored_bill',
                subjects: b.policyArea ? [b.policyArea.name] : null,
              }));
              
              const { error: insertError } = await supabase
                .from('member_statements')
                .insert(statementRecords);
              
              if (!insertError) {
                statementsAdded += statementRecords.length;
                console.log(`Added ${statementRecords.length} activities for ${member.full_name}`);
              }
            }
          }
        }

      } catch (memberError) {
        console.error(`Error syncing ${member.full_name}:`, memberError);
        errorsCount++;
      }
    }

    const result = {
      success: true,
      message: 'Member details sync completed',
      membersProcessed: members.length,
      committeesAdded,
      statementsAdded,
      errorsCount,
    };

    console.log('Sync complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-member-details:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
