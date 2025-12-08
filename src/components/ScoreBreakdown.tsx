import { cn } from "@/lib/utils";

interface ScoreCategory {
  name: string;
  score: number;
  weight: number;
  description: string;
}

interface ScoreBreakdownProps {
  categories: ScoreCategory[];
  className?: string;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return "bg-score-excellent";
  if (score >= 60) return "bg-score-good";
  if (score >= 40) return "bg-score-average";
  if (score >= 20) return "bg-score-poor";
  return "bg-score-bad";
};

export function ScoreBreakdown({ categories, className }: ScoreBreakdownProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {categories.map((category, index) => (
        <div 
          key={category.name}
          className="opacity-0 animate-slide-up"
          style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-medium text-foreground">{category.name}</h4>
              <p className="text-xs text-muted-foreground">{category.description}</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">{category.score}</span>
              <span className="text-xs text-muted-foreground ml-1">/ 100</span>
            </div>
          </div>
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out",
                getScoreColor(category.score)
              )}
              style={{ width: `${category.score}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Weight: {category.weight}%
          </p>
        </div>
      ))}
    </div>
  );
}
