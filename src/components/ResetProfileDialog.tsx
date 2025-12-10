import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw } from "lucide-react";

interface ResetProfileDialogProps {
  trigger: React.ReactNode;
}

export function ResetProfileDialog({ trigger }: ResetProfileDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleReset = async () => {
    if (!user) return;

    setIsResetting(true);
    try {
      // Delete user answers (questionnaire)
      await supabase.from("user_answers").delete().eq("user_id", user.id);

      // Delete user issue priorities
      await supabase.from("user_issue_priorities").delete().eq("user_id", user.id);

      // Delete user politician alignment (matches)
      await supabase.from("user_politician_alignment").delete().eq("user_id", user.id);

      // Delete member tracking
      await supabase.from("member_tracking").delete().eq("user_id", user.id);

      // Reset scoring preferences to defaults
      await supabase
        .from("user_scoring_preferences")
        .update({
          productivity_weight: 0.25,
          attendance_weight: 0.25,
          bipartisanship_weight: 0.25,
          issue_alignment_weight: 0.25,
          priority_issues: null,
        })
        .eq("user_id", user.id);

      // Reset profile fields (but keep name/email)
      await supabase
        .from("profiles")
        .update({
          home_state: null,
          zip_code: null,
          age_range: null,
          profile_complete: false,
          profile_version: 1,
        })
        .eq("user_id", user.id);

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["alignment_profile"] });
      queryClient.invalidateQueries({ queryKey: ["top-alignments"] });
      queryClient.invalidateQueries({ queryKey: ["tracked-members"] });
      queryClient.invalidateQueries({ queryKey: ["scoring-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      toast({
        title: "Profile reset complete",
        description: "Your preferences, questionnaire, matches, and tracked members have been cleared.",
      });

      setOpen(false);
    } catch (error) {
      console.error("Error resetting profile:", error);
      toast({
        title: "Reset failed",
        description: "There was an error resetting your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-500" />
            Reset Profile Data
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>This will clear all your preference data and let you start fresh:</p>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
              <li>Questionnaire answers</li>
              <li>Issue priorities</li>
              <li>Politician alignments & matches</li>
              <li>Tracked members</li>
              <li>Scoring preferences</li>
            </ul>
            <p className="mt-3 font-medium">Your account and login will remain intact.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={isResetting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isResetting ? "Resetting..." : "Reset Profile"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
