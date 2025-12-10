import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, MapPin, Target, MessageSquare, TrendingUp } from "lucide-react";
import { Issue, IssueQuestion, ANSWER_LABELS, AnswerValue } from "../../types";
import { stateNames } from "@/hooks/useStateData";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Somewhat",
  3: "Important",
  4: "Very Important",
  5: "Top Priority",
};

interface ReviewStepProps {
  data: {
    state: string;
    zip_code: string;
    age_range: string;
    selectedIssues: string[];
    priorities: Record<string, number>;
    answers: Record<string, number>;
  };
  issues: Issue[];
  questions: IssueQuestion[];
}

export function ReviewStep({ data, issues, questions }: ReviewStepProps) {
  const selectedIssueData = issues
    .filter((i) => data.selectedIssues.includes(i.id))
    .sort((a, b) => (data.priorities[b.id] || 0) - (data.priorities[a.id] || 0));
  
  // Calculate a preview of user's stance per issue
  const getIssueStance = (issueId: string) => {
    const issueQuestions = questions.filter((q) => q.issue_id === issueId);
    if (issueQuestions.length === 0) return null;
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const q of issueQuestions) {
      const answer = data.answers[q.id];
      if (answer !== undefined) {
        const weight = Math.abs(q.weight);
        totalWeight += weight;
        weightedSum += answer * (q.weight > 0 ? 1 : -1) * weight;
      }
    }
    
    if (totalWeight === 0) return null;
    return weightedSum / totalWeight;
  };
  
  const getStanceLabel = (score: number | null) => {
    if (score === null) return { label: "No data", color: "bg-muted" };
    if (score >= 1.5) return { label: "Strongly Progressive", color: "bg-blue-500" };
    if (score >= 0.5) return { label: "Leans Progressive", color: "bg-blue-300" };
    if (score <= -1.5) return { label: "Strongly Conservative", color: "bg-red-500" };
    if (score <= -0.5) return { label: "Leans Conservative", color: "bg-red-300" };
    return { label: "Moderate", color: "bg-purple-400" };
  };
  
  const answeredCount = Object.keys(data.answers).length;
  const totalQuestions = questions.length;
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
          Review your profile
        </h2>
        <p className="text-muted-foreground">
          Confirm your selections before we calculate your alignment scores.
        </p>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <MapPin className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="text-lg font-bold">{data.state}</div>
          <div className="text-xs text-muted-foreground">Your State</div>
        </Card>
        <Card className="p-4 text-center">
          <Target className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="text-lg font-bold">{data.selectedIssues.length}</div>
          <div className="text-xs text-muted-foreground">Issues Selected</div>
        </Card>
        <Card className="p-4 text-center">
          <MessageSquare className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="text-lg font-bold">{answeredCount}/{totalQuestions}</div>
          <div className="text-xs text-muted-foreground">Questions Answered</div>
        </Card>
      </div>
      
      {/* Your Political Profile Preview */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-medium text-foreground">Your Issue Profile</h3>
        </div>
        
        <div className="space-y-3">
          {selectedIssueData.map((issue) => {
            const stance = getIssueStance(issue.id);
            const stanceInfo = getStanceLabel(stance);
            const priority = data.priorities[issue.id] || 3;
            
            return (
              <div key={issue.id} className="flex items-center gap-3">
                <div className="w-32 flex-shrink-0">
                  <div className="text-sm font-medium">{issue.label}</div>
                  <div className="text-xs text-muted-foreground">{PRIORITY_LABELS[priority]}</div>
                </div>
                
                {/* Stance bar visualization */}
                <div className="flex-1">
                  <div className="relative h-6 bg-gradient-to-r from-red-200 via-purple-100 to-blue-200 rounded-full overflow-hidden">
                    {stance !== null && (
                      <div 
                        className="absolute top-1 bottom-1 w-3 rounded-full bg-foreground shadow-md transition-all"
                        style={{ 
                          left: `calc(${((stance + 2) / 4) * 100}% - 6px)`,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-1">
                    <span>Conservative</span>
                    <span>Progressive</span>
                  </div>
                </div>
                
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs text-white flex-shrink-0", stanceInfo.color)}
                >
                  {stanceInfo.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>
      
      {/* Detailed Answers (Collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
          <Check className="h-4 w-4" />
          View all your answers ({answeredCount} responses)
        </summary>
        
        <div className="mt-4 space-y-3">
          {selectedIssueData.map((issue) => {
            const issueQuestions = questions.filter((q) => q.issue_id === issue.id);
            
            return (
              <Card key={issue.id} className="p-4">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  {issue.label}
                  <Badge variant="outline" className="text-xs">
                    {issueQuestions.filter(q => data.answers[q.id] !== undefined).length}/{issueQuestions.length}
                  </Badge>
                </h4>
                <div className="space-y-2">
                  {issueQuestions.map((q) => {
                    const answer = data.answers[q.id] as AnswerValue | undefined;
                    return (
                      <div key={q.id} className="flex items-start gap-2 text-sm">
                        {answer !== undefined ? (
                          <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-muted-foreground/30 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <span className="text-muted-foreground">
                            {q.question_text}
                          </span>
                          {answer !== undefined && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "ml-2 text-xs",
                                answer >= 1 && "border-emerald-500 text-emerald-600",
                                answer <= -1 && "border-red-500 text-red-600",
                                answer === 0 && "border-muted-foreground"
                              )}
                            >
                              {ANSWER_LABELS[answer]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </details>
      
      {/* Privacy Note */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p>
          <strong>How alignment works:</strong> We compare your answers to politicians' 
          voting records and bill sponsorships on these issues. Your priority weights affect 
          how much each issue contributes to your overall alignment score. We never ask about 
          or store your party affiliation.
        </p>
      </div>
    </div>
  );
}
