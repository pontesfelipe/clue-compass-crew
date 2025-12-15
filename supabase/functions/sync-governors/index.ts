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

// Current governors data (as of Dec 2024) - this is a fallback dataset
// Source: National Governors Association
const GOVERNORS_DATA: Array<{
  name: string;
  firstName: string;
  lastName: string;
  party: "D" | "R" | "I";
  state: string;
  termStart?: string;
  imageUrl?: string;
  websiteUrl?: string;
}> = [
  { name: "Kay Ivey", firstName: "Kay", lastName: "Ivey", party: "R", state: "Alabama", websiteUrl: "https://governor.alabama.gov" },
  { name: "Mike Dunleavy", firstName: "Mike", lastName: "Dunleavy", party: "R", state: "Alaska", websiteUrl: "https://gov.alaska.gov" },
  { name: "Katie Hobbs", firstName: "Katie", lastName: "Hobbs", party: "D", state: "Arizona", websiteUrl: "https://azgovernor.gov" },
  { name: "Sarah Huckabee Sanders", firstName: "Sarah", lastName: "Sanders", party: "R", state: "Arkansas", websiteUrl: "https://governor.arkansas.gov" },
  { name: "Gavin Newsom", firstName: "Gavin", lastName: "Newsom", party: "D", state: "California", websiteUrl: "https://www.gov.ca.gov" },
  { name: "Jared Polis", firstName: "Jared", lastName: "Polis", party: "D", state: "Colorado", websiteUrl: "https://www.colorado.gov/governor" },
  { name: "Ned Lamont", firstName: "Ned", lastName: "Lamont", party: "D", state: "Connecticut", websiteUrl: "https://portal.ct.gov/Office-of-the-Governor" },
  { name: "Matt Meyer", firstName: "Matt", lastName: "Meyer", party: "D", state: "Delaware", websiteUrl: "https://governor.delaware.gov" },
  { name: "Ron DeSantis", firstName: "Ron", lastName: "DeSantis", party: "R", state: "Florida", websiteUrl: "https://www.flgov.com" },
  { name: "Brian Kemp", firstName: "Brian", lastName: "Kemp", party: "R", state: "Georgia", websiteUrl: "https://gov.georgia.gov" },
  { name: "Josh Green", firstName: "Josh", lastName: "Green", party: "D", state: "Hawaii", websiteUrl: "https://governor.hawaii.gov" },
  { name: "Brad Little", firstName: "Brad", lastName: "Little", party: "R", state: "Idaho", websiteUrl: "https://gov.idaho.gov" },
  { name: "JB Pritzker", firstName: "JB", lastName: "Pritzker", party: "D", state: "Illinois", websiteUrl: "https://www.illinois.gov/government/governor" },
  { name: "Eric Holcomb", firstName: "Eric", lastName: "Holcomb", party: "R", state: "Indiana", websiteUrl: "https://www.in.gov/gov" },
  { name: "Kim Reynolds", firstName: "Kim", lastName: "Reynolds", party: "R", state: "Iowa", websiteUrl: "https://governor.iowa.gov" },
  { name: "Laura Kelly", firstName: "Laura", lastName: "Kelly", party: "D", state: "Kansas", websiteUrl: "https://governor.kansas.gov" },
  { name: "Andy Beshear", firstName: "Andy", lastName: "Beshear", party: "D", state: "Kentucky", websiteUrl: "https://governor.ky.gov" },
  { name: "Jeff Landry", firstName: "Jeff", lastName: "Landry", party: "R", state: "Louisiana", websiteUrl: "https://gov.louisiana.gov" },
  { name: "Janet Mills", firstName: "Janet", lastName: "Mills", party: "D", state: "Maine", websiteUrl: "https://www.maine.gov/governor" },
  { name: "Wes Moore", firstName: "Wes", lastName: "Moore", party: "D", state: "Maryland", websiteUrl: "https://governor.maryland.gov" },
  { name: "Maura Healey", firstName: "Maura", lastName: "Healey", party: "D", state: "Massachusetts", websiteUrl: "https://www.mass.gov/governor" },
  { name: "Gretchen Whitmer", firstName: "Gretchen", lastName: "Whitmer", party: "D", state: "Michigan", websiteUrl: "https://www.michigan.gov/whitmer" },
  { name: "Tim Walz", firstName: "Tim", lastName: "Walz", party: "D", state: "Minnesota", websiteUrl: "https://mn.gov/governor" },
  { name: "Tate Reeves", firstName: "Tate", lastName: "Reeves", party: "R", state: "Mississippi", websiteUrl: "https://governorreeves.ms.gov" },
  { name: "Mike Kehoe", firstName: "Mike", lastName: "Kehoe", party: "R", state: "Missouri", websiteUrl: "https://governor.mo.gov" },
  { name: "Greg Gianforte", firstName: "Greg", lastName: "Gianforte", party: "R", state: "Montana", websiteUrl: "https://governor.mt.gov" },
  { name: "Jim Pillen", firstName: "Jim", lastName: "Pillen", party: "R", state: "Nebraska", websiteUrl: "https://governor.nebraska.gov" },
  { name: "Joe Lombardo", firstName: "Joe", lastName: "Lombardo", party: "R", state: "Nevada", websiteUrl: "https://gov.nv.gov" },
  { name: "Kelly Ayotte", firstName: "Kelly", lastName: "Ayotte", party: "R", state: "New Hampshire", websiteUrl: "https://www.governor.nh.gov" },
  { name: "Phil Murphy", firstName: "Phil", lastName: "Murphy", party: "D", state: "New Jersey", websiteUrl: "https://nj.gov/governor" },
  { name: "Michelle Lujan Grisham", firstName: "Michelle", lastName: "Lujan Grisham", party: "D", state: "New Mexico", websiteUrl: "https://www.governor.state.nm.us" },
  { name: "Kathy Hochul", firstName: "Kathy", lastName: "Hochul", party: "D", state: "New York", websiteUrl: "https://www.governor.ny.gov" },
  { name: "Josh Stein", firstName: "Josh", lastName: "Stein", party: "D", state: "North Carolina", websiteUrl: "https://governor.nc.gov" },
  { name: "Kelly Armstrong", firstName: "Kelly", lastName: "Armstrong", party: "R", state: "North Dakota", websiteUrl: "https://www.governor.nd.gov" },
  { name: "Mike DeWine", firstName: "Mike", lastName: "DeWine", party: "R", state: "Ohio", websiteUrl: "https://governor.ohio.gov" },
  { name: "Kevin Stitt", firstName: "Kevin", lastName: "Stitt", party: "R", state: "Oklahoma", websiteUrl: "https://www.governor.ok.gov" },
  { name: "Tina Kotek", firstName: "Tina", lastName: "Kotek", party: "D", state: "Oregon", websiteUrl: "https://www.oregon.gov/gov" },
  { name: "Josh Shapiro", firstName: "Josh", lastName: "Shapiro", party: "D", state: "Pennsylvania", websiteUrl: "https://www.governor.pa.gov" },
  { name: "Dan McKee", firstName: "Dan", lastName: "McKee", party: "D", state: "Rhode Island", websiteUrl: "https://governor.ri.gov" },
  { name: "Henry McMaster", firstName: "Henry", lastName: "McMaster", party: "R", state: "South Carolina", websiteUrl: "https://governor.sc.gov" },
  { name: "Kristi Noem", firstName: "Kristi", lastName: "Noem", party: "R", state: "South Dakota", websiteUrl: "https://sd.gov/governor" },
  { name: "Bill Lee", firstName: "Bill", lastName: "Lee", party: "R", state: "Tennessee", websiteUrl: "https://www.tn.gov/governor" },
  { name: "Greg Abbott", firstName: "Greg", lastName: "Abbott", party: "R", state: "Texas", websiteUrl: "https://gov.texas.gov" },
  { name: "Spencer Cox", firstName: "Spencer", lastName: "Cox", party: "R", state: "Utah", websiteUrl: "https://governor.utah.gov" },
  { name: "Phil Scott", firstName: "Phil", lastName: "Scott", party: "R", state: "Vermont", websiteUrl: "https://governor.vermont.gov" },
  { name: "Glenn Youngkin", firstName: "Glenn", lastName: "Youngkin", party: "R", state: "Virginia", websiteUrl: "https://www.governor.virginia.gov" },
  { name: "Bob Ferguson", firstName: "Bob", lastName: "Ferguson", party: "D", state: "Washington", websiteUrl: "https://www.governor.wa.gov" },
  { name: "Patrick Morrisey", firstName: "Patrick", lastName: "Morrisey", party: "R", state: "West Virginia", websiteUrl: "https://governor.wv.gov" },
  { name: "Tony Evers", firstName: "Tony", lastName: "Evers", party: "D", state: "Wisconsin", websiteUrl: "https://evers.wi.gov" },
  { name: "Mark Gordon", firstName: "Mark", lastName: "Gordon", party: "R", state: "Wyoming", websiteUrl: "https://governor.wyo.gov" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting governor sync from static data...");

    const governors = GOVERNORS_DATA.map((gov) => ({
      name: gov.name,
      first_name: gov.firstName,
      last_name: gov.lastName,
      party: gov.party,
      state: gov.state,
      image_url: gov.imageUrl || null,
      website_url: gov.websiteUrl || null,
      twitter_handle: null,
      facebook_url: null,
      instagram_url: null,
      capitol_phone: null,
      capitol_address: null,
      openstates_id: null,
      is_current: true,
      email: null,
      term_start: gov.termStart || null,
      term_end: null,
    }));

    console.log(`Syncing ${governors.length} governors to database...`);

    // Upsert all governors
    const { error } = await supabase
      .from("governors")
      .upsert(governors, { onConflict: "state" });

    if (error) {
      throw error;
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
