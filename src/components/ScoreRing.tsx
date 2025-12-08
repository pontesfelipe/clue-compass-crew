import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: { container: "w-12 h-12", stroke: 3, fontSize: "text-xs" },
  md: { container: "w-20 h-20", stroke: 4, fontSize: "text-lg" },
  lg: { container: "w-28 h-28", stroke: 5, fontSize: "text-2xl" },
  xl: { container: "w-36 h-36", stroke: 6, fontSize: "text-3xl" },
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return "stroke-score-excellent";
  if (score >= 60) return "stroke-score-good";
  if (score >= 40) return "stroke-score-average";
  if (score >= 20) return "stroke-score-poor";
  return "stroke-score-bad";
};

const getScoreTextColor = (score: number): string => {
  if (score >= 80) return "text-score-excellent";
  if (score >= 60) return "text-score-good";
  if (score >= 40) return "text-score-average";
  if (score >= 20) return "text-score-poor";
  return "text-score-bad";
};

export function ScoreRing({ 
  score, 
  size = "md", 
  showLabel = false, 
  label,
  className 
}: ScoreRingProps) {
  const { container, stroke, fontSize } = sizeMap[size];
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn("relative", container)}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={cn("transition-all duration-1000 ease-out", getScoreColor(score))}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className={cn(
          "absolute inset-0 flex items-center justify-center font-bold",
          fontSize,
          getScoreTextColor(score)
        )}>
          {score}
        </div>
      </div>
      {showLabel && label && (
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      )}
    </div>
  );
}
