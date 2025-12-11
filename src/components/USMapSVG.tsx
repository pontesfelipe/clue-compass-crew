import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import USAMap from "react-usa-map";
import { useStateScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Award, MapPin, Map, Grid3X3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Score color scale: higher = more green (better score)
const getScoreColor = (score: number | null): string => {
  if (score === null) return "#d1d5db"; // muted gray
  if (score >= 81) return "#16a34a";  // Excellent - dark green
  if (score >= 71) return "#22c55e";  // Good - light green
  if (score >= 66) return "#f59e0b";  // Average - amber
  if (score >= 61) return "#f97316";  // Below average - orange
  return "#dc2626";                    // Below 60 - red
};

// HSL version for tiles
const getScoreColorHSL = (score: number | null): string => {
  if (score === null) return "hsl(var(--muted))";
  if (score >= 81) return "hsl(142 76% 36%)";
  if (score >= 71) return "hsl(142 71% 45%)";
  if (score >= 66) return "hsl(38 92% 50%)";
  if (score >= 61) return "hsl(25 95% 53%)";
  return "hsl(0 72% 51%)";
};

// Fixed US state grid layout for tiles view
const STATE_COLUMNS: string[][] = [
  ["WA", "OR", "CA", "", "HI", "AK"],
  ["ID", "NV", "AZ"],
  ["MT", "WY", "UT", "CO", "NM"],
  ["ND", "SD", "NE", "KS", "OK", "TX"],
  ["MN", "IA", "MO", "AR", "LA"],
  ["WI", "IL", "KY", "TN", "MS"],
  ["MI", "IN", "AL", "GA", "FL"],
  ["NY", "PA", "VA", "SC"],
  ["VT", "NH", "WV", "NC"],
  ["ME", "NJ", "MD", "DE"],
  ["MA", "CT", "RI"],
];

// Territories with full names
const TERRITORY_INFO: Record<string, string> = {
  DC: "District of Columbia",
  PR: "Puerto Rico",
  VI: "U.S. Virgin Islands",
  GU: "Guam",
  AS: "American Samoa",
  MP: "Northern Mariana Islands"
};

const TERRITORIES = Object.keys(TERRITORY_INFO);
const MAX_ROWS = Math.max(...STATE_COLUMNS.map(col => col.length), TERRITORIES.length);
const GRID_COLUMNS = STATE_COLUMNS.length + 2;

type ViewMode = "geographic" | "tiles";

interface USMapSVGProps {
  onStateClick?: (stateAbbr: string) => void;
  showStats?: boolean;
}

export function USMapSVG({ onStateClick, showStats = true }: USMapSVGProps) {
  const navigate = useNavigate();
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("geographic");
  
  const { data: stateScores, isLoading } = useStateScores();

  const handleStateClick = (event: React.MouseEvent<SVGPathElement>) => {
    const stateAbbr = event.currentTarget.dataset.name;
    if (!stateAbbr) return;
    
    if (onStateClick) {
      onStateClick(stateAbbr);
    } else {
      navigate(`/state/${stateAbbr}`);
    }
  };

  const handleTileClick = (abbr: string) => {
    if (onStateClick) {
      onStateClick(abbr);
    } else {
      navigate(`/state/${abbr}`);
    }
  };

  const handleStateHover = (event: React.MouseEvent<SVGPathElement>) => {
    const stateAbbr = event.currentTarget.dataset.name;
    setHoveredState(stateAbbr || null);
  };

  const handleStateLeave = () => {
    setHoveredState(null);
  };

  const handleTerritoryClick = (abbr: string) => {
    if (onStateClick) {
      onStateClick(abbr);
    } else {
      navigate(`/state/${abbr}`);
    }
  };

  // Generate state customization config based on scores
  const statesCustomConfig = useMemo(() => {
    if (!stateScores) return {};

    const config: Record<string, { fill: string }> = {};
    
    stateScores.forEach((state) => {
      config[state.abbr] = {
        fill: getScoreColor(state.score),
      };
    });

    return config;
  }, [stateScores]);

  const hoveredStateData = hoveredState
    ? stateScores?.find(s => s.abbr === hoveredState)
    : null;

  // Get territory scores
  const territoryScores = useMemo(() => {
    if (!stateScores) return [];
    return TERRITORIES.map(abbr => {
      const stateData = stateScores.find(s => s.abbr === abbr);
      return {
        abbr,
        name: TERRITORY_INFO[abbr],
        score: stateData?.score ?? null,
        memberCount: stateData?.memberCount ?? 0
      };
    });
  }, [stateScores]);

  // Calculate statistics (exclude territories from national stats)
  const stats = useMemo(() => {
    if (!stateScores || stateScores.length === 0) return null;

    const validStates = stateScores.filter(s => s.score != null && !TERRITORIES.includes(s.abbr));
    if (validStates.length === 0) return null;

    const avgScore = Math.round(
      validStates.reduce((sum, s) => sum + (s.score || 0), 0) / validStates.length
    );

    const sortedByScore = [...validStates].sort((a, b) => (b.score || 0) - (a.score || 0));
    const topStates = sortedByScore.slice(0, 3);
    const bottomStates = sortedByScore.slice(-3).reverse();

    return { avgScore, topStates, bottomStates, statesWithData: validStates.length };
  }, [stateScores]);

  const renderStateTile = (stateAbbr: string, isTerritoryTile: boolean = false) => {
    const stateData = stateScores?.find(s => s.abbr === stateAbbr);
    const bgColor = getScoreColorHSL(stateData?.score ?? null);
    const textColor = "hsl(var(--background))";
    const hasData = !!stateData;

    return (
      <button
        key={stateAbbr}
        onClick={() => handleTileClick(stateAbbr)}
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
  };

  if (isLoading) {
    return (
      <div className="relative w-full p-4">
        <Skeleton className="w-full h-[400px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* View Toggle Dropdown */}
      <div className="px-4 pt-4 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {viewMode === "geographic" ? (
                <>
                  <Map className="h-4 w-4" />
                  Geographic Map
                </>
              ) : (
                <>
                  <Grid3X3 className="h-4 w-4" />
                  Tile Grid
                </>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border border-border z-50">
            <DropdownMenuItem 
              onClick={() => setViewMode("geographic")}
              className={cn(viewMode === "geographic" && "bg-accent")}
            >
              <Map className="h-4 w-4 mr-2" />
              Geographic Map
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setViewMode("tiles")}
              className={cn(viewMode === "tiles" && "bg-accent")}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Tile Grid
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tooltip */}
      {hoveredStateData && (
        <div className="absolute top-16 left-4 z-20 rounded-lg bg-card border border-border shadow-civic-lg p-4 min-w-[200px] animate-scale-in pointer-events-none">
          <h4 className="font-serif font-semibold text-foreground">{hoveredStateData.name}</h4>
          {TERRITORIES.includes(hoveredState!) && (
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
              <span className="text-xs text-muted-foreground">
                {TERRITORIES.includes(hoveredState!) ? "Delegate" : "Members"}
              </span>
              <span className="text-sm font-medium">{hoveredStateData.memberCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Geographic SVG Map View */}
      {viewMode === "geographic" && (
        <>
          <div 
            className="relative p-4 [&_path]:cursor-pointer [&_path]:transition-opacity [&_path:hover]:opacity-70 [&_path]:stroke-background [&_path]:stroke-[0.5]"
            onMouseLeave={handleStateLeave}
          >
            <USAMap
              customize={statesCustomConfig}
              onClick={handleStateClick}
              onMouseOver={handleStateHover}
              defaultFill="#d1d5db"
              width="100%"
              title="US State Performance Map"
            />
          </div>

          {/* Territories Section */}
          <div className="mx-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">U.S. Territories (Non-voting Delegates)</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {territoryScores.map((territory) => (
                <button
                  key={territory.abbr}
                  onClick={() => handleTerritoryClick(territory.abbr)}
                  onMouseEnter={() => setHoveredState(territory.abbr)}
                  onMouseLeave={() => setHoveredState(null)}
                  className="group relative p-3 rounded-lg border border-dashed border-border hover:border-primary/50 transition-all cursor-pointer"
                  style={{ 
                    backgroundColor: getScoreColor(territory.score),
                    opacity: 0.85
                  }}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold text-white drop-shadow-md">{territory.abbr}</div>
                    <div className="text-xs text-white/80 drop-shadow-sm">
                      {territory.score ?? "N/A"}
                    </div>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                    <div className="font-medium text-foreground">{territory.name}</div>
                    <div className="text-muted-foreground">Score: {territory.score ?? "No data"}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tile Grid View */}
      {viewMode === "tiles" && (
        <div className="p-4">
          <div 
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: MAX_ROWS }).map((_, rowIndex) => (
              <React.Fragment key={`row-${rowIndex}`}>
                {STATE_COLUMNS.map((column, colIndex) => {
                  const stateAbbr = column[rowIndex];
                  if (!stateAbbr) {
                    return <div key={`empty-${rowIndex}-${colIndex}`} className="w-full aspect-square" />;
                  }
                  return renderStateTile(stateAbbr, false);
                })}
                <div key={`spacer-${rowIndex}`} className="w-full aspect-square" />
                {TERRITORIES[rowIndex] ? (
                  renderStateTile(TERRITORIES[rowIndex], true)
                ) : (
                  <div key={`empty-territory-${rowIndex}`} className="w-full aspect-square" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

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
                { color: "#16a34a", range: "81+", label: "Excellent" },
                { color: "#22c55e", range: "71-80", label: "Good" },
                { color: "#f59e0b", range: "66-70", label: "Average" },
                { color: "#f97316", range: "61-65", label: "Below avg" },
                { color: "#dc2626", range: "≤60", label: "Needs work" },
              ].map((item) => (
                <div key={item.range} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.range}</span> {item.label}
                  </span>
                </div>
              ))}
              {viewMode === "tiles" && (
                <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
                  <div className="w-3 h-3 rounded-sm shrink-0 border-2 border-dashed border-muted-foreground opacity-75" />
                  <span className="text-xs text-muted-foreground">Territory (non-voting)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
