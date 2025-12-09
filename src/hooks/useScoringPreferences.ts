import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface ScoringPreferences {
  productivityWeight: number;
  attendanceWeight: number;
  bipartisanshipWeight: number;
  issueAlignmentWeight: number;
  priorityIssues: string[];
}

const DEFAULT_PREFERENCES: ScoringPreferences = {
  productivityWeight: 25,
  attendanceWeight: 25,
  bipartisanshipWeight: 25,
  issueAlignmentWeight: 25,
  priorityIssues: [],
};

export function useScoringPreferences() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["scoring-preferences", user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_PREFERENCES;

      const { data, error } = await supabase
        .from("user_scoring_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) return DEFAULT_PREFERENCES;

      return {
        productivityWeight: Number(data.productivity_weight) || 25,
        attendanceWeight: Number(data.attendance_weight) || 25,
        bipartisanshipWeight: Number(data.bipartisanship_weight) || 25,
        issueAlignmentWeight: Number(data.issue_alignment_weight) || 25,
        priorityIssues: data.priority_issues || [],
      } as ScoringPreferences;
    },
    enabled: isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: async (newPreferences: ScoringPreferences) => {
      if (!user) throw new Error("Must be logged in");

      // Check if preferences exist
      const { data: existing } = await supabase
        .from("user_scoring_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("user_scoring_preferences")
          .update({
            productivity_weight: newPreferences.productivityWeight,
            attendance_weight: newPreferences.attendanceWeight,
            bipartisanship_weight: newPreferences.bipartisanshipWeight,
            issue_alignment_weight: newPreferences.issueAlignmentWeight,
            priority_issues: newPreferences.priorityIssues,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("user_scoring_preferences")
          .insert({
            user_id: user.id,
            productivity_weight: newPreferences.productivityWeight,
            attendance_weight: newPreferences.attendanceWeight,
            bipartisanship_weight: newPreferences.bipartisanshipWeight,
            issue_alignment_weight: newPreferences.issueAlignmentWeight,
            priority_issues: newPreferences.priorityIssues,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoring-preferences"] });
      toast({
        title: "Preferences saved",
        description: "Your scoring weights have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving preferences",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    preferences: preferences || DEFAULT_PREFERENCES,
    isLoading,
    isAuthenticated,
    updatePreferences: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
