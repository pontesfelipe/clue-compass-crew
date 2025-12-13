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

// Neutral score color scale - muted, analytical, non-partisan
// Colors communicate data state, never ideology
const getScoreColor = (score: number | null): string => {
  if (score === null) return "#d1d5db"; // muted gray
  if (score >= 81) return "#4f7f6a";  // Muted teal-green (data-positive)
  if (score >= 71) return "#6b9b8a";  // Light teal
  if (score >= 66) return "#8a8a8a";  // Neutral gray
  if (score >= 61) return "#a68b5b";  // Muted amber
  return "#8a6b5b";                    // Muted brown
};

// HSL version for tiles - neutral, muted palette
const getScoreColorHSL = (score: number | null): string => {
  if (score === null) return "hsl(var(--muted))";
  if (score >= 81) return "hsl(150 25% 40%)";
  if (score >= 71) return "hsl(150 20% 50%)";
  if (score >= 66) return "hsl(0 0% 54%)";
  if (score >= 61) return "hsl(38 30% 50%)";
  return "hsl(20 20% 45%)";
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

const STORAGE_KEY = "civicscore-map-view-preference";

const getStoredViewMode = (): ViewMode => {
  if (typeof window === "undefined") return "geographic";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "tiles" ? "tiles" : "geographic";
};

interface USMapSVGProps {
  onStateClick?: (stateAbbr: string) => void;
  showStats?: boolean;
}

export function USMapSVG({ onStateClick, showStats = true }: USMapSVGProps) {
  const navigate = useNavigate();
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);
  
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };
  
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
              onClick={() => handleViewModeChange("geographic")}
              className={cn(viewMode === "geographic" && "bg-accent")}
            >
              <Map className="h-4 w-4 mr-2" />
              Geographic Map
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleViewModeChange("tiles")}
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
        <div className="absolute top-16 left-4 z-20 rounded-md bg-card border border-border shadow-lg p-4 min-w-[200px] pointer-events-none">
          <h4 className="font-medium text-foreground">{hoveredStateData.name}</h4>
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

          {/* Higher Performing States */}
          <div className="p-4 rounded-md bg-card border border-border md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Higher Scores</span>
            </div>
            <div className="space-y-1">
              {stats.topStates.map((state, i) => (
                <div key={state.abbr} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i + 1}. {state.name}</span>
                  <span className="text-sm font-medium text-foreground">
                    {state.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lower Scores - neutral language */}
          <div className="p-4 rounded-md bg-card border border-border md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Lower Scores</span>
            </div>
            <div className="space-y-1">
              {stats.bottomStates.map((state, i) => (
                <div key={state.abbr} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i + 1}. {state.name}</span>
                  <span className="text-sm font-medium text-foreground">
                    {state.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend - neutral colors */}
          <div className="p-4 rounded-md bg-card border border-border">
            <p className="text-sm font-medium text-foreground mb-3">Score Range</p>
            <div className="space-y-1.5">
              {[
                { color: "#4f7f6a", range: "81+", label: "Higher" },
                { color: "#6b9b8a", range: "71-80", label: "" },
                { color: "#8a8a8a", range: "66-70", label: "Mid-range" },
                { color: "#a68b5b", range: "61-65", label: "" },
                { color: "#8a6b5b", range: "≤60", label: "Lower" },
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
