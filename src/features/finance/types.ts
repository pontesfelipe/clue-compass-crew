/**
 * Finance-related domain types for campaign contributions, lobbying, and sponsors
 */

export interface Contribution {
  id: string;
  memberId: string;
  contributorName: string;
  contributorType: "individual" | "pac" | "organization";
  amount: number;
  cycle: number;
  industry: string | null;
}

export interface Lobbying {
  id: string;
  memberId: string;
  industry: string;
  totalSpent: number;
  clientCount: number;
  cycle: number;
}

export interface Sponsor {
  id: string;
  memberId: string;
  sponsorName: string;
  sponsorType: "corporation" | "nonprofit" | "trade_association" | "union";
  relationshipType: "donor" | "endorsement" | "pac_support";
  totalSupport: number;
  cycle: number;
}

export interface MemberFinance {
  contributions: Contribution[];
  lobbying: Lobbying[];
  sponsors: Sponsor[];
  totalContributions: number;
  totalLobbying: number;
  topIndustries: { industry: string; amount: number }[];
}

export const contributorTypeLabels: Record<Contribution["contributorType"], string> = {
  individual: "Individual",
  pac: "PAC",
  organization: "Organization",
};

export const sponsorTypeLabels: Record<Sponsor["sponsorType"], string> = {
  corporation: "Corporation",
  nonprofit: "Non-profit",
  trade_association: "Trade Association",
  union: "Union",
};

export const relationshipTypeLabels: Record<Sponsor["relationshipType"], string> = {
  donor: "Donor",
  endorsement: "Endorsement",
  pac_support: "PAC Support",
};

export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}
