import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse as parseYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GitHub raw URL for committee membership data (public, no API key needed)
const COMMITTEE_MEMBERSHIP_URL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/committee-membership-current.yaml";
const COMMITTEES_URL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/committees-current.yaml";
const CURRENT_CONGRESS = 119;

interface CommitteeMember {
  name: string;
  party: string;
  rank: number;
  title?: string;
  bioguide: string;
}

interface CommitteeInfo {
  name: string;
  type: string;
  url?: string;
  thomas_id?: string;
  house_committee_id?: string;
  senate_committee_id?: string;
  jurisdiction?: string;
  subcommittees?: Array<{
    name: string;
    thomas_id?: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("Starting committee sync from unitedstates/congress-legislators...");

    // Fetch committee definitions first
    const committeesResponse = await fetch(COMMITTEES_URL);
    if (!committeesResponse.ok) {
      throw new Error(`Failed to fetch committees: ${committeesResponse.status}`);
    }
    const committeesYaml = await committeesResponse.text();
    const committeesData = parseYaml(committeesYaml) as CommitteeInfo[];
    
    // Build committee code -> name mapping
    const committeeNames: Record<string, { name: string; chamber: string }> = {};
    for (const committee of committeesData) {
      const code = committee.thomas_id || committee.house_committee_id || committee.senate_committee_id;
      if (code) {
        const chamber = code.startsWith('H') ? 'house' : 'senate';
        committeeNames[code] = { name: committee.name, chamber };
      }
    }
    console.log(`Loaded ${Object.keys(committeeNames).length} committee definitions`);

    // Fetch committee membership data
    const membershipResponse = await fetch(COMMITTEE_MEMBERSHIP_URL);
    if (!membershipResponse.ok) {
      throw new Error(`Failed to fetch committee membership: ${membershipResponse.status}`);
    }
    const membershipYaml = await membershipResponse.text();
    const membershipData = parseYaml(membershipYaml) as Record<string, CommitteeMember[]>;

    console.log(`Loaded ${Object.keys(membershipData).length} committees with members`);

    // Get all members from database for bioguide -> id mapping
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, bioguide_id, full_name')
      .eq('in_office', true);

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    const bioguideToId: Record<string, string> = {};
    for (const m of members || []) {
      bioguideToId[m.bioguide_id] = m.id;
    }
    console.log(`Mapped ${Object.keys(bioguideToId).length} member bioguide IDs`);

    // Process committee membership
    let committeesAdded = 0;
    let membersProcessed = 0;
    const errors: string[] = [];

    // Clear existing committee data for current congress
    const { error: deleteError } = await supabase
      .from('member_committees')
      .delete()
      .eq('congress', CURRENT_CONGRESS);

    if (deleteError) {
      console.error("Failed to clear existing committees:", deleteError.message);
    } else {
      console.log("Cleared existing committee assignments");
    }

    // Process each committee
    const committeeRecords: any[] = [];
    
    for (const [committeeCode, members] of Object.entries(membershipData)) {
      // Skip subcommittees for now (they have longer codes like "SSAF01")
      const isSubcommittee = committeeCode.length > 4;
      if (isSubcommittee) continue;

      const committeeInfo = committeeNames[committeeCode];
      const committeeName = committeeInfo?.name || committeeCode;
      const chamber = committeeInfo?.chamber || (committeeCode.startsWith('H') ? 'house' : 'senate');

      for (const member of members) {
        const memberId = bioguideToId[member.bioguide];
        if (!memberId) {
          // Member not in our database (might be former member)
          continue;
        }

        committeeRecords.push({
          member_id: memberId,
          committee_code: committeeCode,
          committee_name: committeeName,
          chamber: chamber,
          rank: member.rank,
          is_chair: member.title === 'Chairman' || member.title === 'Chair',
          is_ranking_member: member.title === 'Ranking Member',
          congress: CURRENT_CONGRESS,
        });
        membersProcessed++;
      }
    }

    // Batch insert committee records
    if (committeeRecords.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < committeeRecords.length; i += batchSize) {
        const batch = committeeRecords.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('member_committees')
          .insert(batch);

        if (insertError) {
          errors.push(`Batch insert error: ${insertError.message}`);
          console.error("Insert error:", insertError.message);
        } else {
          committeesAdded += batch.length;
        }
      }
    }

    // Update sync progress
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'committees',
        status: 'complete',
        current_offset: 0,
        total_processed: committeesAdded,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    const result = {
      success: true,
      message: `Committee sync completed`,
      committeesProcessed: Object.keys(membershipData).length,
      committeeAssignmentsAdded: committeesAdded,
      membersProcessed,
      errorsCount: errors.length,
      errors: errors.slice(0, 5),
    };

    console.log('Sync complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-committees:', error);

    await supabase
      .from('sync_progress')
      .upsert({
        id: 'committees',
        status: 'error',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
