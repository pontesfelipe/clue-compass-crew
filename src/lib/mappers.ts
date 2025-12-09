/**
 * Data Mappers
 * Transform raw database/API responses to domain types
 */

import type { 
  Member, 
  MemberWithScore, 
  MemberScores, 
  Bill, 
  Vote, 
  VoteRecord,
  Chamber,
  Party,
  BillType,
  VotePosition
} from "@/types/domain";

// Type guards for database enums
function isValidParty(value: unknown): value is Party {
  return value === "D" || value === "R" || value === "I" || value === "L";
}

function isValidChamber(value: unknown): value is Chamber {
  return value === "house" || value === "senate";
}

function isValidVotePosition(value: unknown): value is VotePosition {
  return value === "yea" || value === "nay" || value === "present" || value === "not_voting";
}

function isValidBillType(value: unknown): value is BillType {
  const validTypes = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"];
  return typeof value === "string" && validTypes.includes(value);
}

/**
 * Map raw member data from Supabase to domain Member type
 */
export function mapApiMemberToMember(apiMember: Record<string, unknown>): Member {
  return {
    id: String(apiMember.id ?? ""),
    bioguideId: String(apiMember.bioguide_id ?? ""),
    firstName: String(apiMember.first_name ?? ""),
    lastName: String(apiMember.last_name ?? ""),
    fullName: String(apiMember.full_name ?? ""),
    party: isValidParty(apiMember.party) ? apiMember.party : "I",
    state: String(apiMember.state ?? ""),
    chamber: isValidChamber(apiMember.chamber) ? apiMember.chamber : "house",
    district: apiMember.district ? String(apiMember.district) : null,
    imageUrl: apiMember.image_url ? String(apiMember.image_url) : null,
    websiteUrl: apiMember.website_url ? String(apiMember.website_url) : null,
    twitterHandle: apiMember.twitter_handle ? String(apiMember.twitter_handle) : null,
    inOffice: Boolean(apiMember.in_office ?? true),
    startDate: apiMember.start_date ? String(apiMember.start_date) : null,
    endDate: apiMember.end_date ? String(apiMember.end_date) : null,
  };
}

/**
 * Map raw member scores from Supabase to domain MemberScores type
 */
export function mapApiScoresToMemberScores(apiScores: Record<string, unknown> | null): MemberScores | null {
  if (!apiScores) return null;
  
  return {
    overallScore: Number(apiScores.overall_score) || 0,
    productivityScore: Number(apiScores.productivity_score) || 0,
    attendanceScore: Number(apiScores.attendance_score) || 0,
    bipartisanshipScore: Number(apiScores.bipartisanship_score) || 0,
    issueAlignmentScore: Number(apiScores.issue_alignment_score) || 0,
    votesCast: Number(apiScores.votes_cast) || 0,
    votesMissed: Number(apiScores.votes_missed) || 0,
    billsSponsored: Number(apiScores.bills_sponsored) || 0,
    billsCosponsored: Number(apiScores.bills_cosponsored) || 0,
    billsEnacted: Number(apiScores.bills_enacted) || 0,
    bipartisanBills: Number(apiScores.bipartisan_bills) || 0,
  };
}

/**
 * Map raw member with scores to domain MemberWithScore type
 */
export function mapApiMemberWithScores(apiMember: Record<string, unknown>): MemberWithScore {
  const member = mapApiMemberToMember(apiMember);
  const memberScoresArray = apiMember.member_scores as Record<string, unknown>[] | undefined;
  const scores = memberScoresArray?.[0] ? mapApiScoresToMemberScores(memberScoresArray[0]) : null;
  
  return {
    ...member,
    score: scores?.overallScore ?? 0,
    scores,
  };
}

/**
 * Map raw bill data from Supabase to domain Bill type
 */
export function mapApiBillToBill(apiBill: Record<string, unknown>): Bill {
  return {
    id: String(apiBill.id ?? ""),
    congress: Number(apiBill.congress) || 0,
    billType: isValidBillType(apiBill.bill_type) ? apiBill.bill_type : "hr",
    billNumber: Number(apiBill.bill_number) || 0,
    title: String(apiBill.title ?? ""),
    shortTitle: apiBill.short_title ? String(apiBill.short_title) : null,
    summary: apiBill.summary ? String(apiBill.summary) : null,
    introducedDate: apiBill.introduced_date ? String(apiBill.introduced_date) : null,
    latestActionDate: apiBill.latest_action_date ? String(apiBill.latest_action_date) : null,
    latestActionText: apiBill.latest_action_text ? String(apiBill.latest_action_text) : null,
    policyArea: apiBill.policy_area ? String(apiBill.policy_area) : null,
    subjects: Array.isArray(apiBill.subjects) ? apiBill.subjects.map(String) : null,
    enacted: Boolean(apiBill.enacted ?? false),
    enactedDate: apiBill.enacted_date ? String(apiBill.enacted_date) : null,
    url: apiBill.url ? String(apiBill.url) : null,
  };
}

/**
 * Map raw vote data from Supabase to domain Vote type
 */
export function mapApiVoteToVote(apiVote: Record<string, unknown>): Vote {
  return {
    id: String(apiVote.id ?? ""),
    congress: Number(apiVote.congress) || 0,
    chamber: isValidChamber(apiVote.chamber) ? apiVote.chamber : "house",
    rollNumber: Number(apiVote.roll_number) || 0,
    voteDate: String(apiVote.vote_date ?? ""),
    question: apiVote.question ? String(apiVote.question) : null,
    description: apiVote.description ? String(apiVote.description) : null,
    result: apiVote.result ? String(apiVote.result) : null,
    totalYea: apiVote.total_yea != null ? Number(apiVote.total_yea) : null,
    totalNay: apiVote.total_nay != null ? Number(apiVote.total_nay) : null,
    totalNotVoting: apiVote.total_not_voting != null ? Number(apiVote.total_not_voting) : null,
    totalPresent: apiVote.total_present != null ? Number(apiVote.total_present) : null,
    billId: apiVote.bill_id ? String(apiVote.bill_id) : null,
  };
}

/**
 * Map raw vote record from Supabase to domain VoteRecord type
 */
export function mapApiMemberVoteToVoteRecord(apiMemberVote: Record<string, unknown>): VoteRecord {
  const votesData = apiMemberVote.votes as Record<string, unknown> | undefined;
  
  return {
    id: String(apiMemberVote.id ?? ""),
    memberId: String(apiMemberVote.member_id ?? ""),
    voteId: String(apiMemberVote.vote_id ?? ""),
    position: isValidVotePosition(apiMemberVote.position) ? apiMemberVote.position : "not_voting",
    vote: votesData ? mapApiVoteToVote(votesData) : null,
  };
}

/**
 * Convert domain Member back to display format
 */
export function getChamberDisplay(chamber: Chamber): "House" | "Senate" {
  return chamber === "senate" ? "Senate" : "House";
}

export function getPartyName(party: Party): string {
  const names: Record<Party, string> = {
    D: "Democrat",
    R: "Republican",
    I: "Independent",
    L: "Libertarian",
  };
  return names[party] || party;
}

export function formatBillNumber(bill: Bill): string {
  const typeMap: Record<BillType, string> = {
    hr: "H.R.",
    s: "S.",
    hjres: "H.J.Res.",
    sjres: "S.J.Res.",
    hconres: "H.Con.Res.",
    sconres: "S.Con.Res.",
    hres: "H.Res.",
    sres: "S.Res.",
  };
  const prefix = typeMap[bill.billType] || bill.billType.toUpperCase();
  return `${prefix}${bill.billNumber}`;
}

export function getBillStatus(bill: Bill): string {
  if (bill.enacted) return "Enacted";
  if (bill.latestActionText?.toLowerCase().includes("passed")) return "Passed";
  if (bill.latestActionText?.toLowerCase().includes("committee")) return "In Committee";
  return "Introduced";
}
