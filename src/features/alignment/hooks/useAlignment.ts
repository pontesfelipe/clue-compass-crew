import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserPoliticianAlignment, PoliticianIssuePosition } from "../types";

interface ComputedAlignment {
  overall_alignment: number;
  breakdown: Record<string, number>;
}

export function usePoliticianAlignment(politicianId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["alignment", "politician", user?.id, politicianId],
    queryFn: async (): Promise<ComputedAlignment | null> => {
      if (!user || !politicianId) return null;
      
      // First check for cached alignment
      const { data: cached, error: cacheError } = await supabase
        .from("user_politician_alignment")
        .select("overall_alignment, breakdown")
        .eq("user_id", user.id)
        .eq("politician_id", politicianId)
        .single();
      
      if (cached && !cacheError) {
        return {
          overall_alignment: Number(cached.overall_alignment),
          breakdown: (cached.breakdown as Record<string, number>) || {},
        };
      }
      
      // If no cached, compute alignment
      const alignment = await computeAlignment(user.id, politicianId);
      
      if (alignment) {
        // Cache the result
        await supabase.from("user_politician_alignment").upsert({
          user_id: user.id,
          politician_id: politicianId,
          overall_alignment: alignment.overall_alignment,
          breakdown: alignment.breakdown,
          profile_version: 1,
          last_computed_at: new Date().toISOString(),
        }, { onConflict: "user_id,politician_id" });
      }
      
      return alignment;
    },
    enabled: !!user && !!politicianId,
  });
}

export function useStateAlignments(stateAbbr: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["alignment", "state", user?.id, stateAbbr],
    queryFn: async () => {
      if (!user || !stateAbbr) return [];
      
      // Get members from this state
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select("id, full_name, party, chamber")
        .eq("state", stateAbbr)
        .eq("in_office", true);
      
      if (membersError) throw membersError;
      if (!members?.length) return [];
      
      // Get or compute alignments for each
      const alignments: Array<{
        politician_id: string;
        politician_name: string;
        party: string;
        chamber: string;
        overall_alignment: number | null;
      }> = [];
      
      for (const member of members) {
        const { data: cached } = await supabase
          .from("user_politician_alignment")
          .select("overall_alignment")
          .eq("user_id", user.id)
          .eq("politician_id", member.id)
          .single();
        
        if (cached) {
          alignments.push({
            politician_id: member.id,
            politician_name: member.full_name,
            party: member.party,
            chamber: member.chamber,
            overall_alignment: cached.overall_alignment,
          });
        } else {
          // Compute on demand
          const alignment = await computeAlignment(user.id, member.id);
          alignments.push({
            politician_id: member.id,
            politician_name: member.full_name,
            party: member.party,
            chamber: member.chamber,
            overall_alignment: alignment?.overall_alignment ?? null,
          });
          
          if (alignment) {
            await supabase.from("user_politician_alignment").upsert({
              user_id: user.id,
              politician_id: member.id,
              overall_alignment: alignment.overall_alignment,
              breakdown: alignment.breakdown,
              profile_version: 1,
            }, { onConflict: "user_id,politician_id" });
          }
        }
      }
      
      return alignments;
    },
    enabled: !!user && !!stateAbbr,
  });
}

async function computeAlignment(
  userId: string,
  politicianId: string
): Promise<{ overall_alignment: number; breakdown: Record<string, number> } | null> {
  // Get user priorities
  const { data: priorities, error: prioritiesError } = await supabase
    .from("user_issue_priorities")
    .select("issue_id, priority_level")
    .eq("user_id", userId);
  
  if (prioritiesError || !priorities?.length) return null;
  
  // Get user answers
  const { data: answers, error: answersError } = await supabase
    .from("user_answers")
    .select("question_id, answer_value")
    .eq("user_id", userId);
  
  if (answersError || !answers?.length) return null;
  
  // Get questions with issue mapping
  const questionIds = answers.map((a) => a.question_id);
  const { data: questions, error: questionsError } = await supabase
    .from("issue_questions")
    .select("id, issue_id, weight")
    .in("id", questionIds);
  
  if (questionsError || !questions?.length) return null;
  
  // Get issues
  const issueIds = [...new Set(questions.map((q) => q.issue_id))];
  const { data: issues, error: issuesError } = await supabase
    .from("issues")
    .select("id, slug")
    .in("id", issueIds);
  
  if (issuesError || !issues?.length) return null;
  
  // Get politician positions
  const { data: positions, error: positionsError } = await supabase
    .from("politician_issue_positions")
    .select("issue_id, score_value")
    .eq("politician_id", politicianId)
    .in("issue_id", issueIds);
  
  // Compute per-issue user scores
  const userIssueScores: Record<string, number> = {};
  
  for (const issueId of issueIds) {
    const issueQuestions = questions.filter((q) => q.issue_id === issueId);
    const issueAnswers = answers.filter((a) =>
      issueQuestions.some((q) => q.id === a.question_id)
    );
    
    if (!issueAnswers.length) continue;
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const answer of issueAnswers) {
      const question = issueQuestions.find((q) => q.id === answer.question_id);
      if (question) {
        const weight = Math.abs(question.weight);
        totalWeight += weight;
        weightedSum += answer.answer_value * (question.weight > 0 ? 1 : -1) * weight;
      }
    }
    
    if (totalWeight > 0) {
      userIssueScores[issueId] = weightedSum / totalWeight;
    }
  }
  
  // Compute alignments
  const breakdown: Record<string, number> = {};
  const priorityMap = new Map(priorities.map((p) => [p.issue_id, p.priority_level]));
  
  let totalWeight = 0;
  let weightedAlignment = 0;
  
  for (const issue of issues) {
    const userScore = userIssueScores[issue.id];
    if (userScore === undefined) continue;
    
    const position = positions?.find((p) => p.issue_id === issue.id);
    const politicianScore = position?.score_value ?? 0;
    
    // Distance in range [0, 4]
    const distance = Math.abs(userScore - politicianScore);
    const alignmentPct = Math.round(100 * (1 - distance / 4));
    
    breakdown[issue.slug] = alignmentPct;
    
    const priority = priorityMap.get(issue.id) ?? 1;
    totalWeight += priority;
    weightedAlignment += alignmentPct * priority;
  }
  
  if (totalWeight === 0) return null;
  
  const overall_alignment = Math.round(weightedAlignment / totalWeight);
  
  return { overall_alignment, breakdown };
}
