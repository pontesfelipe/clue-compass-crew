import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function DeleteAccountDialog() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    if (confirmText !== "DELETE MY ACCOUNT") return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { selfDelete: true },
      });

      if (error) throw error;

      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });
      
      // Sign out and redirect
      await supabase.auth.signOut();
      setOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem 
          className="text-destructive focus:text-destructive cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Account
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Your Account
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are about to permanently delete your account and all associated data including:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
              <li>Your profile and preferences</li>
              <li>Tracked members and notifications</li>
              <li>Issue priorities and questionnaire answers</li>
              <li>Politician alignment scores</li>
              <li>Scoring preferences</li>
            </ul>
            <p className="font-medium text-destructive">
              This action cannot be undone.
            </p>
            <div className="pt-2">
              <p className="text-sm mb-2">Type <strong>DELETE MY ACCOUNT</strong> to confirm:</p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE MY ACCOUNT to confirm"
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
              setOpen(false);
            }} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isLoading || confirmText !== "DELETE MY ACCOUNT"}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete My Account
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
