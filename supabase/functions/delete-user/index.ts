import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create client with user's auth to verify permissions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, selfDelete } = await req.json();
    
    let targetUserId: string;
    
    if (selfDelete) {
      // User is deleting their own account
      targetUserId = user.id;
      console.log(`User ${user.id} is deleting their own account`);
    } else {
      // Admin is deleting another user - verify admin role
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId is required for admin deletion" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetUserId = userId;
      console.log(`Admin ${user.id} is deleting user ${targetUserId}`);
    }

    // Delete all user data in order (respecting foreign key constraints)
    console.log(`Deleting data for user ${targetUserId}...`);

    // Delete user answers
    await supabaseAdmin.from("user_answers").delete().eq("user_id", targetUserId);
    console.log("Deleted user_answers");

    // Delete user issue priorities
    await supabaseAdmin.from("user_issue_priorities").delete().eq("user_id", targetUserId);
    console.log("Deleted user_issue_priorities");

    // Delete user politician alignment
    await supabaseAdmin.from("user_politician_alignment").delete().eq("user_id", targetUserId);
    console.log("Deleted user_politician_alignment");

    // Delete member tracking
    await supabaseAdmin.from("member_tracking").delete().eq("user_id", targetUserId);
    console.log("Deleted member_tracking");

    // Delete notification preferences
    await supabaseAdmin.from("notification_preferences").delete().eq("user_id", targetUserId);
    console.log("Deleted notification_preferences");

    // Delete sent notifications
    await supabaseAdmin.from("sent_notifications").delete().eq("user_id", targetUserId);
    console.log("Deleted sent_notifications");

    // Delete user scoring preferences
    await supabaseAdmin.from("user_scoring_preferences").delete().eq("user_id", targetUserId);
    console.log("Deleted user_scoring_preferences");

    // Delete terms acceptances
    await supabaseAdmin.from("terms_acceptances").delete().eq("user_id", targetUserId);
    console.log("Deleted terms_acceptances");

    // Delete user roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
    console.log("Deleted user_roles");

    // Delete member scores for user
    await supabaseAdmin.from("member_scores").delete().eq("user_id", targetUserId);
    console.log("Deleted member_scores");

    // Delete user profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", targetUserId);
    console.log("Deleted profile");

    // Finally, delete the auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      throw deleteAuthError;
    }
    console.log("Deleted auth user");

    console.log(`Successfully deleted user ${targetUserId} and all associated data`);

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in delete-user function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
