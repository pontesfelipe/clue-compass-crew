import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import USAMap from "react-usa-map";
import { useStateScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Award, MapPin } from "lucide-react";

// Score color scale: higher = more green (better score)
const getScoreColor = (score: number | null): string => {
  if (score === null) return "#d1d5db"; // muted gray
  if (score >= 81) return "#16a34a";  // Excellent - dark green
  if (score >= 71) return "#22c55e";  // Good - light green
  if (score >= 66) return "#f59e0b";  // Average - amber
  if (score >= 61) return "#f97316";  // Below average - orange
  return "#dc2626";                    // Below 60 - red
};

// State name lookup
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia"
};

// Approximate state label positions (percentage based, centered in each state)
const STATE_LABEL_POSITIONS: Record<string, { x: number; y: number }> = {
  AL: { x: 66, y: 66 },
  AK: { x: 17, y: 83 },
  AZ: { x: 22, y: 58 },
  AR: { x: 55, y: 58 },
  CA: { x: 9, y: 48 },
  CO: { x: 31, y: 46 },
  CT: { x: 89.5, y: 33 },
  DE: { x: 85, y: 43 },
  FL: { x: 76, y: 76 },
  GA: { x: 71, y: 63 },
  HI: { x: 27, y: 88 },
  ID: { x: 19, y: 28 },
  IL: { x: 61, y: 44 },
  IN: { x: 66, y: 44 },
  IA: { x: 53, y: 38 },
  KS: { x: 43, y: 50 },
  KY: { x: 69, y: 50 },
  LA: { x: 56, y: 71 },
  ME: { x: 92, y: 17 },
  MD: { x: 82, y: 44 },
  MA: { x: 90, y: 29 },
  MI: { x: 68, y: 32 },
  MN: { x: 53, y: 26 },
  MS: { x: 61, y: 65 },
  MO: { x: 55, y: 50 },
  MT: { x: 27, y: 21 },
  NE: { x: 42, y: 40 },
  NV: { x: 14, y: 42 },
  NH: { x: 90, y: 24 },
  NJ: { x: 86, y: 39 },
  NM: { x: 28, y: 58 },
  NY: { x: 84, y: 30 },
  NC: { x: 77, y: 55 },
  ND: { x: 43, y: 23 },
  OH: { x: 71, y: 42 },
  OK: { x: 45, y: 56 },
  OR: { x: 12, y: 26 },
  PA: { x: 80, y: 37 },
  RI: { x: 91, y: 31 },
  SC: { x: 75, y: 59 },
  SD: { x: 43, y: 30 },
  TN: { x: 67, y: 54 },
  TX: { x: 40, y: 68 },
  UT: { x: 21, y: 44 },
  VT: { x: 88, y: 22 },
  VA: { x: 79, y: 48 },
  WA: { x: 13, y: 16 },
  WV: { x: 76, y: 46 },
  WI: { x: 59, y: 30 },
  WY: { x: 29, y: 34 },
  DC: { x: 84, y: 46 }
};

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

interface USMapSVGProps {
  onStateClick?: (stateAbbr: string) => void;
  showStats?: boolean;
}

export function USMapSVG({ onStateClick, showStats = true }: USMapSVGProps) {
  const navigate = useNavigate();
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  
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

  const handleLabelClick = (abbr: string) => {
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

    // Sort by score
    const sortedByScore = [...validStates].sort((a, b) => (b.score || 0) - (a.score || 0));
    const topStates = sortedByScore.slice(0, 3);
    const bottomStates = sortedByScore.slice(-3).reverse();

    return { avgScore, topStates, bottomStates, statesWithData: validStates.length };
  }, [stateScores]);

  if (isLoading) {
    return (
      <div className="relative w-full p-4">
        <Skeleton className="w-full h-[400px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Tooltip */}
      {hoveredStateData && (
        <div className="absolute top-4 left-4 z-20 rounded-lg bg-card border border-border shadow-civic-lg p-4 min-w-[200px] animate-scale-in pointer-events-none">
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

      {/* SVG Map with Labels */}
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
        
        {/* State Abbreviation Labels Overlay */}
        <div className="absolute inset-0 pointer-events-none p-4">
          {Object.entries(STATE_LABEL_POSITIONS).map(([abbr, pos]) => (
            <div
              key={abbr}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => handleLabelClick(abbr)}
              onMouseEnter={() => setHoveredState(abbr)}
              onMouseLeave={() => setHoveredState(null)}
            >
              <span 
                className={`text-[8px] sm:text-[10px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-transform ${
                  hoveredState === abbr ? "scale-125" : ""
                }`}
                style={{ color: "white", textShadow: "0 0 3px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.5)" }}
              >
                {abbr}
              </span>
            </div>
          ))}
        </div>
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
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                <div className="font-medium text-foreground">{territory.name}</div>
                <div className="text-muted-foreground">Score: {territory.score ?? "No data"}</div>
              </div>
            </button>
          ))}
        </div>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
