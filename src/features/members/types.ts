/**
 * Member Feature Types
 */

import type { MemberWithScore as MemberWithScoreType, Bill as BillType } from "@/types/domain";

export type { 
  Member, 
  MemberWithScore, 
  MemberScores,
  Party,
  Chamber,
  ChamberDisplay
} from "@/types/domain";

export interface MemberQueryOptions {
  chamber?: "senate" | "house";
  state?: string;
  party?: "D" | "R" | "I" | "L";
  limit?: number;
  orderBy?: "score" | "name";
}

export interface MemberDetailData {
  member: MemberWithScoreType;
  sponsoredBills: BillType[];
  cosponsoredBills: BillType[];
  voteHistory: VoteHistoryItem[];
}

export interface VoteHistoryItem {
  id: string;
  congress: number;
  chamber: string;
  rollNumber: number;
  voteDate: string;
  question: string | null;
  description: string | null;
  result: string | null;
  totalYea: number | null;
  totalNay: number | null;
  position: string;
}

export const partyColors: Record<string, string> = {
  D: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  R: "bg-civic-red/10 text-civic-red border-civic-red/30",
  I: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
  L: "bg-civic-gold/10 text-civic-gold border-civic-gold/30",
};

export const partyBgColors: Record<string, string> = {
  D: "bg-civic-blue",
  R: "bg-civic-red",
  I: "bg-civic-slate",
  L: "bg-civic-gold",
};

export const partyNames: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
  L: "Libertarian",
};
