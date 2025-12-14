import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// State abbreviation to full name mapping
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

interface OpenStatesPerson {
  id: string;
  name: string;
  given_name?: string;
  family_name?: string;
  party: string;
  image?: string;
  email?: string;
  links?: Array<{ url: string; note?: string }>;
  sources?: Array<{ url: string }>;
  ids?: { twitter?: string; facebook?: string; instagram?: string };
  current_role?: {
    title: string;
    org_classification: string;
    district?: string;
    division_id?: string;
  };
  offices?: Array<{
    classification: string;
    address?: string;
    voice?: string;
    fax?: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting governor sync from Open States API...");

    const governors: Array<{
      name: string;
      first_name: string | null;
      last_name: string | null;
      party: string;
      state: string;
      image_url: string | null;
      email: string | null;
      website_url: string | null;
      twitter_handle: string | null;
      facebook_url: string | null;
      instagram_url: string | null;
      capitol_phone: string | null;
      capitol_address: string | null;
      openstates_id: string;
      is_current: boolean;
      raw: OpenStatesPerson;
    }> = [];

    // Fetch governors for each state
    for (const [abbr, fullName] of Object.entries(STATE_NAMES)) {
      try {
        // Open States API endpoint for people
        const url = `https://v3.openstates.org/people?jurisdiction=${abbr.toLowerCase()}&org_classification=government&per_page=100`;
        
        console.log(`Fetching officials for ${abbr}...`);
        
        const response = await fetch(url, {
          headers: {
            "X-API-Key": Deno.env.get("OPENSTATES_API_KEY") || "",
          },
        });

        if (!response.ok) {
          console.warn(`Failed to fetch ${abbr}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const people: OpenStatesPerson[] = data.results || [];

        // Find the governor
        const governor = people.find((p) => 
          p.current_role?.title?.toLowerCase().includes("governor") &&
          !p.current_role?.title?.toLowerCase().includes("lieutenant")
        );

        if (governor) {
          const website = governor.links?.find((l) => l.note?.toLowerCase() === "homepage")?.url 
            || governor.sources?.[0]?.url 
            || null;
          
          const capitolOffice = governor.offices?.find((o) => o.classification === "capitol");

          governors.push({
            name: governor.name,
            first_name: governor.given_name || null,
            last_name: governor.family_name || null,
            party: governor.party === "Democratic" ? "D" : governor.party === "Republican" ? "R" : "I",
            state: fullName,
            image_url: governor.image || null,
            email: governor.email || null,
            website_url: website,
            twitter_handle: governor.ids?.twitter || null,
            facebook_url: governor.ids?.facebook || null,
            instagram_url: governor.ids?.instagram || null,
            capitol_phone: capitolOffice?.voice || null,
            capitol_address: capitolOffice?.address || null,
            openstates_id: governor.id,
            is_current: true,
            raw: governor,
          });

          console.log(`Found governor for ${abbr}: ${governor.name}`);
        } else {
          console.warn(`No governor found for ${abbr}`);
        }

        // Rate limit: wait 200ms between requests
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error fetching ${abbr}:`, err);
      }
    }

    console.log(`Syncing ${governors.length} governors to database...`);

    // Upsert all governors
    if (governors.length > 0) {
      const { error } = await supabase
        .from("governors")
        .upsert(governors, { onConflict: "state" });

      if (error) {
        throw error;
      }
    }

    // Update sync progress
    await supabase.from("sync_progress").upsert({
      id: "governors",
      last_synced_at: new Date().toISOString(),
      total_processed: governors.length,
      status: "idle",
    }, { onConflict: "id" });

    console.log(`Governor sync complete: ${governors.length} governors synced`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: governors.length,
        governors: governors.map(g => ({ name: g.name, state: g.state, party: g.party }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Governor sync error:", error);
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
