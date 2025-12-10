export interface Issue {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  icon_name: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface IssueQuestion {
  id: string;
  issue_id: string;
  question_text: string;
  dimension: string | null;
  is_active: boolean;
  weight: number;
  sort_order: number;
}

export interface UserIssuePriority {
  id: string;
  user_id: string;
  issue_id: string;
  priority_level: number;
}

export interface UserAnswer {
  id: string;
  user_id: string;
  question_id: string;
  answer_value: number;
}

export interface PoliticianIssuePosition {
  id: string;
  politician_id: string;
  issue_id: string;
  score_value: number;
  source_version: number;
  data_points_count: number;
}

export interface UserPoliticianAlignment {
  id: string;
  user_id: string;
  politician_id: string;
  overall_alignment: number;
  breakdown: Record<string, number>;
  profile_version: number;
  last_computed_at: string;
}

export interface AlignmentProfileData {
  state: string | null;
  zip_code: string | null;
  age_range: string | null;
  profile_complete: boolean;
  priorities: UserIssuePriority[];
  answers: UserAnswer[];
}

export type AnswerValue = -2 | -1 | 0 | 1 | 2;

export const ANSWER_LABELS: Record<AnswerValue, string> = {
  [-2]: "Strongly Oppose",
  [-1]: "Somewhat Oppose",
  [0]: "Neutral / Unsure",
  [1]: "Somewhat Support",
  [2]: "Strongly Support",
};

export const AGE_RANGES = ["18-29", "30-44", "45-64", "65+"] as const;
export type AgeRange = typeof AGE_RANGES[number];
