import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteUserDialogProps {
  user: {
    id: string;
    user_id: string;
    email: string | null;
    display_name: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteUserDialog({ user, open, onOpenChange, onSuccess }: DeleteUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    if (!user || confirmText !== "DELETE") return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId: user.user_id },
      });

      if (error) throw error;

      toast({
        title: "User Deleted",
        description: "User and all associated data have been permanently deleted.",
      });
      
      setConfirmText("");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete User Permanently
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are about to permanently delete the user <strong>{user?.email}</strong> and all their associated data including:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
              <li>User profile and preferences</li>
              <li>Tracked members and notifications</li>
              <li>Issue priorities and answers</li>
              <li>Politician alignment scores</li>
              <li>Scoring preferences</li>
              <li>Terms acceptances</li>
            </ul>
            <p className="font-medium text-destructive">
              This action cannot be undone.
            </p>
            <div className="pt-2">
              <p className="text-sm mb-2">Type <strong>DELETE</strong> to confirm:</p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setConfirmText("");
              onOpenChange(false);
            }} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isLoading || confirmText !== "DELETE"}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete User
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
