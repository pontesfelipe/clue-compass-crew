// Shared state metadata used by sync-state-* functions

// 50 states + DC (no territories — OpenStates coverage there is minimal)
export const STATE_JURISDICTIONS: Array<{ abbr: string; name: string; ocd: string }> = [
  { abbr: "AL", name: "Alabama", ocd: "ocd-jurisdiction/country:us/state:al/government" },
  { abbr: "AK", name: "Alaska", ocd: "ocd-jurisdiction/country:us/state:ak/government" },
  { abbr: "AZ", name: "Arizona", ocd: "ocd-jurisdiction/country:us/state:az/government" },
  { abbr: "AR", name: "Arkansas", ocd: "ocd-jurisdiction/country:us/state:ar/government" },
  { abbr: "CA", name: "California", ocd: "ocd-jurisdiction/country:us/state:ca/government" },
  { abbr: "CO", name: "Colorado", ocd: "ocd-jurisdiction/country:us/state:co/government" },
  { abbr: "CT", name: "Connecticut", ocd: "ocd-jurisdiction/country:us/state:ct/government" },
  { abbr: "DE", name: "Delaware", ocd: "ocd-jurisdiction/country:us/state:de/government" },
  { abbr: "FL", name: "Florida", ocd: "ocd-jurisdiction/country:us/state:fl/government" },
  { abbr: "GA", name: "Georgia", ocd: "ocd-jurisdiction/country:us/state:ga/government" },
  { abbr: "HI", name: "Hawaii", ocd: "ocd-jurisdiction/country:us/state:hi/government" },
  { abbr: "ID", name: "Idaho", ocd: "ocd-jurisdiction/country:us/state:id/government" },
  { abbr: "IL", name: "Illinois", ocd: "ocd-jurisdiction/country:us/state:il/government" },
  { abbr: "IN", name: "Indiana", ocd: "ocd-jurisdiction/country:us/state:in/government" },
  { abbr: "IA", name: "Iowa", ocd: "ocd-jurisdiction/country:us/state:ia/government" },
  { abbr: "KS", name: "Kansas", ocd: "ocd-jurisdiction/country:us/state:ks/government" },
  { abbr: "KY", name: "Kentucky", ocd: "ocd-jurisdiction/country:us/state:ky/government" },
  { abbr: "LA", name: "Louisiana", ocd: "ocd-jurisdiction/country:us/state:la/government" },
  { abbr: "ME", name: "Maine", ocd: "ocd-jurisdiction/country:us/state:me/government" },
  { abbr: "MD", name: "Maryland", ocd: "ocd-jurisdiction/country:us/state:md/government" },
  { abbr: "MA", name: "Massachusetts", ocd: "ocd-jurisdiction/country:us/state:ma/government" },
  { abbr: "MI", name: "Michigan", ocd: "ocd-jurisdiction/country:us/state:mi/government" },
  { abbr: "MN", name: "Minnesota", ocd: "ocd-jurisdiction/country:us/state:mn/government" },
  { abbr: "MS", name: "Mississippi", ocd: "ocd-jurisdiction/country:us/state:ms/government" },
  { abbr: "MO", name: "Missouri", ocd: "ocd-jurisdiction/country:us/state:mo/government" },
  { abbr: "MT", name: "Montana", ocd: "ocd-jurisdiction/country:us/state:mt/government" },
  { abbr: "NE", name: "Nebraska", ocd: "ocd-jurisdiction/country:us/state:ne/government" },
  { abbr: "NV", name: "Nevada", ocd: "ocd-jurisdiction/country:us/state:nv/government" },
  { abbr: "NH", name: "New Hampshire", ocd: "ocd-jurisdiction/country:us/state:nh/government" },
  { abbr: "NJ", name: "New Jersey", ocd: "ocd-jurisdiction/country:us/state:nj/government" },
  { abbr: "NM", name: "New Mexico", ocd: "ocd-jurisdiction/country:us/state:nm/government" },
  { abbr: "NY", name: "New York", ocd: "ocd-jurisdiction/country:us/state:ny/government" },
  { abbr: "NC", name: "North Carolina", ocd: "ocd-jurisdiction/country:us/state:nc/government" },
  { abbr: "ND", name: "North Dakota", ocd: "ocd-jurisdiction/country:us/state:nd/government" },
  { abbr: "OH", name: "Ohio", ocd: "ocd-jurisdiction/country:us/state:oh/government" },
  { abbr: "OK", name: "Oklahoma", ocd: "ocd-jurisdiction/country:us/state:ok/government" },
  { abbr: "OR", name: "Oregon", ocd: "ocd-jurisdiction/country:us/state:or/government" },
  { abbr: "PA", name: "Pennsylvania", ocd: "ocd-jurisdiction/country:us/state:pa/government" },
  { abbr: "RI", name: "Rhode Island", ocd: "ocd-jurisdiction/country:us/state:ri/government" },
  { abbr: "SC", name: "South Carolina", ocd: "ocd-jurisdiction/country:us/state:sc/government" },
  { abbr: "SD", name: "South Dakota", ocd: "ocd-jurisdiction/country:us/state:sd/government" },
  { abbr: "TN", name: "Tennessee", ocd: "ocd-jurisdiction/country:us/state:tn/government" },
  { abbr: "TX", name: "Texas", ocd: "ocd-jurisdiction/country:us/state:tx/government" },
  { abbr: "UT", name: "Utah", ocd: "ocd-jurisdiction/country:us/state:ut/government" },
  { abbr: "VT", name: "Vermont", ocd: "ocd-jurisdiction/country:us/state:vt/government" },
  { abbr: "VA", name: "Virginia", ocd: "ocd-jurisdiction/country:us/state:va/government" },
  { abbr: "WA", name: "Washington", ocd: "ocd-jurisdiction/country:us/state:wa/government" },
  { abbr: "WV", name: "West Virginia", ocd: "ocd-jurisdiction/country:us/state:wv/government" },
  { abbr: "WI", name: "Wisconsin", ocd: "ocd-jurisdiction/country:us/state:wi/government" },
  { abbr: "WY", name: "Wyoming", ocd: "ocd-jurisdiction/country:us/state:wy/government" },
  { abbr: "DC", name: "District of Columbia", ocd: "ocd-jurisdiction/country:us/district:dc/government" },
];

export function jurisdictionForState(abbr: string): string | undefined {
  return STATE_JURISDICTIONS.find((s) => s.abbr === abbr.toUpperCase())?.ocd;
}

export function normalizeParty(p: string | null | undefined): "D" | "R" | "I" | "L" {
  if (!p) return "I";
  const lower = p.toLowerCase();
  if (lower.startsWith("dem")) return "D";
  if (lower.startsWith("rep")) return "R";
  if (lower.startsWith("lib")) return "L";
  return "I";
}

// OpenStates org_classification → our chamber enum (we reuse 'house'/'senate')
export function openStatesChamberToOurs(
  org: string | null | undefined
): "house" | "senate" | null {
  if (!org) return null;
  const lower = org.toLowerCase();
  if (lower === "lower" || lower === "house" || lower === "assembly") return "house";
  if (lower === "upper" || lower === "senate") return "senate";
  // Nebraska is unicameral — they call it "legislature"; treat as senate
  if (lower === "legislature") return "senate";
  return null;
}
