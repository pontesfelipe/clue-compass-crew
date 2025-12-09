/**
 * Global Domain Types for CivicScore
 * These types are shared across all features
 */

export type Party = "D" | "R" | "I" | "L";
export type Chamber = "house" | "senate";
export type ChamberDisplay = "House" | "Senate";

export interface Member {
  id: string;
  bioguideId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: Party;
  state: string;
  chamber: Chamber;
  district: string | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  twitterHandle: string | null;
  inOffice: boolean;
  startDate: string | null;
  endDate: string | null;
  phone: string | null;
  officeAddress: string | null;
  officeCity: string | null;
  officeState: string | null;
  officeZip: string | null;
}

export interface MemberWithScore extends Member {
  score: number;
  scores: MemberScores | null;
}

export interface MemberScores {
  overallScore: number;
  productivityScore: number;
  attendanceScore: number;
  bipartisanshipScore: number;
  issueAlignmentScore: number;
  votesCast: number;
  votesMissed: number;
  billsSponsored: number;
  billsCosponsored: number;
  billsEnacted: number;
  bipartisanBills: number;
}

export type VotePosition = "yea" | "nay" | "present" | "not_voting";

export interface VoteRecord {
  id: string;
  memberId: string;
  voteId: string;
  position: VotePosition;
  vote: Vote | null;
}

export interface Vote {
  id: string;
  congress: number;
  chamber: Chamber;
  rollNumber: number;
  voteDate: string;
  question: string | null;
  description: string | null;
  result: string | null;
  totalYea: number | null;
  totalNay: number | null;
  totalNotVoting: number | null;
  totalPresent: number | null;
  billId: string | null;
}

export type BillType = "hr" | "s" | "hjres" | "sjres" | "hconres" | "sconres" | "hres" | "sres";

export interface Bill {
  id: string;
  congress: number;
  billType: BillType;
  billNumber: number;
  title: string;
  shortTitle: string | null;
  summary: string | null;
  introducedDate: string | null;
  latestActionDate: string | null;
  latestActionText: string | null;
  policyArea: string | null;
  subjects: string[] | null;
  enacted: boolean;
  enactedDate: string | null;
  url: string | null;
}

export interface ScoreBreakdown {
  productivity: number;
  attendance: number;
  bipartisanship: number;
  issueAlignment: number;
}

export interface Score {
  memberId: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface StateScore {
  abbr: string;
  name: string;
  score: number;
  memberCount: number;
}

export interface StateStats {
  memberCount: number;
  avgScore: number;
  totalBillsSponsored: number;
  avgAttendance: number;
  avgBipartisanship: number;
}

export interface ScoringConfig {
  productivityWeight: number;
  attendanceWeight: number;
  bipartisanshipWeight: number;
  issueAlignmentWeight: number;
  priorityIssues: string[];
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  productivityWeight: 0.25,
  attendanceWeight: 0.25,
  bipartisanshipWeight: 0.25,
  issueAlignmentWeight: 0.25,
  priorityIssues: [],
};
