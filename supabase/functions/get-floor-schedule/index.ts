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
  state?: string;
}

// Helper function to strip HTML tags from text
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")  // Remove HTML tags
    .replace(/&nbsp;/g, " ")   // Replace &nbsp;
    .replace(/&amp;/g, "&")    // Replace &amp;
    .replace(/&lt;/g, "<")     // Replace &lt;
    .replace(/&gt;/g, ">")     // Replace &gt;
    .replace(/&quot;/g, '"')   // Replace &quot;
    .replace(/&#39;/g, "'")    // Replace &#39;
    .replace(/\s+/g, " ")      // Collapse multiple spaces
    .trim();
}

// State abbreviations mapping
const STATE_ABBRS: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "District of Columbia": "DC", "Puerto Rico": "PR"
};

// Helper function to extract state from text
function extractState(text: string): string | undefined {
  if (!text) return undefined;
  const upperText = text.toUpperCase();
  
  // Check for state names
  for (const [stateName, abbr] of Object.entries(STATE_ABBRS)) {
    if (text.includes(stateName) || upperText.includes(stateName.toUpperCase())) {
      return abbr;
    }
  }
  
  // Check for state abbreviations in common patterns
  const abbrPattern = /\b([A-Z]{2})\b/g;
  const matches = text.match(abbrPattern);
  if (matches) {
    for (const match of matches) {
      if (Object.values(STATE_ABBRS).includes(match)) {
        return match;
      }
    }
  }
  
  return undefined;
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
      console.log("Fetching summaries for floor activity...");
      
      // Congress.gov doesn't have a direct floor schedule endpoint
      // We'll use summaries endpoint to get recent legislative activity
      const summariesUrl = `https://api.congress.gov/v3/summaries?api_key=${congressApiKey}&limit=10&sort=updateDate+desc`;
      const summariesRes = await fetch(summariesUrl);
      
      if (summariesRes.ok) {
        const summariesData = await summariesRes.json();
        
        if (summariesData.summaries) {
          for (const summary of summariesData.summaries.slice(0, 5)) {
            const chamber = summary.bill?.type?.startsWith("S") ? "senate" : "house";
            const cleanDescription = stripHtml(summary.text || "") || summary.bill?.title || "Legislative update";
            const truncatedDescription = cleanDescription.length > 200 
              ? cleanDescription.substring(0, 200) + "..." 
              : cleanDescription;
            
            const item: FloorItem = {
              date: summary.updateDate || new Date().toISOString(),
              chamber: chamber,
              description: truncatedDescription,
              billNumber: summary.bill ? `${summary.bill.type} ${summary.bill.number}` : undefined,
              actionType: summary.actionDesc || "Update",
              state: extractState(cleanDescription),
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
                const sectionTitle = stripHtml(section.title || "");
                const extractedState = extractState(sectionTitle);
                
                if (section.name?.toLowerCase().includes("house") && houseItems.length < 10) {
                  houseItems.push({
                    date: record.publishDate || new Date().toISOString(),
                    chamber: "house",
                    description: sectionTitle || "House Floor Activity",
                    actionType: "Congressional Record",
                    state: extractedState,
                  });
                } else if (section.name?.toLowerCase().includes("senate") && senateItems.length < 10) {
                  senateItems.push({
                    date: record.publishDate || new Date().toISOString(),
                    chamber: "senate",
                    description: sectionTitle || "Senate Floor Activity",
                    actionType: "Congressional Record",
                    state: extractedState,
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
