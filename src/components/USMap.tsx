import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStateScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";

const getScoreColor = (score: number): string => {
  if (score >= 80) return "hsl(var(--score-excellent))";
  if (score >= 70) return "hsl(var(--score-good))";
  if (score >= 60) return "hsl(var(--score-average))";
  if (score >= 50) return "hsl(var(--score-poor))";
  return "hsl(var(--score-bad))";
};

interface USMapProps {
  onStateClick?: (stateAbbr: string) => void;
}

export function USMap({ onStateClick }: USMapProps) {
  const navigate = useNavigate();
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const { data: stateScores, isLoading } = useStateScores();

  const handleStateClick = (abbr: string) => {
    if (onStateClick) {
      onStateClick(abbr);
    } else {
      navigate(`/state/${abbr}`);
    }
  };

  const hoveredData = hoveredState 
    ? stateScores?.find(s => s.abbr === hoveredState) 
    : null;

  // State grid positions for cartogram layout
  const stateGrid: { [key: string]: { col: number; row: number } } = {
    AK: { col: 0, row: 0 }, HI: { col: 0, row: 4 },
    WA: { col: 1, row: 0 }, OR: { col: 1, row: 1 }, CA: { col: 1, row: 2 },
    ID: { col: 2, row: 0 }, NV: { col: 2, row: 1 }, AZ: { col: 2, row: 2 },
    MT: { col: 3, row: 0 }, UT: { col: 3, row: 1 }, NM: { col: 3, row: 2 },
    WY: { col: 4, row: 0 }, CO: { col: 4, row: 1 }, TX: { col: 4, row: 2 },
    ND: { col: 5, row: 0 }, SD: { col: 5, row: 1 }, NE: { col: 5, row: 2 }, KS: { col: 5, row: 3 }, OK: { col: 5, row: 4 },
    MN: { col: 6, row: 0 }, IA: { col: 6, row: 1 }, MO: { col: 6, row: 2 }, AR: { col: 6, row: 3 }, LA: { col: 6, row: 4 },
    WI: { col: 7, row: 0 }, IL: { col: 7, row: 1 }, KY: { col: 7, row: 2 }, TN: { col: 7, row: 3 }, MS: { col: 7, row: 4 },
    MI: { col: 8, row: 0 }, IN: { col: 8, row: 1 }, OH: { col: 8, row: 2 }, AL: { col: 8, row: 3 }, FL: { col: 8, row: 4 },
    PA: { col: 9, row: 1 }, WV: { col: 9, row: 2 }, VA: { col: 9, row: 3 }, GA: { col: 9, row: 4 },
    NY: { col: 10, row: 0 }, NJ: { col: 10, row: 1 }, MD: { col: 10, row: 2 }, NC: { col: 10, row: 3 }, SC: { col: 10, row: 4 },
    VT: { col: 11, row: 0 }, CT: { col: 11, row: 1 }, DE: { col: 11, row: 2 },
    NH: { col: 12, row: 0 }, RI: { col: 12, row: 1 }, DC: { col: 12, row: 2 },
    ME: { col: 13, row: 0 }, MA: { col: 13, row: 1 },
  };

  // All 50 states + DC for the grid
  const allStates = Object.keys(stateGrid);

  if (isLoading) {
    return (
      <div className="relative w-full p-4">
        <div className="grid grid-cols-14 gap-1">
          {Array.from({ length: 70 }).map((_, i) => (
            <Skeleton key={i} className="w-full aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Tooltip */}
      {hoveredData && (
        <div className="absolute top-4 left-4 z-10 rounded-lg bg-card border border-border shadow-civic-lg p-4 min-w-[180px] animate-scale-in">
          <h4 className="font-serif font-semibold text-foreground">{hoveredData.name}</h4>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-muted-foreground">Avg. Score</span>
            <span 
              className="text-lg font-bold"
              style={{ color: getScoreColor(hoveredData.score) }}
            >
              {hoveredData.score}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">Members</span>
            <span className="text-sm font-medium text-foreground">{hoveredData.memberCount}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 rounded-lg bg-card border border-border shadow-civic-md p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Average Score</p>
        <div className="flex gap-1">
          {[
            { color: "hsl(var(--score-bad))", label: "<50" },
            { color: "hsl(var(--score-poor))", label: "50+" },
            { color: "hsl(var(--score-average))", label: "60+" },
            { color: "hsl(var(--score-good))", label: "70+" },
            { color: "hsl(var(--score-excellent))", label: "80+" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <div 
                className="w-6 h-4 rounded-sm" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* State Grid Map */}
      <div className="grid grid-cols-14 gap-1 p-4">
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div key={rowIndex} className="contents">
            {Array.from({ length: 14 }).map((_, colIndex) => {
              const stateAbbr = allStates.find(abbr => {
                const pos = stateGrid[abbr];
                return pos && pos.row === rowIndex && pos.col === colIndex;
              });

              if (!stateAbbr) {
                return <div key={`${rowIndex}-${colIndex}`} className="w-full aspect-square" />;
              }

              const stateData = stateScores?.find(s => s.abbr === stateAbbr);
              const score = stateData?.score ?? 50;

              return (
                <button
                  key={stateAbbr}
                  onClick={() => handleStateClick(stateAbbr)}
                  onMouseEnter={() => setHoveredState(stateAbbr)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={cn(
                    "w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110 hover:z-10 shadow-civic-sm",
                    hoveredState === stateAbbr && "ring-2 ring-primary ring-offset-2",
                    !stateData && "opacity-50"
                  )}
                  style={{ 
                    backgroundColor: getScoreColor(score),
                    color: score >= 60 ? "hsl(var(--background))" : "hsl(var(--foreground))"
                  }}
                >
                  {stateAbbr}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
