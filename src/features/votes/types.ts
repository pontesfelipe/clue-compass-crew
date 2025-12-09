/**
 * Vote Feature Types
 */

export type { 
  Vote, 
  VoteRecord, 
  VotePosition 
} from "@/types/domain";

export interface VoteDisplayItem {
  id: string;
  voteDate: string;
  question: string | null;
  description: string | null;
  result: string | null;
  position: string;
  totalYea: number | null;
  totalNay: number | null;
  chamber: string;
  congress: number;
  rollNumber: number;
}

export const positionColors: Record<string, string> = {
  yea: "bg-score-excellent/10 text-score-excellent border-score-excellent/30",
  nay: "bg-score-bad/10 text-score-bad border-score-bad/30",
  present: "bg-score-average/10 text-score-average border-score-average/30",
  not_voting: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export const positionLabels: Record<string, string> = {
  yea: "Yea",
  nay: "Nay",
  present: "Present",
  not_voting: "Not Voting",
};
