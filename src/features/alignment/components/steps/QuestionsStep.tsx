import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Issue, IssueQuestion, ANSWER_LABELS, AnswerValue } from "../../types";

interface QuestionsStepProps {
  questions: IssueQuestion[];
  issues: Issue[];
  answers: Record<string, number>;
  isLoading: boolean;
  onUpdate: (data: Partial<{ answers: Record<string, number> }>) => void;
}

export function QuestionsStep({ questions, issues, answers, isLoading, onUpdate }: QuestionsStepProps) {
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.issue_id]) acc[q.issue_id] = [];
    acc[q.issue_id].push(q);
    return acc;
  }, {} as Record<string, IssueQuestion[]>);
  
  const setAnswer = (questionId: string, value: number) => {
    onUpdate({
      answers: { ...answers, [questionId]: value },
    });
  };
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
          Share your views
        </h2>
        <p className="text-muted-foreground">
          Rate how much you agree or disagree with each statement. There are no right or wrong answers.
        </p>
      </div>
      
      {Object.entries(groupedQuestions).map(([issueId, issueQuestions]) => {
        const issue = issues.find((i) => i.id === issueId);
        if (!issue) return null;
        
        return (
          <div key={issueId} className="space-y-4">
            <Badge variant="secondary" className="text-sm">
              {issue.label}
            </Badge>
            
            {issueQuestions.map((question) => (
              <Card key={question.id} className="p-4">
                <p className="font-medium text-foreground mb-4">
                  {question.question_text}
                </p>
                
                <RadioGroup
                  value={answers[question.id]?.toString()}
                  onValueChange={(value) => setAnswer(question.id, parseInt(value))}
                  className="space-y-2"
                >
                  {([-2, -1, 0, 1, 2] as AnswerValue[]).map((value) => (
                    <div key={value} className="flex items-center space-x-3">
                      <RadioGroupItem
                        value={value.toString()}
                        id={`${question.id}-${value}`}
                      />
                      <Label
                        htmlFor={`${question.id}-${value}`}
                        className="cursor-pointer text-sm"
                      >
                        {ANSWER_LABELS[value]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </Card>
            ))}
          </div>
        );
      })}
      
      <div className="text-sm text-muted-foreground">
        Answered {Object.keys(answers).length} of {questions.length} questions
      </div>
    </div>
  );
}
