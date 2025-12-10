import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export function useMemberTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: trackedMembers = [], isLoading } = useQuery({
    queryKey: ["tracked-members", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("member_tracking")
        .select(`
          id,
          member_id,
          created_at,
          members (
            id,
            full_name,
            party,
            state,
            chamber,
            image_url
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const trackMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!user) throw new Error("Must be logged in to track members");

      const { error } = await supabase
        .from("member_tracking")
        .insert({ user_id: user.id, member_id: memberId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-members"] });
      toast({ title: "Member tracked", description: "You'll receive notifications about their activity." });
    },
    onError: (error: Error) => {
      toast({ title: "Error tracking member", description: error.message, variant: "destructive" });
    },
  });

  const untrackMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!user) throw new Error("Must be logged in");

      const { error } = await supabase
        .from("member_tracking")
        .delete()
        .eq("user_id", user.id)
        .eq("member_id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-members"] });
      toast({ title: "Member untracked", description: "You'll no longer receive notifications." });
    },
    onError: (error: Error) => {
      toast({ title: "Error untracking member", description: error.message, variant: "destructive" });
    },
  });

  const isTracking = (memberId: string) => {
    return trackedMembers.some((t) => t.member_id === memberId);
  };

  return {
    trackedMembers,
    isLoading,
    trackMember: trackMutation.mutate,
    untrackMember: untrackMutation.mutate,
    isTracking,
    isTrackingPending: trackMutation.isPending || untrackMutation.isPending,
  };
}
