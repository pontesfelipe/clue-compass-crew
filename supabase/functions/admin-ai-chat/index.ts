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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authentication check - verify user is logged in
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.log("Admin AI chat: No authorization header provided");
    return new Response(
      JSON.stringify({ error: "No authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create a client with the user's auth token to verify their identity
  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
  if (userError || !user) {
    console.log("Admin AI chat: Invalid or expired token", userError?.message);
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Admin role check - use service role client to check user_roles table
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: adminRole, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    console.error("Admin AI chat: Error checking admin role", roleError);
    return new Response(
      JSON.stringify({ error: "Error verifying permissions" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!adminRole) {
    console.log("Admin AI chat: User", user.id, "is not an admin");
    return new Response(
      JSON.stringify({ error: "Admin access required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Admin AI chat: Authorized admin user", user.id);

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("Admin AI chat request with", messages.length, "messages from admin", user.id);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-2025-08-07",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant for CivicScore administrators. CivicScore is a platform that tracks and scores US congressional members based on their voting patterns, bill sponsorships, attendance, and bipartisanship.

You can help with:
- Explaining scoring methodology
- Analyzing congressional voting patterns
- Providing insights about member performance
- Answering questions about the platform
- Helping with administrative tasks

Be concise, helpful, and accurate. When discussing specific data, note that you don't have direct database access but can explain concepts and methodologies.`,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      
      // Log failed AI usage with admin user ID
      await supabase.from('ai_usage_log').insert({
        operation_type: 'admin_chat',
        model: 'gpt-5-2025-08-07',
        success: false,
        error_message: `HTTP ${status}`,
        metadata: { messages_count: messages.length, admin_user_id: user.id }
      });
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await response.text();
      console.error("AI gateway error:", status, errorText);
      
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful AI usage with admin user ID
    await supabase.from('ai_usage_log').insert({
      operation_type: 'admin_chat',
      model: 'gpt-5-2025-08-07',
      success: true,
      metadata: { messages_count: messages.length, admin_user_id: user.id }
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Admin AI chat error:", error);
    
    // Log failed AI usage with admin user ID
    await supabase.from('ai_usage_log').insert({
      operation_type: 'admin_chat',
      model: 'gpt-5-2025-08-07',
      success: false,
      error_message: error instanceof Error ? error.message : "Unknown error",
      metadata: { admin_user_id: user.id }
    });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
