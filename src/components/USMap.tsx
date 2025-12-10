import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStateScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Award } from "lucide-react";

// Score color scale: higher = more green (better score)
const getScoreColor = (score: number | null): string => {
  if (score === null) return "hsl(var(--muted))";
  if (score >= 81) return "hsl(142 76% 36%)";  // Excellent - dark green
  if (score >= 71) return "hsl(142 71% 45%)";  // Good - light green
  if (score >= 66) return "hsl(38 92% 50%)";   // Average - amber
  if (score >= 61) return "hsl(25 95% 53%)";   // Below average - orange
  return "hsl(0 72% 51%)";                      // Below 60 - red
};

// US Territories with non-voting delegates
const TERRITORIES = new Set(['GU', 'AS', 'VI', 'MP', 'PR', 'DC']);

interface USMapProps {
  onStateClick?: (stateAbbr: string) => void;
  showStats?: boolean;
}

export function USMap({ onStateClick, showStats = true }: USMapProps) {
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

  const hoveredStateData = hoveredState
    ? stateScores?.find(s => s.abbr === hoveredState)
    : null;
  
  const isTerritory = (abbr: string) => TERRITORIES.has(abbr);

  // Calculate statistics (exclude territories from national stats)
  const stats = useMemo(() => {
    if (!stateScores || stateScores.length === 0) return null;

    const validStates = stateScores.filter(s => s.score != null && !TERRITORIES.has(s.abbr));
    if (validStates.length === 0) return null;

    const avgScore = Math.round(
      validStates.reduce((sum, s) => sum + (s.score || 0), 0) / validStates.length
    );

    // Sort by score
    const sortedByScore = [...validStates].sort((a, b) => (b.score || 0) - (a.score || 0));
    const topStates = sortedByScore.slice(0, 3);
    const bottomStates = sortedByScore.slice(-3).reverse();

    return { avgScore, topStates, bottomStates, statesWithData: validStates.length };
  }, [stateScores]);

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
    // Territories (bottom row)
    PR: { col: 1, row: 4 }, VI: { col: 2, row: 4 }, GU: { col: 3, row: 4 }, AS: { col: 4, row: 4 }, MP: { col: 4, row: 3 },
  };

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
      {hoveredStateData && (
        <div className="absolute top-4 left-4 z-10 rounded-lg bg-card border border-border shadow-civic-lg p-4 min-w-[200px] animate-scale-in">
          <h4 className="font-serif font-semibold text-foreground">{hoveredStateData.name}</h4>
          {isTerritory(hoveredState!) && (
            <span className="text-xs text-muted-foreground italic">Non-voting delegate</span>
          )}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Score</span>
              <span className="text-sm font-bold text-primary">
                {hoveredStateData.score}/100
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">{isTerritory(hoveredState!) ? 'Delegate' : 'Members'}</span>
              <span className="text-sm font-medium">{hoveredStateData.memberCount}</span>
            </div>
          </div>
        </div>
      )}

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
              const bgColor = getScoreColor(stateData?.score ?? null);
              const textColor = "hsl(var(--background))";
              const hasData = !!stateData;
              const isTerritoryTile = isTerritory(stateAbbr);

              return (
                <button
                  key={stateAbbr}
                  onClick={() => handleStateClick(stateAbbr)}
                  onMouseEnter={() => setHoveredState(stateAbbr)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={cn(
                    "w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110 hover:z-10",
                    hoveredState === stateAbbr && "ring-2 ring-primary ring-offset-2",
                    !hasData && "opacity-50",
                    isTerritoryTile ? "border-2 border-dashed border-white/50 opacity-75 shadow-none" : "shadow-civic-sm"
                  )}
                  style={{ backgroundColor: bgColor, color: textColor }}
                  title={isTerritoryTile ? "Territory (non-voting delegate)" : undefined}
                >
                  {stateAbbr}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Statistics */}
      {showStats && stats && (
        <div className="mx-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* National Average */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">National Average</span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {stats.avgScore}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.statesWithData} states with data
            </p>
          </div>

          {/* Top Performing States */}
          <div className="p-4 rounded-lg bg-card border border-border md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-muted-foreground">Top States</span>
            </div>
            <div className="space-y-1">
              {stats.topStates.map((state, i) => (
                <div key={state.abbr} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i + 1}. {state.name}</span>
                  <span className="text-sm font-bold text-emerald-500">
                    {state.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom States */}
          <div className="p-4 rounded-lg bg-card border border-border md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-muted-foreground">Needs Improvement</span>
            </div>
            <div className="space-y-1">
              {stats.bottomStates.map((state, i) => (
                <div key={state.abbr} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i + 1}. {state.name}</span>
                  <span className="text-sm font-bold text-red-500">
                    {state.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-sm font-medium text-foreground mb-3">Score Guide</p>
            <div className="space-y-1.5">
              {[
                { color: "hsl(142 76% 36%)", range: "81+", label: "Excellent" },
                { color: "hsl(142 71% 45%)", range: "71-80", label: "Good" },
                { color: "hsl(38 92% 50%)", range: "66-70", label: "Average" },
                { color: "hsl(25 95% 53%)", range: "61-65", label: "Below avg" },
                { color: "hsl(0 72% 51%)", range: "≤60", label: "Needs work" },
              ].map((item) => (
                <div key={item.range} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.range}</span> {item.label}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
                <div className="w-3 h-3 rounded-sm shrink-0 border-2 border-dashed border-muted-foreground opacity-75" />
                <span className="text-xs text-muted-foreground">Territory (non-voting)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
