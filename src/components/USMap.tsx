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

  // Compact state grid positions - standard US tile cartogram
  const stateGrid: { [key: string]: { col: number; row: number } } = {
    // Row 0
    AK: { col: 0, row: 0 }, ME: { col: 10, row: 0 },
    // Row 1
    WA: { col: 1, row: 1 }, ID: { col: 2, row: 1 }, MT: { col: 3, row: 1 }, ND: { col: 4, row: 1 }, MN: { col: 5, row: 1 }, WI: { col: 6, row: 1 }, MI: { col: 8, row: 1 }, VT: { col: 9, row: 1 }, NH: { col: 10, row: 1 },
    // Row 2
    OR: { col: 1, row: 2 }, NV: { col: 2, row: 2 }, WY: { col: 3, row: 2 }, SD: { col: 4, row: 2 }, IA: { col: 5, row: 2 }, IL: { col: 6, row: 2 }, IN: { col: 7, row: 2 }, OH: { col: 8, row: 2 }, PA: { col: 9, row: 2 }, NY: { col: 10, row: 2 }, MA: { col: 11, row: 2 },
    // Row 3
    CA: { col: 1, row: 3 }, UT: { col: 2, row: 3 }, CO: { col: 3, row: 3 }, NE: { col: 4, row: 3 }, KS: { col: 5, row: 3 }, MO: { col: 6, row: 3 }, KY: { col: 7, row: 3 }, WV: { col: 8, row: 3 }, VA: { col: 9, row: 3 }, NJ: { col: 10, row: 3 }, CT: { col: 11, row: 3 }, RI: { col: 12, row: 3 },
    // Row 4
    AZ: { col: 2, row: 4 }, NM: { col: 3, row: 4 }, OK: { col: 5, row: 4 }, AR: { col: 6, row: 4 }, TN: { col: 7, row: 4 }, NC: { col: 8, row: 4 }, SC: { col: 9, row: 4 }, MD: { col: 10, row: 4 }, DE: { col: 11, row: 4 },
    // Row 5
    HI: { col: 0, row: 5 }, TX: { col: 4, row: 5 }, LA: { col: 6, row: 5 }, MS: { col: 7, row: 5 }, AL: { col: 8, row: 5 }, GA: { col: 9, row: 5 }, FL: { col: 10, row: 5 }, DC: { col: 11, row: 5 },
  };

  // All 50 states + DC for the grid
  const allStates = Object.keys(stateGrid);

  if (isLoading) {
    return (
      <div className="relative w-full p-4">
        <div className="grid grid-cols-13 gap-0.5">
          {Array.from({ length: 78 }).map((_, i) => (
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
      <div className="grid grid-cols-13 gap-0.5 p-4">
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div key={rowIndex} className="contents">
            {Array.from({ length: 13 }).map((_, colIndex) => {
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
