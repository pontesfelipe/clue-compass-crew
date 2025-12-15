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
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("Admin AI chat request with", messages.length, "messages");

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
      
      // Log failed AI usage
      await supabase.from('ai_usage_log').insert({
        operation_type: 'admin_chat',
        model: 'gpt-5-2025-08-07',
        success: false,
        error_message: `HTTP ${status}`,
        metadata: { messages_count: messages.length }
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

    // Log successful AI usage (for streaming, we don't have token count)
    await supabase.from('ai_usage_log').insert({
      operation_type: 'admin_chat',
      model: 'gpt-5-2025-08-07',
      success: true,
      metadata: { messages_count: messages.length }
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Admin AI chat error:", error);
    
    // Log failed AI usage
    await supabase.from('ai_usage_log').insert({
      operation_type: 'admin_chat',
      model: 'gpt-5-2025-08-07',
      success: false,
      error_message: error instanceof Error ? error.message : "Unknown error"
    });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
