/**
 * Finance-related domain types for campaign contributions, lobbying, and sponsors
 */

export interface Contribution {
  id: string;
  memberId: string;
  contributorName: string;
  contributorType: "individual" | "pac" | "organization" | "corporate" | "union";
  amount: number;
  cycle: number;
  industry: string | null;
  contributorState: string | null;
  contributorEmployer: string | null;
  contributorOccupation: string | null;
  entityType: string | null;
  entityTypeDesc: string | null;
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
  sponsorType: "pac" | "corporate" | "union" | "party" | "trade_association" | "corporation" | "nonprofit";
  relationshipType: "major_donor" | "contributor" | "party_support" | "donor" | "pac_support" | "endorsement";
  totalSupport: number;
  cycle: number;
}

export interface ContributionCompleteness {
  cycle: number;
  fetched: number;
  total: number | null;
}

export interface MemberFinance {
  contributions: Contribution[];
  lobbying: Lobbying[];
  sponsors: Sponsor[];
  totalContributions: number;
  totalLobbying: number;
  topIndustries: { industry: string; amount: number }[];
  contributionCompleteness: ContributionCompleteness[];
}

export const contributorTypeLabels: Record<Contribution["contributorType"], string> = {
  individual: "Individual",
  pac: "PAC",
  organization: "Organization",
  corporate: "Corporate",
  union: "Union",
};

export const sponsorTypeLabels: Record<Sponsor["sponsorType"], string> = {
  pac: "PAC",
  corporate: "Corporate",
  union: "Union",
  party: "Party Committee",
  trade_association: "PAC/Trade Association",
  corporation: "Corporate",
  nonprofit: "Party/Nonprofit",
};

export const relationshipTypeLabels: Record<Sponsor["relationshipType"], string> = {
  major_donor: "Major Donor",
  contributor: "Contributor",
  party_support: "Party Support",
  donor: "Donor",
  pac_support: "PAC Support",
  endorsement: "Endorsement",
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
