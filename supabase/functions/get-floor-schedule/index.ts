import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FloorItem {
  date: string;
  chamber: string;
  description: string;
  billNumber?: string;
  actionType?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const congressApiKey = Deno.env.get("CONGRESS_GOV_API_KEY");
    
    if (!congressApiKey) {
      console.error("CONGRESS_GOV_API_KEY not configured");
      return new Response(
        JSON.stringify({ house: [], senate: [], error: "API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const houseItems: FloorItem[] = [];
    const senateItems: FloorItem[] = [];

    // Fetch House floor schedule from Congress.gov API
    try {
      const houseUrl = `https://api.congress.gov/v3/house-communication?api_key=${congressApiKey}&limit=20&sort=updateDate+desc`;
      console.log("Fetching House communications...");
      
      // Congress.gov doesn't have a direct floor schedule endpoint
      // We'll use summaries endpoint to get recent legislative activity
      const summariesUrl = `https://api.congress.gov/v3/summaries?api_key=${congressApiKey}&limit=10&sort=updateDate+desc`;
      const summariesRes = await fetch(summariesUrl);
      
      if (summariesRes.ok) {
        const summariesData = await summariesRes.json();
        
        if (summariesData.summaries) {
          for (const summary of summariesData.summaries.slice(0, 5)) {
            const chamber = summary.bill?.type?.startsWith("S") ? "senate" : "house";
            const item: FloorItem = {
              date: summary.updateDate || new Date().toISOString(),
              chamber: chamber,
              description: summary.text ? summary.text.substring(0, 200) + "..." : summary.bill?.title || "Legislative update",
              billNumber: summary.bill ? `${summary.bill.type} ${summary.bill.number}` : undefined,
              actionType: summary.actionDesc || "Update",
            };
            
            if (chamber === "house") {
              houseItems.push(item);
            } else {
              senateItems.push(item);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching summaries:", error);
    }

    // Fetch recent congressional records for floor activity
    try {
      const recordsUrl = `https://api.congress.gov/v3/congressional-record?api_key=${congressApiKey}&limit=10`;
      const recordsRes = await fetch(recordsUrl);
      
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        
        if (recordsData.congressionalRecord?.results) {
          for (const record of recordsData.congressionalRecord.results.slice(0, 5)) {
            if (record.sections) {
              for (const section of record.sections) {
                if (section.name?.toLowerCase().includes("house") && houseItems.length < 10) {
                  houseItems.push({
                    date: record.publishDate || new Date().toISOString(),
                    chamber: "house",
                    description: section.title || "House Floor Activity",
                    actionType: "Congressional Record",
                  });
                } else if (section.name?.toLowerCase().includes("senate") && senateItems.length < 10) {
                  senateItems.push({
                    date: record.publishDate || new Date().toISOString(),
                    chamber: "senate",
                    description: section.title || "Senate Floor Activity",
                    actionType: "Congressional Record",
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching congressional records:", error);
    }

    // If no data from API, provide placeholder info
    if (houseItems.length === 0 && senateItems.length === 0) {
      console.log("No floor schedule data available from API");
    }

    console.log(`Returning ${houseItems.length} House items and ${senateItems.length} Senate items`);

    return new Response(
      JSON.stringify({ house: houseItems, senate: senateItems }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-floor-schedule:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ house: [], senate: [], error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
