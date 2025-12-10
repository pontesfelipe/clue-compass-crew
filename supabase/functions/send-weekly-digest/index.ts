import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DigestRequest {
  user_email?: string; // Optional: send to specific user only (for testing)
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const { user_email } = body as DigestRequest;

    console.log("Starting weekly digest...", user_email ? `for ${user_email}` : "for all users");

    // Get users with weekly_digest enabled
    let prefsQuery = supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("weekly_digest", true)
      .eq("email_enabled", true);

    const { data: eligiblePrefs, error: prefsError } = await prefsQuery;

    if (prefsError) {
      console.error("Error fetching preferences:", prefsError);
      throw prefsError;
    }

    const userIds = eligiblePrefs?.map(p => p.user_id) || [];
    console.log(`Found ${userIds.length} users with weekly digest enabled`);

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No users with weekly digest enabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profiles for these users
    let profileQuery = supabase
      .from("profiles")
      .select("user_id, email, first_name, home_state")
      .in("user_id", userIds);

    if (user_email) {
      profileQuery = profileQuery.eq("email", user_email);
    }

    const { data: profiles, error: profileError } = await profileQuery;

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      throw profileError;
    }

    console.log(`Processing ${profiles?.length || 0} profiles`);

    let sentCount = 0;
    const errors: string[] = [];

    for (const profile of profiles || []) {
      if (!profile.email) continue;

      try {
        // Get tracked members for this user
        const { data: tracking } = await supabase
          .from("member_tracking")
          .select(`
            member_id,
            members!inner(
              id,
              full_name,
              party,
              state,
              chamber,
              image_url
            )
          `)
          .eq("user_id", profile.user_id);

        if (!tracking || tracking.length === 0) {
          console.log(`User ${profile.email} has no tracked members, skipping`);
          continue;
        }

        const memberIds = tracking.map(t => t.member_id);

        // Get recent votes for tracked members (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data: recentVotes } = await supabase
          .from("member_votes")
          .select(`
            position,
            members!inner(full_name, party),
            votes!inner(question, vote_date, result)
          `)
          .in("member_id", memberIds)
          .gte("votes.vote_date", weekAgo.toISOString().split("T")[0])
          .limit(10);

        // Get recent bills for tracked members
        const { data: recentBills } = await supabase
          .from("bill_sponsorships")
          .select(`
            is_sponsor,
            members!inner(full_name),
            bills!inner(short_title, title, bill_type, bill_number, introduced_date, policy_area)
          `)
          .in("member_id", memberIds)
          .gte("bills.introduced_date", weekAgo.toISOString().split("T")[0])
          .limit(10);

        // Get scores for tracked members
        const { data: scores } = await supabase
          .from("member_scores")
          .select("member_id, overall_score")
          .in("member_id", memberIds)
          .is("user_id", null);

        // Build email content
        const trackedMembersList = tracking.map((t: any) => {
          const member = t.members;
          const score = scores?.find((s: any) => s.member_id === t.member_id);
          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <strong>${member.full_name}</strong>
                <span style="color: ${member.party === 'D' ? '#3B82F6' : member.party === 'R' ? '#EF4444' : '#6B7280'};">(${member.party})</span>
                <br>
                <span style="color: #6b7280; font-size: 14px;">${member.state} - ${member.chamber === 'senate' ? 'Senator' : 'Representative'}</span>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                <span style="font-size: 24px; font-weight: bold; color: #3B82F6;">${score?.overall_score?.toFixed(0) || 'N/A'}</span>
              </td>
            </tr>
          `;
        }).join("");

        const votesList = recentVotes?.slice(0, 5).map((v: any) => `
          <li style="margin-bottom: 8px; color: #374151;">
            <strong>${v.members.full_name}</strong> voted <strong>${v.position}</strong> on "${v.votes.question?.substring(0, 60)}..."
            <span style="color: #6b7280;"> (${new Date(v.votes.vote_date).toLocaleDateString()})</span>
          </li>
        `).join("") || "<li style='color: #6b7280;'>No recent votes this week</li>";

        const billsList = recentBills?.slice(0, 5).map((b: any) => `
          <li style="margin-bottom: 8px; color: #374151;">
            <strong>${b.members.full_name}</strong> ${b.is_sponsor ? 'sponsored' : 'cosponsored'} 
            "${(b.bills.short_title || b.bills.title)?.substring(0, 50)}..."
            ${b.bills.policy_area ? `<span style="color: #6b7280;"> (${b.bills.policy_area})</span>` : ''}
          </li>
        `).join("") || "<li style='color: #6b7280;'>No new bills this week</li>";

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📊 CivicScore Weekly Digest</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Your personalized congressional activity summary</p>
            </div>
            
            <div style="padding: 32px 24px; background: #f9fafb;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
                Hi ${profile.first_name || "there"},<br><br>
                Here's what your tracked members of Congress have been up to this week:
              </p>
              
              <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <h2 style="padding: 16px; margin: 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; color: #111827;">
                  👥 Your Tracked Members
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f9fafb;">
                      <th style="padding: 12px; text-align: left; font-size: 14px; color: #6b7280;">Member</th>
                      <th style="padding: 12px; text-align: center; font-size: 14px; color: #6b7280;">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${trackedMembersList}
                  </tbody>
                </table>
              </div>
              
              <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <h2 style="padding: 16px; margin: 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; color: #111827;">
                  🗳️ Recent Votes
                </h2>
                <ul style="padding: 16px; margin: 0; list-style: none;">
                  ${votesList}
                </ul>
              </div>
              
              <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <h2 style="padding: 16px; margin: 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; color: #111827;">
                  📄 New Bills
                </h2>
                <ul style="padding: 16px; margin: 0; list-style: none;">
                  ${billsList}
                </ul>
              </div>
              
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://civicscore.app/tracked-members" 
                   style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
                  View Full Activity
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 12px; margin: 24px 0 0; text-align: center;">
                You're receiving this weekly digest because you enabled it in your 
                <a href="https://civicscore.app/tracked-members" style="color: #3B82F6;">notification settings</a>.
              </p>
            </div>
          </div>
        `;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "CivicScore <digest@civicscore.app>",
            to: [profile.email],
            subject: `📊 Your CivicScore Weekly Digest - ${new Date().toLocaleDateString()}`,
            html: emailHtml,
          }),
        });

        const emailResult = await emailResponse.json();
        console.log(`Weekly digest sent to ${profile.email}:`, emailResult);

        // Record sent notification
        await supabase.from("sent_notifications").insert({
          user_id: profile.user_id,
          notification_type: "weekly_digest",
          reference_id: `digest-${new Date().toISOString().split("T")[0]}`,
        });

        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send digest to ${profile.email}:`, emailError);
        errors.push(profile.email);
      }
    }

    console.log(`Weekly digest complete: ${sentCount} sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ sent: sentCount, errors: errors.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-weekly-digest:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
