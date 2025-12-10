import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  notification_type?: "vote" | "bill" | "score_change";
  member_id?: string;
  reference_id?: string;
  subject?: string;
  content?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Update sync progress to running
  await supabase.from("sync_progress").upsert({
    id: "notifications",
    status: "running",
    last_run_at: new Date().toISOString(),
    error_message: null,
  });

  try {
    // Check if RESEND_API_KEY is configured
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured. Please add the Resend API key in secrets.");
    }

    let body: NotificationRequest = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // No body provided, run in batch mode
    }

    const { notification_type, member_id, reference_id, subject, content } = body;

    // If specific notification params provided, send single notification
    if (notification_type && member_id && reference_id && subject && content) {
      console.log(`Processing single ${notification_type} notification for member ${member_id}`);
      const result = await sendNotificationForMember(supabase, notification_type, member_id, reference_id, subject, content);
      
      await supabase.from("sync_progress").upsert({
        id: "notifications",
        status: "complete",
        total_processed: result.sent,
        error_message: null,
      });
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch mode: Find recent votes and send notifications for tracked members
    console.log("Running in batch mode - checking for recent votes to notify about");
    
    // Get votes from the last 24 hours that haven't been notified yet
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentVotes, error: votesError } = await supabase
      .from("votes")
      .select("id, description, question, vote_date, chamber")
      .gte("vote_date", yesterday.toISOString().split("T")[0])
      .order("vote_date", { ascending: false })
      .limit(20);

    if (votesError) {
      console.error("Error fetching recent votes:", votesError);
      throw votesError;
    }

    console.log(`Found ${recentVotes?.length || 0} recent votes`);

    let totalSent = 0;
    let totalErrors = 0;

    for (const vote of recentVotes || []) {
      // Get members who voted on this
      const { data: memberVotes, error: mvError } = await supabase
        .from("member_votes")
        .select("member_id")
        .eq("vote_id", vote.id);

      if (mvError) {
        console.error(`Error fetching member votes for ${vote.id}:`, mvError);
        continue;
      }

      const memberIds = memberVotes?.map(mv => mv.member_id) || [];
      
      // For each member, check if any users are tracking them
      for (const memberId of memberIds) {
        const result = await sendNotificationForMember(
          supabase,
          "vote",
          memberId,
          vote.id,
          `New Vote: ${vote.question || vote.description || "Congressional Vote"}`,
          `<p>A member you're tracking has cast a vote.</p>
           <p><strong>Vote:</strong> ${vote.question || vote.description}</p>
           <p><strong>Date:</strong> ${vote.vote_date}</p>
           <p><strong>Chamber:</strong> ${vote.chamber}</p>
           <p><a href="https://civicscore.app/votes/${vote.id}">View vote details</a></p>`
        );
        totalSent += result.sent;
        totalErrors += result.errors;
      }
    }

    console.log(`Batch complete: ${totalSent} sent, ${totalErrors} errors`);

    await supabase.from("sync_progress").upsert({
      id: "notifications",
      status: "complete",
      total_processed: totalSent,
      error_message: totalErrors > 0 ? `${totalErrors} emails failed to send` : null,
    });

    return new Response(
      JSON.stringify({ sent: totalSent, errors: totalErrors, votes_processed: recentVotes?.length || 0 }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-member-notifications:", error);
    
    await supabase.from("sync_progress").upsert({
      id: "notifications",
      status: "error",
      error_message: (error as Error).message,
    });
    
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

async function sendNotificationForMember(
  supabase: any,
  notification_type: string,
  member_id: string,
  reference_id: string,
  subject: string,
  content: string
): Promise<{ sent: number; errors: number; already_sent?: number }> {
  // Get all users tracking this member who have appropriate notifications enabled
  const prefColumn = notification_type === "vote" 
    ? "vote_notifications" 
    : notification_type === "bill" 
      ? "bill_notifications" 
      : "score_change_notifications";

  // Get users tracking this member
  const { data: trackingUsers, error: trackingError } = await supabase
    .from("member_tracking")
    .select("user_id")
    .eq("member_id", member_id);

  if (trackingError) {
    console.error("Error fetching tracking users:", trackingError);
    throw trackingError;
  }

  if (!trackingUsers?.length) {
    return { sent: 0, errors: 0 };
  }

  const userIds = trackingUsers.map((t: any) => t.user_id);

  // Get notification preferences for these users
  const { data: preferences, error: prefError } = await supabase
    .from("notification_preferences")
    .select("user_id, email_enabled")
    .in("user_id", userIds)
    .eq("email_enabled", true)
    .eq(prefColumn, true);

  if (prefError) {
    console.error("Error fetching preferences:", prefError);
    throw prefError;
  }

  // Include users without preferences (defaults to enabled)
  const usersWithPrefs = preferences?.map((p: any) => p.user_id) || [];
  const usersWithoutPrefs = userIds.filter((id: string) => !usersWithPrefs.includes(id));
  const eligibleUserIds = [...usersWithPrefs, ...usersWithoutPrefs];

  if (!eligibleUserIds.length) {
    return { sent: 0, errors: 0 };
  }

  // Check which notifications have already been sent
  const { data: sentNotifs, error: sentError } = await supabase
    .from("sent_notifications")
    .select("user_id")
    .eq("notification_type", notification_type)
    .eq("reference_id", reference_id)
    .in("user_id", eligibleUserIds);

  if (sentError) {
    console.error("Error checking sent notifications:", sentError);
    throw sentError;
  }

  const alreadySent = sentNotifs?.map((s: any) => s.user_id) || [];
  const toNotify = eligibleUserIds.filter((id: string) => !alreadySent.includes(id));

  if (!toNotify.length) {
    return { sent: 0, errors: 0, already_sent: alreadySent.length };
  }

  // Get user emails from profiles
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, email, first_name")
    .in("user_id", toNotify);

  if (profileError) {
    console.error("Error fetching profiles:", profileError);
    throw profileError;
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const profile of profiles || []) {
    if (!profile.email) continue;

    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        },
        body: JSON.stringify({
          from: "CivicScore <notifications@civicscore.app>",
          to: [profile.email],
          subject: subject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">CivicScore</h1>
              </div>
              <div style="padding: 32px 24px; background: #f9fafb;">
                <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
                  Hi ${profile.first_name || "there"},
                </p>
                <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
                  ${content}
                </div>
                <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0;">
                  You're receiving this because you're tracking this member on CivicScore.
                  <a href="https://civicscore.app/my-profile" style="color: #3B82F6;">Manage preferences</a>
                </p>
              </div>
            </div>
          `,
        }),
      });

      const emailResult = await emailResponse.json();

      console.log(`Email sent to ${profile.email}:`, emailResult);

      // Record sent notification using service role (bypasses RLS)
      await supabase.from("sent_notifications").insert({
        user_id: profile.user_id,
        notification_type,
        reference_id,
      });

      sentCount++;
    } catch (emailError) {
      console.error(`Failed to send to ${profile.email}:`, emailError);
      errors.push(profile.email);
    }
  }

  return { sent: sentCount, errors: errors.length };
}

serve(handler);
