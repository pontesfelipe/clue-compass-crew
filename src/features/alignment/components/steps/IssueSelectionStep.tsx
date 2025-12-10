import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check, Leaf, HeartPulse, Globe, TrendingUp, Shield, Heart, GraduationCap, Scale, GripVertical } from "lucide-react";
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

const PRIORITY_LABELS: Record<number, string> = {
  1: "Low priority",
  2: "Somewhat important",
  3: "Important",
  4: "Very important",
  5: "Top priority",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-muted",
  2: "bg-blue-200",
  3: "bg-blue-400",
  4: "bg-primary/70",
  5: "bg-primary",
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
      const newPriorities = { ...priorities };
      delete newPriorities[issueId];
      onUpdate({
        selectedIssues: selectedIssues.filter((id) => id !== issueId),
        priorities: newPriorities,
      });
    } else if (selectedIssues.length < 5) {
      onUpdate({
        selectedIssues: [...selectedIssues, issueId],
        priorities: {
          ...priorities,
          [issueId]: 3, // Default to "Important"
        },
      });
    }
  };
  
  const updatePriority = (issueId: string, value: number) => {
    onUpdate({
      priorities: {
        ...priorities,
        [issueId]: value,
      },
    });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
          What issues matter most to you?
        </h2>
        <p className="text-muted-foreground">
          Select 1–5 issues and set how important each is to you. This helps us weight your alignment scores.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant={selectedIssues.length >= 1 && selectedIssues.length <= 5 ? "default" : "secondary"}>
            {selectedIssues.length} / 5 selected
          </Badge>
          {selectedIssues.length === 5 && (
            <span className="text-xs text-muted-foreground">Maximum reached</span>
          )}
        </div>
      </div>
      
      {/* Issue selection grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {issues.map((issue) => {
          const isSelected = selectedIssues.includes(issue.id);
          const Icon = ICON_MAP[issue.icon_name || ""] || Scale;
          const priority = priorities[issue.id] || 3;
          
          return (
            <Card
              key={issue.id}
              className={cn(
                "overflow-hidden transition-all",
                isSelected && "ring-2 ring-primary",
                !isSelected && selectedIssues.length >= 5 && "opacity-50"
              )}
            >
              {/* Clickable header */}
              <div
                className={cn(
                  "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  isSelected && "bg-primary/5"
                )}
                onClick={() => toggleIssue(issue.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg flex-shrink-0",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{issue.label}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {issue.description}
                    </p>
                  </div>
                  {isSelected ? (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                  )}
                </div>
              </div>
              
              {/* Priority slider (shown when selected) */}
              {isSelected && (
                <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Importance to you:</span>
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs", priority >= 4 && "text-primary-foreground", PRIORITY_COLORS[priority])}
                    >
                      {PRIORITY_LABELS[priority]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <Slider
                      value={[priority]}
                      onValueChange={([value]) => updatePriority(issue.id, value)}
                      min={1}
                      max={5}
                      step={1}
                      className="flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      
      {/* Summary of selected issues */}
      {selectedIssues.length > 0 && (
        <Card className="p-4 bg-muted/30">
          <h4 className="text-sm font-medium mb-3">Your priority ranking:</h4>
          <div className="space-y-2">
            {selectedIssues
              .sort((a, b) => (priorities[b] || 0) - (priorities[a] || 0))
              .map((issueId, index) => {
                const issue = issues.find(i => i.id === issueId);
                const priority = priorities[issueId] || 3;
                if (!issue) return null;
                
                return (
                  <div key={issueId} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-4">{index + 1}.</span>
                    <span className="flex-1 font-medium">{issue.label}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            "w-2 h-2 rounded-full",
                            level <= priority ? "bg-primary" : "bg-muted"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
}
