import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Issue, IssueQuestion, UserIssuePriority, UserAnswer, AlignmentProfileData } from "../types";

export function useIssues() {
  return useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      
      if (error) throw error;
      return data as Issue[];
    },
  });
}

export function useIssueQuestions(issueIds: string[]) {
  return useQuery({
    queryKey: ["issue_questions", issueIds],
    queryFn: async () => {
      if (!issueIds.length) return [];
      
      const { data, error } = await supabase
        .from("issue_questions")
        .select("*")
        .in("issue_id", issueIds)
        .eq("is_active", true)
        .order("sort_order");
      
      if (error) throw error;
      return data as IssueQuestion[];
    },
    enabled: issueIds.length > 0,
  });
}

export function useAlignmentProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["alignment_profile", user?.id],
    queryFn: async (): Promise<AlignmentProfileData | null> => {
      if (!user) return null;
      
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("home_state, zip_code, age_range, profile_complete")
        .eq("user_id", user.id)
        .single();
      
      if (profileError && profileError.code !== "PGRST116") throw profileError;
      
      // Fetch priorities
      const { data: priorities, error: prioritiesError } = await supabase
        .from("user_issue_priorities")
        .select("*")
        .eq("user_id", user.id);
      
      if (prioritiesError) throw prioritiesError;
      
      // Fetch answers
      const { data: answers, error: answersError } = await supabase
        .from("user_answers")
        .select("*")
        .eq("user_id", user.id);
      
      if (answersError) throw answersError;
      
      return {
        state: profile?.home_state ?? null,
        zip_code: profile?.zip_code ?? null,
        age_range: profile?.age_range ?? null,
        profile_complete: profile?.profile_complete ?? false,
        priorities: priorities as UserIssuePriority[],
        answers: answers as UserAnswer[],
      };
    },
    enabled: !!user,
  });
}

export function useSaveBasicInfo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { state: string; zip_code?: string; age_range?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({
          home_state: data.state,
          zip_code: data.zip_code || null,
          age_range: data.age_range || null,
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alignment_profile"] });
    },
  });
}

export function useSavePriorities() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (priorities: { issue_id: string; priority_level: number }[]) => {
      if (!user) throw new Error("Not authenticated");
      
      // Delete existing priorities
      await supabase
        .from("user_issue_priorities")
        .delete()
        .eq("user_id", user.id);
      
      // Insert new priorities
      if (priorities.length > 0) {
        const { error } = await supabase
          .from("user_issue_priorities")
          .insert(
            priorities.map((p) => ({
              user_id: user.id,
              issue_id: p.issue_id,
              priority_level: p.priority_level,
            }))
          );
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alignment_profile"] });
    },
  });
}

export function useSaveAnswers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (answers: { question_id: string; answer_value: number }[]) => {
      if (!user) throw new Error("Not authenticated");
      
      // Upsert answers
      for (const answer of answers) {
        const { error } = await supabase
          .from("user_answers")
          .upsert(
            {
              user_id: user.id,
              question_id: answer.question_id,
              answer_value: answer.answer_value,
            },
            { onConflict: "user_id,question_id" }
          );
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alignment_profile"] });
    },
  });
}

export function useCompleteProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({
          profile_complete: true,
          profile_version: 1,
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      // Invalidate cached alignments
      await supabase
        .from("user_politician_alignment")
        .delete()
        .eq("user_id", user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alignment_profile"] });
      queryClient.invalidateQueries({ queryKey: ["alignment"] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Delete in order due to constraints
      await supabase.from("user_politician_alignment").delete().eq("user_id", user.id);
      await supabase.from("user_answers").delete().eq("user_id", user.id);
      await supabase.from("user_issue_priorities").delete().eq("user_id", user.id);
      
      // Reset profile fields
      const { error } = await supabase
        .from("profiles")
        .update({
          zip_code: null,
          age_range: null,
          profile_complete: false,
          profile_version: 1,
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alignment_profile"] });
      queryClient.invalidateQueries({ queryKey: ["alignment"] });
    },
  });
}
