import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function runs the cleanup_user_activity_logs database function
// to anonymize IP addresses after 7 days and delete logs older than 90 days
// Schedule this to run daily via cron job or external scheduler

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Call the cleanup function
    const { error } = await supabaseAdmin.rpc('cleanup_user_activity_logs');

    if (error) {
      console.error("Error running cleanup:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Activity log cleanup completed successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Activity logs cleaned up: IP addresses anonymized after 7 days, logs older than 90 days deleted" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in cleanup-activity-logs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
