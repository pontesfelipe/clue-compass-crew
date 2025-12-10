import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Leaf, HeartPulse, Globe, TrendingUp, Shield, Heart, GraduationCap, Scale } from "lucide-react";
import { Issue } from "../../types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "leaf": Leaf,
  "heart-pulse": HeartPulse,
  "globe": Globe,
  "trending-up": TrendingUp,
  "shield": Shield,
  "heart": Heart,
  "graduation-cap": GraduationCap,
  "scale": Scale,
};

interface IssueSelectionStepProps {
  issues: Issue[];
  selectedIssues: string[];
  priorities: Record<string, number>;
  onUpdate: (data: Partial<{ selectedIssues: string[]; priorities: Record<string, number> }>) => void;
}

export function IssueSelectionStep({ issues, selectedIssues, priorities, onUpdate }: IssueSelectionStepProps) {
  const toggleIssue = (issueId: string) => {
    const isSelected = selectedIssues.includes(issueId);
    
    if (isSelected) {
      onUpdate({
        selectedIssues: selectedIssues.filter((id) => id !== issueId),
      });
    } else if (selectedIssues.length < 5) {
      onUpdate({
        selectedIssues: [...selectedIssues, issueId],
        priorities: {
          ...priorities,
          [issueId]: 5 - selectedIssues.length,
        },
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
          What issues matter most to you?
        </h2>
        <p className="text-muted-foreground">
          Select 1–5 issues you care about. We'll ask you a few questions about each.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={selectedIssues.length >= 1 && selectedIssues.length <= 5 ? "default" : "secondary"}>
            {selectedIssues.length} / 5 selected
          </Badge>
        </div>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2">
        {issues.map((issue) => {
          const isSelected = selectedIssues.includes(issue.id);
          const Icon = ICON_MAP[issue.icon_name || ""] || Scale;
          const selectionOrder = selectedIssues.indexOf(issue.id);
          
          return (
            <Card
              key={issue.id}
              className={cn(
                "p-4 cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary bg-primary/5",
                !isSelected && selectedIssues.length >= 5 && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => toggleIssue(issue.id)}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{issue.label}</h3>
                    {isSelected && (
                      <Badge variant="outline" className="text-xs">
                        #{selectionOrder + 1}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {issue.description}
                  </p>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                )}
              </div>
            </Card>
          );
        })}
      </div>
      
      {selectedIssues.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Issues are weighted by selection order—first selected = most important.
        </p>
      )}
    </div>
  );
}
