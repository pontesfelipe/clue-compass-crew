import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useAlignmentProfile } from "../hooks/useAlignmentProfile";
import { usePoliticianAlignment } from "../hooks/useAlignment";
import { UserCircle, TrendingUp, Info } from "lucide-react";

interface AlignmentWidgetProps {
  politicianId: string;
  politicianName: string;
}

export function AlignmentWidget({ politicianId, politicianName }: AlignmentWidgetProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useAlignmentProfile();
  const { data: alignment, isLoading: alignmentLoading } = usePoliticianAlignment(
    profile?.profile_complete ? politicianId : undefined
  );
  
  if (authLoading) {
    return <Skeleton className="h-32" />;
  }
  
  // Not logged in
  if (!isAuthenticated) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <UserCircle className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">See Your Alignment</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Log in and complete your profile to see how your views align with {politicianName}.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/auth">Log In</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  
  // Logged in but no profile
  if (profileLoading) {
    return <Skeleton className="h-32" />;
  }
  
  if (!profile?.profile_complete) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">Complete Your Profile</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Answer a few questions to see how your views align with {politicianName}.
            </p>
            <Button variant="civic" size="sm" asChild>
              <Link to="/my-profile">Build Profile</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  
  // Loading alignment
  if (alignmentLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-24" />
      </Card>
    );
  }
  
  // No alignment data
  if (!alignment) {
    return (
      <Card className="p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Not enough data to compute alignment. Try selecting different issues in your profile.
        </p>
      </Card>
    );
  }
  
  // Show alignment
  const alignmentColor = 
    alignment.overall_alignment >= 70 ? "text-green-600" :
    alignment.overall_alignment >= 40 ? "text-amber-600" :
    "text-red-600";
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          Your Alignment
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Based on comparing your issue preferences to this member's voting record and bill sponsorships.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h3>
        <span className={`text-2xl font-bold ${alignmentColor}`}>
          {alignment.overall_alignment}%
        </span>
      </div>
      
      <Progress 
        value={alignment.overall_alignment} 
        className="h-2 mb-4"
      />
      
      {/* Issue breakdown */}
      {Object.keys(alignment.breakdown).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            By Issue
          </h4>
          <div className="grid gap-2">
            {Object.entries(alignment.breakdown).map(([issueSlug, pct]) => (
              <div key={issueSlug} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground capitalize w-24 truncate">
                  {issueSlug.replace(/-/g, " ")}
                </span>
                <Progress value={pct} className="h-1.5 flex-1" />
                <span className="text-sm font-medium w-10 text-right">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-4 pt-3 border-t">
        <Button variant="ghost" size="sm" className="text-xs" asChild>
          <Link to="/my-profile">Edit Profile</Link>
        </Button>
      </div>
    </Card>
  );
}
