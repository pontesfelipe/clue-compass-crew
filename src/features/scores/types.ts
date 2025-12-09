/**
 * Score Feature Types
 * Re-exports domain types for convenience
 */

export type { 
  Score, 
  ScoreBreakdown, 
  ScoringConfig, 
  MemberScores 
} from "@/types/domain";

export { DEFAULT_SCORING_CONFIG } from "@/types/domain";

export interface ScoreCategory {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface ScoreBreakdownDisplay {
  categories: ScoreCategory[];
  overallScore: number;
}
