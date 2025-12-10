import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Email notifications are currently disabled
  console.log("Email notifications are currently disabled");
  
  await supabase.from("sync_progress").upsert({
    id: "notifications",
    status: "complete",
    last_synced_at: new Date().toISOString(),
    last_run_at: new Date().toISOString(),
    metadata: { message: "Email notifications disabled - coming soon" },
    error_message: null,
  });

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Email notifications are currently disabled. Check tracked members page for updates.",
      sent: 0,
      errors: 0
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
};

serve(handler);
