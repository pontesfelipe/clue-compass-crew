import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserCircle, ArrowRight, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlignmentProfile } from "@/features/alignment/hooks/useAlignmentProfile";
import { useState } from "react";

export function ProfileCompletionBanner() {
  const { isAuthenticated } = useAuth();
  const { data: profile, isLoading } = useAlignmentProfile();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if not authenticated, loading, profile is complete, or dismissed
  if (!isAuthenticated || isLoading || profile?.profile_complete || dismissed) {
    return null;
  }

  return (
    <div className="relative bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-primary/20">
      <div className="civic-container py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <UserCircle className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-foreground truncate">
              <span className="font-medium">Complete your profile</span>
              <span className="hidden sm:inline text-muted-foreground"> — Get personalized alignment scores with your representatives</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="civic" size="sm" asChild>
              <Link to="/my-profile">
                Get Started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
