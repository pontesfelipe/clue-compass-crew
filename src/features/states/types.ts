/**
 * State Feature Types
 */

export type { StateScore, StateStats } from "@/types/domain";

export const stateNames: Record<string, string> = {
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
  DC: "District of Columbia", AS: "American Samoa", GU: "Guam", MP: "Northern Mariana Islands",
  PR: "Puerto Rico", VI: "Virgin Islands"
};

// Reverse lookup: full name to abbreviation
export const stateAbbreviations: Record<string, string> = Object.entries(stateNames).reduce(
  (acc, [abbr, name]) => ({ ...acc, [name]: abbr }),
  {} as Record<string, string>
);

/**
 * Get full state name from abbreviation
 */
export function getStateName(abbr: string): string {
  return stateNames[abbr.toUpperCase()] || abbr;
}

/**
 * Get abbreviation from full state name
 */
export function getStateAbbr(name: string): string {
  return stateAbbreviations[name] || name;
}

/**
 * All US state abbreviations (50 states + DC)
 */
export const allStateAbbreviations = Object.keys(stateNames).filter(
  abbr => !["AS", "GU", "MP", "PR", "VI"].includes(abbr)
);
