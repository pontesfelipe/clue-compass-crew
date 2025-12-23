import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export function useBillTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: trackedBills = [], isLoading } = useQuery({
    queryKey: ["tracked-bills", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("bill_tracking")
        .select(`
          id,
          bill_id,
          created_at,
          bills (
            id,
            title,
            short_title,
            bill_type,
            bill_number,
            congress,
            policy_area,
            latest_action_date,
            latest_action_text
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const trackMutation = useMutation({
    mutationFn: async (billId: string) => {
      if (!user) throw new Error("Must be logged in to track bills");

      const { error } = await supabase
        .from("bill_tracking")
        .insert({ user_id: user.id, bill_id: billId });

      if (error) {
        if (error.code === '23505') {
          throw new Error("Already tracking this bill");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-bills"] });
      toast({ title: "Bill tracked", description: "You'll receive notifications about this bill's progress." });
    },
    onError: (error: Error) => {
      toast({ title: "Error tracking bill", description: error.message, variant: "destructive" });
    },
  });

  const untrackMutation = useMutation({
    mutationFn: async (billId: string) => {
      if (!user) throw new Error("Must be logged in");

      const { error } = await supabase
        .from("bill_tracking")
        .delete()
        .eq("user_id", user.id)
        .eq("bill_id", billId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-bills"] });
      toast({ title: "Bill untracked", description: "You'll no longer receive notifications." });
    },
    onError: (error: Error) => {
      toast({ title: "Error untracking bill", description: error.message, variant: "destructive" });
    },
  });

  const isTracking = (billId: string) => {
    return trackedBills.some((t) => t.bill_id === billId);
  };

  return {
    trackedBills,
    isLoading,
    trackBill: trackMutation.mutate,
    untrackBill: untrackMutation.mutate,
    isTracking,
    isTrackingPending: trackMutation.isPending || untrackMutation.isPending,
  };
}
