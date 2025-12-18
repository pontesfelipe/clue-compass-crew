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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing env vars:", { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sync progress for all data sources
    const { data: syncProgress, error } = await supabase
      .from("sync_progress")
      .select("id, last_run_at, status, total_processed, updated_at");

    if (error) {
      throw error;
    }

    // Get bill classification progress by chamber
    const { data: houseBills } = await supabase
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("bill_type", "hr");
    
    const { data: senateBills } = await supabase
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("bill_type", "s");

    // Get classified bill IDs from issue_signals
    const { data: classifiedSignals } = await supabase
      .from("issue_signals")
      .select("external_ref")
      .eq("signal_type", "bill_sponsorship");

    const classifiedBillIds = new Set(classifiedSignals?.map(s => s.external_ref) || []);

    // Get bill IDs by chamber to count classified ones
    const { data: houseBillIds } = await supabase
      .from("bills")
      .select("id")
      .eq("bill_type", "hr");
    
    const { data: senateBillIds } = await supabase
      .from("bills")
      .select("id")
      .eq("bill_type", "s");

    const houseClassified = (houseBillIds || []).filter(b => classifiedBillIds.has(b.id)).length;
    const senateClassified = (senateBillIds || []).filter(b => classifiedBillIds.has(b.id)).length;

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

      // Bill classification progress by chamber
      classification: {
        house: {
          total: houseBillIds?.length || 0,
          classified: houseClassified,
        },
        senate: {
          total: senateBillIds?.length || 0,
          classified: senateClassified,
        },
      },
      
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
