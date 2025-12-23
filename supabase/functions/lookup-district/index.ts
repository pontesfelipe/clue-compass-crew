import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATE_FIPS_TO_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY", "72": "PR", "78": "VI",
};

type ZippopotamResponse = {
  "post code": string;
  country: string;
  abbreviation: string;
  places: Array<{
    "place name": string;
    longitude: string;
    state: string;
    "state abbreviation": string;
    latitude: string;
  }>;
};

function pickCongressionalDistrict(geographies: Record<string, any> | undefined) {
  if (!geographies) return null;
  const key = Object.keys(geographies).find((k) => k.toLowerCase().includes("congressional") && Array.isArray(geographies[k]));
  if (!key) return null;
  const arr = geographies[key] as any[];
  if (!arr.length) return null;
  return arr[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { zipCode } = await req.json();

    if (!zipCode || String(zipCode).length < 5) {
      return new Response(JSON.stringify({ error: "Valid ZIP code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanZip = String(zipCode).replace(/\D/g, "").substring(0, 5);

    // Step 1: ZIP -> lat/lon (free, no key)
    const zipResp = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
    if (!zipResp.ok) {
      return new Response(JSON.stringify({ error: "Could not geocode ZIP" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zipData = (await zipResp.json()) as ZippopotamResponse;
    const place = zipData?.places?.[0];
    if (!place?.longitude || !place?.latitude) {
      return new Response(JSON.stringify({ error: "ZIP geocode returned no coordinates" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lon = Number(place.longitude);
    const lat = Number(place.latitude);

    // Step 2: lat/lon -> congressional district (free, no key)
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=54&format=json`;
    const censusResp = await fetch(censusUrl);

    if (!censusResp.ok) {
      return new Response(JSON.stringify({
        state: place["state abbreviation"] || null,
        district: null,
        source: "zip_centroid_only",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const censusData = await censusResp.json();
    const districtRow = pickCongressionalDistrict(censusData?.result?.geographies);

    if (!districtRow) {
      return new Response(JSON.stringify({
        state: place["state abbreviation"] || null,
        district: null,
        source: "zip_centroid_only",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stateFips = String(districtRow.STATE ?? "").padStart(2, "0");
    const state = STATE_FIPS_TO_ABBR[stateFips] || place["state abbreviation"] || null;

    const cdCode = districtRow.CD119 ?? districtRow.CD ?? districtRow.BASENAME;
    const district = cdCode !== undefined && cdCode !== null ? String(parseInt(String(cdCode), 10)) : null;

    return new Response(JSON.stringify({ state, district, source: "zippopotam+us_census" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("lookup-district error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
