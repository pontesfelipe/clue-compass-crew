import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Settings2, Lock, AlertCircle } from "lucide-react";
import { useScoringPreferences, ScoringPreferences } from "@/hooks/useScoringPreferences";
import { cn } from "@/lib/utils";

interface WeightSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function WeightSlider({ label, description, value, onChange, disabled }: WeightSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums w-12 text-right">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        max={100}
        step={5}
        disabled={disabled}
        className={cn(disabled && "opacity-50")}
      />
    </div>
  );
}

export function ScoringPreferencesDialog() {
  const { preferences, isAuthenticated, updatePreferences, isUpdating } = useScoringPreferences();
  const [open, setOpen] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<ScoringPreferences>(preferences);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalPrefs(preferences);
      setError(null);
    }
  }, [open, preferences]);

  const total =
    localPrefs.productivityWeight +
    localPrefs.attendanceWeight +
    localPrefs.bipartisanshipWeight +
    localPrefs.issueAlignmentWeight;

  const isValid = total === 100;

  const handleSave = () => {
    if (!isValid) {
      setError("Weights must add up to 100%");
      return;
    }
    updatePreferences(localPrefs);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalPrefs({
      productivityWeight: 25,
      attendanceWeight: 25,
      bipartisanshipWeight: 25,
      issueAlignmentWeight: 25,
      priorityIssues: [],
    });
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="civic-outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Customize Weights
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Customize Score Weights
          </DialogTitle>
          <DialogDescription>
            Adjust how different factors contribute to the overall CivicScore.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="py-8 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Sign in required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create an account or sign in to customize your scoring preferences.
            </p>
            <Button variant="civic" asChild>
              <a href="/auth">Sign In</a>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-6 py-4">
              <WeightSlider
                label="Productivity"
                description="Bills sponsored and enacted"
                value={localPrefs.productivityWeight}
                onChange={(v) => setLocalPrefs((p) => ({ ...p, productivityWeight: v }))}
              />
              <WeightSlider
                label="Attendance"
                description="Voting participation rate"
                value={localPrefs.attendanceWeight}
                onChange={(v) => setLocalPrefs((p) => ({ ...p, attendanceWeight: v }))}
              />
              <WeightSlider
                label="Bipartisanship"
                description="Cross-party collaboration"
                value={localPrefs.bipartisanshipWeight}
                onChange={(v) => setLocalPrefs((p) => ({ ...p, bipartisanshipWeight: v }))}
              />
              <WeightSlider
                label="Issue Alignment"
                description="Based on your priority issues"
                value={localPrefs.issueAlignmentWeight}
                onChange={(v) => setLocalPrefs((p) => ({ ...p, issueAlignmentWeight: v }))}
              />

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isValid ? "text-green-600 dark:text-green-400" : "text-destructive"
                    )}
                  >
                    {total}%
                  </span>
                </div>
                {!isValid && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Weights must add up to exactly 100%
                  </p>
                )}
                {error && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleReset} className="sm:mr-auto">
                Reset to Default
              </Button>
              <Button variant="civic" onClick={handleSave} disabled={!isValid || isUpdating}>
                {isUpdating ? "Saving..." : "Save Preferences"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
