import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get all issue signals (vote/bill mappings)
    const { data: signals, error: signalsError } = await supabase
      .from("issue_signals")
      .select("*");

    if (signalsError) throw signalsError;
    console.log(`Found ${signals?.length || 0} issue signals`);

    // Group signals by type and external_ref
    const voteSignals = signals?.filter(s => s.signal_type === "vote") || [];
    const billSignals = signals?.filter(s => s.signal_type === "bill_sponsorship") || [];

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

    const results: { politician_id: string; positions_computed: number }[] = [];

    for (const politician of politicians || []) {
      const issueScores: Record<string, { sum: number; weight: number; count: number }> = {};

      // Initialize scores for all issues
      for (const issue of issues) {
        issueScores[issue.id] = { sum: 0, weight: 0, count: 0 };
      }

      // Process vote signals
      if (voteSignals.length > 0) {
        // Get vote IDs from signals (external_ref is the vote ID)
        const voteIds = voteSignals.map(s => s.external_ref);

        // Get this politician's votes on signaled votes
        const { data: memberVotes, error: votesError } = await supabase
          .from("member_votes")
          .select("vote_id, position")
          .eq("member_id", politician.id)
          .in("vote_id", voteIds);

        if (votesError) {
          console.error(`Error fetching votes for ${politician.id}:`, votesError);
          continue;
        }

        // Calculate scores from votes
        for (const vote of memberVotes || []) {
          const relevantSignals = voteSignals.filter(s => s.external_ref === vote.vote_id);

          for (const signal of relevantSignals) {
            // Map vote position to a numeric value
            let voteValue = 0;
            if (vote.position === "yea") voteValue = 1;
            else if (vote.position === "nay") voteValue = -1;
            // present/not_voting = 0

            // Apply signal direction: positive direction means yea aligns with progressive
            const contribution = voteValue * signal.direction * signal.weight;

            issueScores[signal.issue_id].sum += contribution;
            issueScores[signal.issue_id].weight += signal.weight;
            issueScores[signal.issue_id].count += 1;
          }
        }
      }

      // Process bill sponsorship signals
      if (billSignals.length > 0) {
        const billIds = billSignals.map(s => s.external_ref);

        // Get this politician's sponsorships
        const { data: sponsorships, error: sponsorError } = await supabase
          .from("bill_sponsorships")
          .select("bill_id, is_sponsor")
          .eq("member_id", politician.id)
          .in("bill_id", billIds);

        if (sponsorError) {
          console.error(`Error fetching sponsorships for ${politician.id}:`, sponsorError);
          continue;
        }

        // Calculate scores from sponsorships
        for (const sponsorship of sponsorships || []) {
          const relevantSignals = billSignals.filter(s => s.external_ref === sponsorship.bill_id);

          for (const signal of relevantSignals) {
            // Sponsoring = strongly aligned, co-sponsoring = moderately aligned
            const sponsorWeight = sponsorship.is_sponsor ? 1.5 : 1.0;
            const contribution = signal.direction * signal.weight * sponsorWeight;

            issueScores[signal.issue_id].sum += contribution;
            issueScores[signal.issue_id].weight += signal.weight * sponsorWeight;
            issueScores[signal.issue_id].count += 1;
          }
        }
      }

      // Calculate final scores and upsert positions
      let positionsComputed = 0;

      for (const issue of issues) {
        const scores = issueScores[issue.id];

        if (scores.count === 0) continue;

        // Normalize score to [-2, 2] range (matching user answer scale)
        // sum/weight gives us average in [-1, 1], multiply by 2 for [-2, 2]
        const normalizedScore = scores.weight > 0 
          ? (scores.sum / scores.weight) * 2 
          : 0;

        // Clamp to valid range
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
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
