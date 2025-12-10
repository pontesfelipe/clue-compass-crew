import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, MapPin } from "lucide-react";
import { Issue, IssueQuestion, ANSWER_LABELS, AnswerValue } from "../../types";
import { stateNames } from "@/hooks/useStateData";

interface ReviewStepProps {
  data: {
    state: string;
    zip_code: string;
    age_range: string;
    selectedIssues: string[];
    answers: Record<string, number>;
  };
  issues: Issue[];
  questions: IssueQuestion[];
}

export function ReviewStep({ data, issues, questions }: ReviewStepProps) {
  const selectedIssueData = issues.filter((i) => data.selectedIssues.includes(i.id));
  
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
      
      {/* Location */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Location</h3>
            <p className="text-sm text-muted-foreground">
              {stateNames[data.state] || data.state}
              {data.zip_code && ` · ${data.zip_code}`}
              {data.age_range && ` · Age ${data.age_range}`}
            </p>
          </div>
        </div>
      </Card>
      
      {/* Selected Issues */}
      <div>
        <h3 className="font-medium text-foreground mb-3">Your Priority Issues</h3>
        <div className="flex flex-wrap gap-2">
          {selectedIssueData.map((issue, index) => (
            <Badge key={issue.id} variant="secondary" className="text-sm py-1 px-3">
              #{index + 1} {issue.label}
            </Badge>
          ))}
        </div>
      </div>
      
      {/* Answers Summary */}
      <div>
        <h3 className="font-medium text-foreground mb-3">Your Answers</h3>
        <div className="space-y-3">
          {selectedIssueData.map((issue) => {
            const issueQuestions = questions.filter((q) => q.issue_id === issue.id);
            
            return (
              <Card key={issue.id} className="p-4">
                <h4 className="font-medium text-foreground mb-2">{issue.label}</h4>
                <div className="space-y-2">
                  {issueQuestions.map((q) => {
                    const answer = data.answers[q.id] as AnswerValue | undefined;
                    return (
                      <div key={q.id} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground line-clamp-1">
                            {q.question_text}
                          </span>
                          <span className="font-medium text-foreground ml-1">
                            → {answer !== undefined ? ANSWER_LABELS[answer] : "Not answered"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      
      {/* Privacy Note */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p>
          <strong>How alignment works:</strong> We compare your answers to politicians' 
          voting records and bill sponsorships. Alignment is computed mathematically—we 
          never ask about or store your party affiliation.
        </p>
      </div>
    </div>
  );
}
