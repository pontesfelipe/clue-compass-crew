import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { BasicInfoStep } from "./steps/BasicInfoStep";
import { IssueSelectionStep } from "./steps/IssueSelectionStep";
import { QuestionsStep } from "./steps/QuestionsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { 
  useIssues, 
  useIssueQuestions, 
  useAlignmentProfile,
  useSaveBasicInfo,
  useSavePriorities,
  useSaveAnswers,
  useCompleteProfile
} from "../hooks/useAlignmentProfile";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface WizardData {
  state: string;
  zip_code: string;
  age_range: string;
  selectedIssues: string[];
  priorities: Record<string, number>;
  answers: Record<string, number>;
}

const STEPS = ["Basic Info", "Select Issues", "Answer Questions", "Review"];

export function ProfileWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({
    state: "",
    zip_code: "",
    age_range: "",
    selectedIssues: [],
    priorities: {},
    answers: {},
  });
  
  const { data: issues = [], isLoading: issuesLoading } = useIssues();
  const { data: profile, isLoading: profileLoading } = useAlignmentProfile();
  const { data: questions = [], isLoading: questionsLoading } = useIssueQuestions(
    wizardData.selectedIssues
  );
  
  const saveBasicInfo = useSaveBasicInfo();
  const savePriorities = useSavePriorities();
  const saveAnswers = useSaveAnswers();
  const completeProfile = useCompleteProfile();
  
  const isLoading = issuesLoading || profileLoading;
  const isSaving = saveBasicInfo.isPending || savePriorities.isPending || 
                   saveAnswers.isPending || completeProfile.isPending;
  
  // Pre-fill from existing profile
  useState(() => {
    if (profile) {
      setWizardData((prev) => ({
        ...prev,
        state: profile.state || "",
        zip_code: profile.zip_code || "",
        age_range: profile.age_range || "",
        selectedIssues: profile.priorities.map((p) => p.issue_id),
        priorities: Object.fromEntries(
          profile.priorities.map((p) => [p.issue_id, p.priority_level])
        ),
        answers: Object.fromEntries(
          profile.answers.map((a) => [a.question_id, a.answer_value])
        ),
      }));
    }
  });
  
  const updateData = (data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  };
  
  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return wizardData.state.length > 0;
      case 1:
        return wizardData.selectedIssues.length >= 1 && wizardData.selectedIssues.length <= 5;
      case 2:
        return questions.every((q) => wizardData.answers[q.id] !== undefined);
      default:
        return true;
    }
  };
  
  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Final step - save everything
      try {
        await saveBasicInfo.mutateAsync({
          state: wizardData.state,
          zip_code: wizardData.zip_code || undefined,
          age_range: wizardData.age_range || undefined,
        });
        
        await savePriorities.mutateAsync(
          wizardData.selectedIssues.map((issueId, index) => ({
            issue_id: issueId,
            priority_level: wizardData.priorities[issueId] || (5 - index),
          }))
        );
        
        await saveAnswers.mutateAsync(
          Object.entries(wizardData.answers).map(([questionId, value]) => ({
            question_id: questionId,
            answer_value: value,
          }))
        );
        
        await completeProfile.mutateAsync();
        
        toast({ title: "Profile complete!", description: "View your alignment scores on member pages." });
        navigate("/map");
      } catch (error) {
        toast({ title: "Error saving profile", description: String(error), variant: "destructive" });
      }
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };
  
  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }
  
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  
  return (
    <Card className="p-6 md:p-8">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          <span>{STEPS[currentStep]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 0 && (
          <BasicInfoStep
            data={wizardData}
            onUpdate={updateData}
          />
        )}
        {currentStep === 1 && (
          <IssueSelectionStep
            issues={issues}
            selectedIssues={wizardData.selectedIssues}
            priorities={wizardData.priorities}
            onUpdate={updateData}
          />
        )}
        {currentStep === 2 && (
          <QuestionsStep
            questions={questions}
            issues={issues}
            answers={wizardData.answers}
            isLoading={questionsLoading}
            onUpdate={updateData}
          />
        )}
        {currentStep === 3 && (
          <ReviewStep
            data={wizardData}
            issues={issues}
            questions={questions}
          />
        )}
      </div>
      
      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || isSaving}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <Button
          onClick={handleNext}
          disabled={!canProceed() || isSaving}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {currentStep === STEPS.length - 1 ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Complete
            </>
          ) : (
            <>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
