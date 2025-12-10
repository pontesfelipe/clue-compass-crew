import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Issue, IssueQuestion, ANSWER_LABELS, AnswerValue } from "../../types";

interface QuestionsStepProps {
  questions: IssueQuestion[];
  issues: Issue[];
  answers: Record<string, number>;
  isLoading: boolean;
  onUpdate: (data: Partial<{ answers: Record<string, number> }>) => void;
}

const ANSWER_COLORS: Record<AnswerValue, string> = {
  [-2]: "bg-red-500",
  [-1]: "bg-orange-400",
  [0]: "bg-muted",
  [1]: "bg-emerald-400",
  [2]: "bg-emerald-600",
};

const ANSWER_DESCRIPTIONS: Record<AnswerValue, string> = {
  [-2]: "I feel strongly against this",
  [-1]: "I lean against this",
  [0]: "I don't have a strong opinion",
  [1]: "I lean toward supporting this",
  [2]: "I feel strongly about this",
};

export function QuestionsStep({ questions, issues, answers, isLoading, onUpdate }: QuestionsStepProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.issue_id]) acc[q.issue_id] = [];
    acc[q.issue_id].push(q);
    return acc;
  }, {} as Record<string, IssueQuestion[]>);
  
  const flatQuestions = Object.entries(groupedQuestions).flatMap(([issueId, qs]) => 
    qs.map(q => ({ ...q, issue: issues.find(i => i.id === issueId) }))
  );
  
  const currentQuestion = flatQuestions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;
  
  const setAnswer = (questionId: string, value: number) => {
    onUpdate({
      answers: { ...answers, [questionId]: value },
    });
  };
  
  const goNext = () => {
    if (currentIndex < flatQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };
  
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  
  if (flatQuestions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No questions available for your selected issues.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-2xl font-bold text-foreground">
            Share your views
          </h2>
          <Badge variant="outline" className="font-mono">
            {answeredCount}/{totalCount}
          </Badge>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
      
      {/* Question navigator */}
      <div className="flex gap-1.5 flex-wrap">
        {flatQuestions.map((q, idx) => {
          const isAnswered = answers[q.id] !== undefined;
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                isCurrent && "ring-2 ring-primary ring-offset-2",
                isAnswered && !isCurrent && "bg-primary text-primary-foreground",
                !isAnswered && !isCurrent && "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {isAnswered ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </button>
          );
        })}
      </div>
      
      {/* Current question card */}
      {currentQuestion && (
        <Card className="p-6 space-y-6">
          {/* Issue badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{currentQuestion.issue?.label}</Badge>
            <span className="text-xs text-muted-foreground">
              Question {currentIndex + 1} of {flatQuestions.length}
            </span>
          </div>
          
          {/* Question text */}
          <p className="text-lg font-medium text-foreground leading-relaxed">
            {currentQuestion.question_text}
          </p>
          
          {/* Answer slider */}
          <div className="space-y-6 pt-4">
            {/* Visual scale labels */}
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Strongly Oppose</span>
              <span>Neutral</span>
              <span>Strongly Support</span>
            </div>
            
            {/* Slider with visual indicators */}
            <div className="relative px-2">
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-3 rounded-full bg-gradient-to-r from-red-200 via-gray-200 to-emerald-200" />
              <Slider
                value={[currentAnswer ?? 0]}
                onValueChange={([value]) => setAnswer(currentQuestion.id, value)}
                min={-2}
                max={2}
                step={1}
                className="relative"
              />
            </div>
            
            {/* Current answer display */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <Badge 
                className={cn(
                  "text-sm px-4 py-1.5",
                  currentAnswer !== undefined && ANSWER_COLORS[currentAnswer as AnswerValue]
                )}
                variant={currentAnswer === undefined ? "outline" : "default"}
              >
                {currentAnswer !== undefined 
                  ? ANSWER_LABELS[currentAnswer as AnswerValue]
                  : "Drag to answer"
                }
              </Badge>
              {currentAnswer !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {ANSWER_DESCRIPTIONS[currentAnswer as AnswerValue]}
                </span>
              )}
            </div>
            
            {/* Quick select buttons */}
            <div className="flex justify-center gap-2 pt-2">
              {([-2, -1, 0, 1, 2] as AnswerValue[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setAnswer(currentQuestion.id, value)}
                  className={cn(
                    "w-10 h-10 rounded-full transition-all text-xs font-medium",
                    currentAnswer === value 
                      ? cn(ANSWER_COLORS[value], "text-white scale-110 shadow-lg")
                      : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  )}
                >
                  {value > 0 ? `+${value}` : value}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}
      
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <div className="text-sm text-muted-foreground">
          {answeredCount === totalCount ? (
            <span className="text-primary font-medium flex items-center gap-1">
              <Check className="h-4 w-4" />
              All questions answered!
            </span>
          ) : (
            <span>{totalCount - answeredCount} remaining</span>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={currentIndex === flatQuestions.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
