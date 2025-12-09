/**
 * Scoring Engine
 * Pure functions for calculating member scores
 * IMPORTANT: Keep this file pure (no network calls or side effects)
 */

import type { 
  MemberScores, 
  Score, 
  ScoreBreakdown, 
  ScoringConfig,
  VotePosition
} from "@/types/domain";
import { DEFAULT_SCORING_CONFIG } from "@/types/domain";

export interface VoteForScoring {
  position: VotePosition;
  date: string;
  billId?: string | null;
  issueArea?: string | null;
}

/**
 * Compute recency weight using exponential decay
 * More recent votes have higher weight
 */
function computeRecencyWeight(voteDate: string, halfLifeDays: number = 180): number {
  const voteTime = new Date(voteDate).getTime();
  const now = Date.now();
  const diffDays = (now - voteTime) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, diffDays / halfLifeDays);
}

/**
 * Calculate score from raw vote data
 * This is used when computing scores from vote records directly
 */
export function computeScoreFromVotes(
  votes: VoteForScoring[],
  config: Partial<ScoringConfig> = {}
): Score {
  const fullConfig = { ...DEFAULT_SCORING_CONFIG, ...config };
  
  if (!votes.length) {
    return {
      memberId: "",
      score: 0,
      breakdown: {
        productivity: 0,
        attendance: 0,
        bipartisanship: 0,
        issueAlignment: 0,
      },
    };
  }

  let voteCount = 0;
  let notVotingCount = 0;
  let priorityIssueVotes = 0;
  let priorityIssueYea = 0;

  for (const vote of votes) {
    const recencyWeight = computeRecencyWeight(vote.date);
    
    switch (vote.position) {
      case "yea":
      case "nay":
      case "present":
        voteCount++;
        break;
      case "not_voting":
        notVotingCount++;
        break;
    }

    // Track issue alignment
    if (vote.issueArea && fullConfig.priorityIssues.includes(vote.issueArea)) {
      priorityIssueVotes++;
      if (vote.position === "yea") {
        priorityIssueYea += recencyWeight;
      }
    }
  }

  const totalVotes = voteCount + notVotingCount;
  
  // Calculate attendance (transparency) score
  const attendanceScore = totalVotes > 0 
    ? Math.round((voteCount / totalVotes) * 100)
    : 0;

  // Issue alignment score
  const issueAlignmentScore = priorityIssueVotes > 0
    ? Math.round((priorityIssueYea / priorityIssueVotes) * 100)
    : 50; // Default to neutral if no priority issue votes

  const breakdown: ScoreBreakdown = {
    productivity: 50, // Placeholder: requires bill sponsorship data
    attendance: attendanceScore,
    bipartisanship: 50, // Placeholder: requires cross-party voting analysis
    issueAlignment: issueAlignmentScore,
  };

  // Compute weighted overall score
  const overallScore = Math.round(
    breakdown.productivity * fullConfig.productivityWeight +
    breakdown.attendance * fullConfig.attendanceWeight +
    breakdown.bipartisanship * fullConfig.bipartisanshipWeight +
    breakdown.issueAlignment * fullConfig.issueAlignmentWeight
  );

  return {
    memberId: "",
    score: Math.max(0, Math.min(100, overallScore)),
    breakdown,
  };
}

/**
 * Calculate overall score from pre-computed component scores
 * This is used when we already have individual score components from the database
 */
export function computeOverallScore(
  scores: MemberScores,
  config: Partial<ScoringConfig> = {}
): number {
  const fullConfig = { ...DEFAULT_SCORING_CONFIG, ...config };
  
  const weightedScore = 
    scores.productivityScore * fullConfig.productivityWeight +
    scores.attendanceScore * fullConfig.attendanceWeight +
    scores.bipartisanshipScore * fullConfig.bipartisanshipWeight +
    scores.issueAlignmentScore * fullConfig.issueAlignmentWeight;

  return Math.round(Math.max(0, Math.min(100, weightedScore)));
}

/**
 * Calculate productivity score based on legislative activity
 */
export function computeProductivityScore(
  billsSponsored: number,
  billsCosponsored: number,
  billsEnacted: number,
  chamberAverages?: { sponsored: number; cosponsored: number; enacted: number }
): number {
  // Default chamber averages (can be replaced with actual data)
  const averages = chamberAverages ?? {
    sponsored: 5,
    cosponsored: 50,
    enacted: 0.5,
  };

  // Weight enacted bills highest
  const sponsorRatio = Math.min(2, billsSponsored / averages.sponsored);
  const cosponsorRatio = Math.min(2, billsCosponsored / averages.cosponsored);
  const enactedRatio = billsEnacted > 0 ? Math.min(3, billsEnacted / averages.enacted) : 0;

  // Weighted combination
  const rawScore = (sponsorRatio * 30 + cosponsorRatio * 20 + enactedRatio * 50);
  return Math.round(Math.min(100, rawScore));
}

/**
 * Calculate attendance score based on voting participation
 */
export function computeAttendanceScore(votesCast: number, votesMissed: number): number {
  const totalVotes = votesCast + votesMissed;
  if (totalVotes === 0) return 0;
  return Math.round((votesCast / totalVotes) * 100);
}

/**
 * Calculate bipartisanship score based on cross-party collaboration
 */
export function computeBipartisanshipScore(
  bipartisanBills: number,
  totalBillsSponsored: number
): number {
  if (totalBillsSponsored === 0) return 50; // Neutral if no bills
  
  // Ratio of bipartisan to total bills, scaled to 0-100
  const ratio = bipartisanBills / totalBillsSponsored;
  return Math.round(Math.min(100, ratio * 100 + 30)); // Base of 30 + up to 70 bonus
}

/**
 * Get score level classification
 */
export function getScoreLevel(score: number): "excellent" | "good" | "average" | "poor" | "bad" {
  if (score >= 80) return "excellent";
  if (score >= 70) return "good";
  if (score >= 60) return "average";
  if (score >= 50) return "poor";
  return "bad";
}

/**
 * Get score color class based on score value
 */
export function getScoreColorClass(score: number): string {
  const level = getScoreLevel(score);
  return `score-${level}`;
}

/**
 * Get score color as HSL string
 */
export function getScoreColor(score: number): string {
  const level = getScoreLevel(score);
  return `hsl(var(--score-${level}))`;
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return Math.round(score).toString();
}

/**
 * Get human-readable score description
 */
export function getScoreDescription(score: number): string {
  if (score >= 80) return "Excellent performer with high activity and bipartisan engagement";
  if (score >= 70) return "Strong performer with good legislative engagement";
  if (score >= 60) return "Moderate performer with average legislative activity";
  if (score >= 50) return "Below average with room for improvement";
  return "Low engagement with legislative activities";
}
