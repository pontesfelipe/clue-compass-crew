import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IssueClassification {
  issue_slug: string;
  direction: number; // -1 conservative, 0 neutral, 1 progressive
  confidence: number;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batch_size = 50, force_reclassify = false, prioritize_chamber, use_policy_area_mapping = true } = await req.json().catch(() => ({}));

    console.log(`Starting AI issue classification (batch_size: ${batch_size}, prioritize: ${prioritize_chamber || 'none'})...`);

    // Get active issues for classification
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select("id, slug, label, description")
      .eq("is_active", true);

    if (issuesError) throw issuesError;
    if (!issues?.length) {
      return new Response(JSON.stringify({ message: "No active issues found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const issueMap = new Map(issues.map(i => [i.slug, i.id]));
    const issueDescriptions = issues.map(i => `- ${i.slug}: ${i.label} - ${i.description || ""}`).join("\n");

    // Get policy area mappings for quick classification
    const { data: policyMappings } = await supabase
      .from("policy_area_mappings")
      .select("policy_area, issue_id, relevance_weight");
    
    const policyAreaToIssue = new Map<string, { issue_id: string; weight: number }>();
    for (const mapping of policyMappings || []) {
      if (mapping.issue_id) {
        policyAreaToIssue.set(mapping.policy_area, { 
          issue_id: mapping.issue_id, 
          weight: mapping.relevance_weight 
        });
      }
    }
    console.log(`Loaded ${policyAreaToIssue.size} policy area mappings`);

    // Get already classified bill IDs to exclude
    const { data: existingSignals } = await supabase
      .from("issue_signals")
      .select("external_ref")
      .eq("signal_type", "bill_sponsorship");
    
    const classifiedBillIds = new Set(existingSignals?.map(s => s.external_ref) || []);

    // Get all unclassified bills, prioritizing Senate bills if requested
    let billsQuery = supabase
      .from("bills")
      .select("id, title, short_title, summary, policy_area, subjects, bill_type")
      .not("title", "is", null);

    // Prioritize Senate bills to fix gap in senator positions
    if (prioritize_chamber === 'senate') {
      billsQuery = billsQuery.eq("bill_type", "s");
    } else if (prioritize_chamber === 'house') {
      billsQuery = billsQuery.eq("bill_type", "hr");
    }

    const { data: allBills, error: billsError } = await billsQuery.limit(batch_size * 2);
    if (billsError) throw billsError;

    // Filter out already classified bills and take batch_size
    const bills = (allBills || [])
      .filter(b => !classifiedBillIds.has(b.id) || force_reclassify)
      .slice(0, batch_size);

    console.log(`Found ${allBills?.length || 0} bills, ${bills.length} unclassified`);

    console.log(`Processing ${bills?.length || 0} unclassified bills`);

    if (!bills?.length) {
      return new Response(
        JSON.stringify({ message: "No unclassified bills found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { bill_id: string; classifications: IssueClassification[]; method: string }[] = [];
    let signalsCreated = 0;
    let policyMappingUsed = 0;
    let aiClassificationUsed = 0;

    for (const bill of bills) {
      try {
        // First try to use policy area mapping for quick classification
        if (use_policy_area_mapping && bill.policy_area && policyAreaToIssue.has(bill.policy_area)) {
          const mapping = policyAreaToIssue.get(bill.policy_area)!;
          
          // Create signal from policy area mapping
          // Direction is neutral (0) for policy mappings - AI will refine later
          // For now, we'll infer direction from bill type/action if possible
          const { error: insertError } = await supabase
            .from("issue_signals")
            .upsert({
              issue_id: mapping.issue_id,
              signal_type: "bill_sponsorship",
              external_ref: bill.id,
              direction: 1, // Default to progressive direction, AI can refine
              weight: mapping.weight * 0.7, // Lower weight since it's auto-mapped
              description: `Policy area mapping: ${bill.policy_area}`,
            }, { 
              onConflict: "issue_id,signal_type,external_ref",
              ignoreDuplicates: false 
            });

          if (!insertError) {
            signalsCreated++;
            policyMappingUsed++;
            results.push({ 
              bill_id: bill.id, 
              classifications: [{ 
                issue_slug: bill.policy_area, 
                direction: 1, 
                confidence: mapping.weight * 0.7, 
                reasoning: `Auto-mapped from policy area` 
              }],
              method: 'policy_mapping'
            });
            continue; // Skip AI classification for this bill
          }
        }

        // Fall back to AI classification
        // Build bill context for AI
        const billContext = [
          `Title: ${bill.title}`,
          bill.short_title && `Short Title: ${bill.short_title}`,
          bill.summary && `Summary: ${bill.summary}`,
          bill.policy_area && `Policy Area: ${bill.policy_area}`,
          bill.subjects?.length && `Subjects: ${bill.subjects.join(", ")}`,
        ].filter(Boolean).join("\n");

        const prompt = `You are an expert political analyst classifying legislation into policy issues.

Given this bill:
${billContext}

Available issue categories:
${issueDescriptions}

Classify this bill into one or more relevant issue categories. For each classification, determine:
1. The issue_slug (must match exactly from the list above)
2. The direction: +1 if the bill generally aligns with progressive/liberal positions on this issue, -1 if it aligns with conservative positions, 0 if neutral or mixed
3. Your confidence level (0.0 to 1.0)
4. Brief reasoning (one sentence)

Only classify into issues where the bill is clearly relevant. Skip issues where it's not applicable.

Respond with a JSON array of classifications. Example:
[
  {"issue_slug": "healthcare", "direction": 1, "confidence": 0.9, "reasoning": "Expands federal healthcare coverage"},
  {"issue_slug": "economy", "direction": -1, "confidence": 0.7, "reasoning": "Reduces business regulations"}
]

If the bill doesn't clearly fit any issue, return an empty array: []`;

        // Call Lovable AI
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "user", content: prompt }
            ],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            console.log("Rate limited, stopping batch");
            break;
          }
          console.error(`AI error for bill ${bill.id}:`, await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        
        // Parse JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.log(`No valid JSON in response for bill ${bill.id}`);
          continue;
        }

        const classifications: IssueClassification[] = JSON.parse(jsonMatch[0]);
        results.push({ bill_id: bill.id, classifications, method: 'ai' });
        aiClassificationUsed++;

        // Store classifications as issue signals
        for (const classification of classifications) {
          const issueId = issueMap.get(classification.issue_slug);
          if (!issueId) {
            console.log(`Unknown issue slug: ${classification.issue_slug}`);
            continue;
          }

          // Only store high-confidence, non-neutral classifications
          // Skip direction=0 (neutral) as they don't contribute to alignment and violate DB constraint
          if (classification.confidence < 0.6) continue;
          if (classification.direction === 0) continue;

          const { error: insertError } = await supabase
            .from("issue_signals")
            .upsert({
              issue_id: issueId,
              signal_type: "bill_sponsorship",
              external_ref: bill.id,
              direction: classification.direction,
              weight: classification.confidence,
              description: `AI: ${classification.reasoning}`,
            }, { 
              onConflict: "issue_id,signal_type,external_ref",
              ignoreDuplicates: false 
            });

          if (insertError) {
            console.error(`Error inserting signal for ${bill.id}/${classification.issue_slug}:`, insertError);
          } else {
            signalsCreated++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (billError) {
        console.error(`Error processing bill ${bill.id}:`, billError);
      }
    }

    console.log(`Completed: processed ${results.length} bills, created ${signalsCreated} signals (${policyMappingUsed} from policy mapping, ${aiClassificationUsed} from AI)`);

    return new Response(
      JSON.stringify({
        success: true,
        bills_processed: results.length,
        signals_created: signalsCreated,
        policy_mapping_used: policyMappingUsed,
        ai_classification_used: aiClassificationUsed,
        results: results.slice(0, 5), // Return sample of results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in AI classification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
