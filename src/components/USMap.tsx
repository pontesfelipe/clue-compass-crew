import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStateFundingScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Leaf, Users } from "lucide-react";

// PAC dependence color scale: higher = more red (more PAC dependent)
const getPacDependenceColor = (score: number | null): string => {
  if (score === null) return "hsl(var(--muted))";
  if (score >= 70) return "hsl(0 72% 51%)"; // High PAC reliance - red
  if (score >= 40) return "hsl(38 92% 50%)"; // Mixed - amber
  return "hsl(142 76% 36%)"; // Lower PAC reliance - green
};

interface USMapProps {
  onStateClick?: (stateAbbr: string) => void;
  showStats?: boolean;
}

export function USMap({ onStateClick, showStats = true }: USMapProps) {
  const navigate = useNavigate();
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  
  const { data: fundingScores, isLoading } = useStateFundingScores();

  const handleStateClick = (abbr: string) => {
    if (onStateClick) {
      onStateClick(abbr);
    } else {
      navigate(`/state/${abbr}`);
    }
  };

  const hoveredFundingData = hoveredState
    ? fundingScores?.find(s => s.abbr === hoveredState)
    : null;

  // Calculate funding statistics
  const fundingStats = useMemo(() => {
    if (!fundingScores || fundingScores.length === 0) return null;

    const validStates = fundingScores.filter(s => s.avgPacDependence != null);
    if (validStates.length === 0) return null;

    const avgPac = Math.round(
      validStates.reduce((sum, s) => sum + (s.avgPacDependence || 0), 0) / validStates.length
    );
    const avgGrassroots = Math.round(
      validStates.reduce((sum, s) => sum + (s.avgGrassrootsSupport || 0), 0) / validStates.length
    );
    const avgLocal = Math.round(
      validStates.reduce((sum, s) => sum + (s.avgLocalMoney || 0), 0) / validStates.length
    );

    // Sort by PAC dependence
    const sortedByPac = [...validStates].sort((a, b) => (b.avgPacDependence || 0) - (a.avgPacDependence || 0));
    const highestPac = sortedByPac.slice(0, 3);
    const lowestPac = sortedByPac.slice(-3).reverse();

    return { avgPac, avgGrassroots, avgLocal, highestPac, lowestPac, statesWithData: validStates.length };
  }, [fundingScores]);

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
      {/* Funding Layer Tooltip */}
      {hoveredFundingData && (
        <div className="absolute top-4 left-4 z-10 rounded-lg bg-card border border-border shadow-civic-lg p-4 min-w-[220px] animate-scale-in">
          <h4 className="font-serif font-semibold text-foreground">{hoveredFundingData.name}</h4>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Grassroots Support</span>
              <span className="text-sm font-bold text-emerald-500">
                {hoveredFundingData.avgGrassrootsSupport ?? "N/A"}/100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">PAC Dependence</span>
              <span className="text-sm font-bold text-amber-500">
                {hoveredFundingData.avgPacDependence ?? "N/A"}/100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Local Money</span>
              <span className="text-sm font-bold text-civic-blue">
                {hoveredFundingData.avgLocalMoney ?? "N/A"}/100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Out-of-State</span>
              <span className="text-sm font-medium">
                {hoveredFundingData.avgPctOutOfState != null ? `${hoveredFundingData.avgPctOutOfState}%` : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Members analyzed</span>
              <span className="text-sm font-medium">{hoveredFundingData.memberCount}</span>
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

              const fundingData = fundingScores?.find(s => s.abbr === stateAbbr);
              const bgColor = getPacDependenceColor(fundingData?.avgPacDependence ?? null);
              const textColor = "hsl(var(--background))";
              const hasData = !!fundingData;

              return (
                <button
                  key={stateAbbr}
                  onClick={() => handleStateClick(stateAbbr)}
                  onMouseEnter={() => setHoveredState(stateAbbr)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={cn(
                    "w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110 hover:z-10 shadow-civic-sm",
                    hoveredState === stateAbbr && "ring-2 ring-primary ring-offset-2",
                    !hasData && "opacity-50"
                  )}
                  style={{ backgroundColor: bgColor, color: textColor }}
                >
                  {stateAbbr}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Funding Layer Statistics */}
      {showStats && fundingStats && (
        <div className="mx-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* National PAC Average */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Avg PAC Dependence</span>
            </div>
            <div className="text-3xl font-bold text-amber-500">
              {fundingStats.avgPac}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fundingStats.statesWithData} states with data
            </p>
          </div>

          {/* Grassroots Average */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-muted-foreground">Avg Grassroots</span>
            </div>
            <div className="text-3xl font-bold text-emerald-500">
              {fundingStats.avgGrassroots}
            </div>
          </div>

          {/* Local Money Average */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-civic-blue" />
              <span className="text-sm font-medium text-muted-foreground">Avg Local Money</span>
            </div>
            <div className="text-3xl font-bold text-civic-blue">
              {fundingStats.avgLocal}
            </div>
          </div>

          {/* Highest PAC Dependence */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-muted-foreground">High PAC Reliance</span>
            </div>
            <div className="space-y-1">
              {fundingStats.highestPac.map((state, i) => (
                <div key={state.abbr} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i + 1}. {state.name}</span>
                  <span className="text-sm font-bold text-red-500">
                    {state.avgPacDependence}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lowest PAC Dependence */}
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-muted-foreground">Low PAC Reliance</span>
            </div>
            <div className="space-y-1">
              {fundingStats.lowestPac.map((state, i) => (
                <div key={state.abbr} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i + 1}. {state.name}</span>
                  <span className="text-sm font-bold text-emerald-500">
                    {state.avgPacDependence}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Funding Legend */}
      {showStats && (
        <div className="mx-4 mb-4 p-4 rounded-lg bg-card border border-border">
          <p className="text-sm font-medium text-foreground mb-3">PAC Dependence Guide</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { color: "hsl(142 76% 36%)", range: "0-39", label: "Lower PAC reliance" },
              { color: "hsl(38 92% 50%)", range: "40-69", label: "Mixed funding sources" },
              { color: "hsl(0 72% 51%)", range: "70-100", label: "High PAC reliance" },
            ].map((item) => (
              <div key={item.range} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.range}</span> {item.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Based on FEC-reported PAC and individual contributions.
          </p>
        </div>
      )}
    </div>
  );
}
