import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get sync progress for all data sources
    const { data: syncProgress, error } = await supabase
      .from("sync_progress")
      .select("id, last_run_at, status, total_processed, updated_at");

    if (error) {
      throw error;
    }

    // Build response with last synced timestamps
    const syncMap = new Map(
      (syncProgress || []).map((s) => [s.id, s])
    );

    const status = {
      congress_members_last_synced_at: syncMap.get("congress-members")?.last_run_at || null,
      congress_members_status: syncMap.get("congress-members")?.status || "idle",
      
      congress_bills_last_synced_at: syncMap.get("bills")?.last_run_at || null,
      congress_bills_status: syncMap.get("bills")?.status || "idle",
      congress_bills_total: syncMap.get("bills")?.total_processed || 0,
      
      congress_votes_last_synced_at: syncMap.get("votes")?.last_run_at || null,
      congress_votes_status: syncMap.get("votes")?.status || "idle",
      congress_votes_total: syncMap.get("votes")?.total_processed || 0,
      
      fec_funding_last_synced_at: syncMap.get("fec-finance")?.last_run_at || syncMap.get("fec-funding")?.last_run_at || null,
      fec_funding_status: syncMap.get("fec-finance")?.status || syncMap.get("fec-funding")?.status || "idle",
      fec_funding_total: syncMap.get("fec-finance")?.total_processed || syncMap.get("fec-funding")?.total_processed || 0,
      
      member_scores_last_synced_at: syncMap.get("member-scores")?.last_run_at || null,
      member_scores_status: syncMap.get("member-scores")?.status || "idle",
      
      // Computed freshness metadata
      last_updated: new Date().toISOString(),
    };

    console.log("Data status requested:", status);

    return new Response(JSON.stringify(status), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Data status error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
