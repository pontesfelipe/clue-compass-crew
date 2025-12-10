/**
 * @deprecated Use imports from @/features/states/hooks/useStates instead
 * This file is kept for backward compatibility during migration
 */

export { 
  useStateScores, 
  useStateMembers, 
  useStateStats, 
  usePartyScores,
  useChamberScores,
  useStateFundingScores,
  getNationalAverage,
  stateNames,
  getStateName,
  getStateAbbr
} from "@/features/states/hooks/useStates";

export type { StateFundingScore } from "@/features/states/hooks/useStates";
