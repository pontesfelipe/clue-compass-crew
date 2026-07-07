import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { politician_id, batch_size = 50 } = await req.json().catch(() => ({}));

    console.log("Starting politician position computation...");

    // Get all active issues
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select("id, slug")
      .eq("is_active", true);

    if (issuesError) throw issuesError;
    if (!issues?.length) {
      return new Response(JSON.stringify({ message: "No active issues found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${issues.length} active issues`);

    // Get all issue signals (vote/bill mappings). Paginate — PostgREST caps at 1000.
    const signals: any[] = [];
    {
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("issue_signals")
          .select("*")
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        signals.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
    }
    console.log(`Found ${signals.length} issue signals`);

    // Group signals by type and external_ref
    const voteSignals = signals.filter((s) => s.signal_type === "vote");
    const billSignals = signals.filter((s) => s.signal_type === "bill_sponsorship");

    // Build lookup: external_ref -> signals[]
    const voteSignalsByRef = new Map<string, any[]>();
    for (const s of voteSignals) {
      const arr = voteSignalsByRef.get(s.external_ref) || [];
      arr.push(s);
      voteSignalsByRef.set(s.external_ref, arr);
    }
    const billSignalsByRef = new Map<string, any[]>();
    for (const s of billSignals) {
      const arr = billSignalsByRef.get(s.external_ref) || [];
      arr.push(s);
      billSignalsByRef.set(s.external_ref, arr);
    }
    const voteIds = Array.from(voteSignalsByRef.keys());
    const billIds = Array.from(billSignalsByRef.keys());

    // Get politicians to process
    let politiciansQuery = supabase
      .from("members")
      .select("id")
      .eq("in_office", true);

    if (politician_id) {
      politiciansQuery = politiciansQuery.eq("id", politician_id);
    }

    const { data: politicians, error: politiciansError } = await politiciansQuery.limit(batch_size);
    if (politiciansError) throw politiciansError;

    console.log(`Processing ${politicians?.length || 0} politicians`);

    const politicianIds = (politicians || []).map((p) => p.id);
    const results: { politician_id: string; positions_computed: number }[] = [];

    // Batch-fetch all member_votes and bill_sponsorships for the ENTIRE batch of
    // politicians in one query each (previously issued 2 queries PER politician).
    const votesByMember = new Map<string, Array<{ vote_id: string; position: string }>>();
    const sponsorshipsByMember = new Map<string, Array<{ bill_id: string; is_sponsor: boolean }>>();

    if (politicianIds.length > 0 && voteIds.length > 0) {
      // Chunk voteIds to keep URL length reasonable.
      const CHUNK = 200;
      for (let i = 0; i < voteIds.length; i += CHUNK) {
        const chunk = voteIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("member_votes")
          .select("member_id, vote_id, position")
          .in("member_id", politicianIds)
          .in("vote_id", chunk);
        if (error) {
          console.error("Batch member_votes fetch error:", error.message);
          continue;
        }
        for (const row of data || []) {
          const arr = votesByMember.get(row.member_id) || [];
          arr.push({ vote_id: row.vote_id, position: row.position });
          votesByMember.set(row.member_id, arr);
        }
      }
    }

    if (politicianIds.length > 0 && billIds.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < billIds.length; i += CHUNK) {
        const chunk = billIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("bill_sponsorships")
          .select("member_id, bill_id, is_sponsor")
          .in("member_id", politicianIds)
          .in("bill_id", chunk);
        if (error) {
          console.error("Batch bill_sponsorships fetch error:", error.message);
          continue;
        }
        for (const row of data || []) {
          const arr = sponsorshipsByMember.get(row.member_id) || [];
          arr.push({ bill_id: row.bill_id, is_sponsor: row.is_sponsor });
          sponsorshipsByMember.set(row.member_id, arr);
        }
      }
    }

    for (const politician of politicians || []) {
      const issueScores: Record<string, { sum: number; weight: number; count: number }> = {};
      for (const issue of issues) {
        issueScores[issue.id] = { sum: 0, weight: 0, count: 0 };
      }

      // Process this politician's votes
      const memberVotes = votesByMember.get(politician.id) || [];
      for (const vote of memberVotes) {
        const relevantSignals = voteSignalsByRef.get(vote.vote_id) || [];
        for (const signal of relevantSignals) {
          let voteValue = 0;
          if (vote.position === "yea") voteValue = 1;
          else if (vote.position === "nay") voteValue = -1;
          const contribution = voteValue * signal.direction * signal.weight;
          issueScores[signal.issue_id].sum += contribution;
          issueScores[signal.issue_id].weight += signal.weight;
          issueScores[signal.issue_id].count += 1;
        }
      }

      // Process this politician's sponsorships
      const sponsorships = sponsorshipsByMember.get(politician.id) || [];
      for (const sponsorship of sponsorships) {
        const relevantSignals = billSignalsByRef.get(sponsorship.bill_id) || [];
        for (const signal of relevantSignals) {
          const sponsorWeight = sponsorship.is_sponsor ? 1.5 : 1.0;
          const contribution = signal.direction * signal.weight * sponsorWeight;
          issueScores[signal.issue_id].sum += contribution;
          issueScores[signal.issue_id].weight += signal.weight * sponsorWeight;
          issueScores[signal.issue_id].count += 1;
        }
      }

      // Calculate final scores and upsert positions
      let positionsComputed = 0;
      for (const issue of issues) {
        const scores = issueScores[issue.id];
        if (scores.count === 0) continue;

        const normalizedScore = scores.weight > 0
          ? (scores.sum / scores.weight) * 2
          : 0;
        const clampedScore = Math.max(-2, Math.min(2, normalizedScore));

        const { error: upsertError } = await supabase
          .from("politician_issue_positions")
          .upsert({
            politician_id: politician.id,
            issue_id: issue.id,
            score_value: clampedScore,
            data_points_count: scores.count,
            source_version: 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: "politician_id,issue_id" });

        if (upsertError) {
          console.error(`Error upserting position for ${politician.id}/${issue.id}:`, upsertError);
        } else {
          positionsComputed++;
        }
      }

      results.push({ politician_id: politician.id, positions_computed: positionsComputed });
    }

    // Clear cached alignments since positions changed
    const { error: clearError } = await supabase
      .from("user_politician_alignment")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (clearError) {
      console.log("Note: Could not clear cached alignments:", clearError.message);
    }

    console.log(`Completed processing ${results.length} politicians`);

    // Get total positions for accurate progress
    const { count: totalPositions } = await supabase
      .from('politician_issue_positions')
      .select('*', { count: 'exact', head: true });

    // Update sync progress with cumulative total
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'politician-positions',
        last_run_at: new Date().toISOString(),
        status: 'complete',
        total_processed: totalPositions || 0,
        current_offset: 0,
        metadata: {
          last_batch_politicians: results.length,
        }
      }, { onConflict: 'id' });

    return new Response(
      JSON.stringify({
        success: true,
        politicians_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error computing politician positions:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    
    // Update sync progress with error status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase
      .from('sync_progress')
      .upsert({
        id: 'politician-positions',
        last_run_at: new Date().toISOString(),
        status: 'error',
        error_message: message,
      }, { onConflict: 'id' });

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
