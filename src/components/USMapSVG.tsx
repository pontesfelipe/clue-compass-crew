import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import USAMap from "react-usa-map";
import { useStateScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Award } from "lucide-react";

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

// Territories
const TERRITORIES = ["DC", "PR", "VI", "GU", "AS", "MP"];

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
                {TERRITORIES.includes(hoveredState!) ? 'Delegate' : 'Members'}
              </span>
              <span className="text-sm font-medium">{hoveredStateData.memberCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* SVG Map */}
      <div 
        className="p-4 [&_path]:cursor-pointer [&_path]:transition-opacity [&_path:hover]:opacity-70 [&_path]:stroke-background [&_path]:stroke-[0.5]"
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
