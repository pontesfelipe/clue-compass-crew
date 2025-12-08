import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface StateData {
  abbr: string;
  name: string;
  score: number;
}

const statesData: StateData[] = [
  { abbr: "AL", name: "Alabama", score: 62 },
  { abbr: "AK", name: "Alaska", score: 71 },
  { abbr: "AZ", name: "Arizona", score: 68 },
  { abbr: "AR", name: "Arkansas", score: 55 },
  { abbr: "CA", name: "California", score: 74 },
  { abbr: "CO", name: "Colorado", score: 79 },
  { abbr: "CT", name: "Connecticut", score: 72 },
  { abbr: "DE", name: "Delaware", score: 65 },
  { abbr: "FL", name: "Florida", score: 61 },
  { abbr: "GA", name: "Georgia", score: 63 },
  { abbr: "HI", name: "Hawaii", score: 77 },
  { abbr: "ID", name: "Idaho", score: 58 },
  { abbr: "IL", name: "Illinois", score: 69 },
  { abbr: "IN", name: "Indiana", score: 57 },
  { abbr: "IA", name: "Iowa", score: 66 },
  { abbr: "KS", name: "Kansas", score: 60 },
  { abbr: "KY", name: "Kentucky", score: 54 },
  { abbr: "LA", name: "Louisiana", score: 52 },
  { abbr: "ME", name: "Maine", score: 75 },
  { abbr: "MD", name: "Maryland", score: 73 },
  { abbr: "MA", name: "Massachusetts", score: 81 },
  { abbr: "MI", name: "Michigan", score: 67 },
  { abbr: "MN", name: "Minnesota", score: 78 },
  { abbr: "MS", name: "Mississippi", score: 48 },
  { abbr: "MO", name: "Missouri", score: 59 },
  { abbr: "MT", name: "Montana", score: 64 },
  { abbr: "NE", name: "Nebraska", score: 62 },
  { abbr: "NV", name: "Nevada", score: 65 },
  { abbr: "NH", name: "New Hampshire", score: 76 },
  { abbr: "NJ", name: "New Jersey", score: 70 },
  { abbr: "NM", name: "New Mexico", score: 67 },
  { abbr: "NY", name: "New York", score: 72 },
  { abbr: "NC", name: "North Carolina", score: 64 },
  { abbr: "ND", name: "North Dakota", score: 61 },
  { abbr: "OH", name: "Ohio", score: 63 },
  { abbr: "OK", name: "Oklahoma", score: 53 },
  { abbr: "OR", name: "Oregon", score: 75 },
  { abbr: "PA", name: "Pennsylvania", score: 68 },
  { abbr: "RI", name: "Rhode Island", score: 74 },
  { abbr: "SC", name: "South Carolina", score: 56 },
  { abbr: "SD", name: "South Dakota", score: 59 },
  { abbr: "TN", name: "Tennessee", score: 55 },
  { abbr: "TX", name: "Texas", score: 58 },
  { abbr: "UT", name: "Utah", score: 69 },
  { abbr: "VT", name: "Vermont", score: 82 },
  { abbr: "VA", name: "Virginia", score: 71 },
  { abbr: "WA", name: "Washington", score: 77 },
  { abbr: "WV", name: "West Virginia", score: 49 },
  { abbr: "WI", name: "Wisconsin", score: 70 },
  { abbr: "WY", name: "Wyoming", score: 57 },
];

const getScoreColor = (score: number): string => {
  if (score >= 80) return "#22c55e";
  if (score >= 70) return "#84cc16";
  if (score >= 60) return "#eab308";
  if (score >= 50) return "#f97316";
  return "#ef4444";
};

interface USMapProps {
  onStateClick?: (stateAbbr: string) => void;
}

export function USMap({ onStateClick }: USMapProps) {
  const navigate = useNavigate();
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  const handleStateClick = (abbr: string) => {
    if (onStateClick) {
      onStateClick(abbr);
    } else {
      navigate(`/state/${abbr}`);
    }
  };

  const hoveredData = hoveredState 
    ? statesData.find(s => s.abbr === hoveredState) 
    : null;

  // Simplified state grid positions for a clean cartogram
  const stateGrid: { [key: string]: { col: number; row: number } } = {
    AK: { col: 0, row: 0 }, HI: { col: 0, row: 4 },
    WA: { col: 1, row: 0 }, OR: { col: 1, row: 1 }, CA: { col: 1, row: 2 },
    ID: { col: 2, row: 0 }, NV: { col: 2, row: 1 }, AZ: { col: 2, row: 2 },
    MT: { col: 3, row: 0 }, UT: { col: 3, row: 1 }, NM: { col: 3, row: 2 },
    WY: { col: 4, row: 0 }, CO: { col: 4, row: 1 }, TX: { col: 4, row: 3 },
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
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 rounded-lg bg-card border border-border shadow-civic-md p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Average Score</p>
        <div className="flex gap-1">
          {[
            { color: "#ef4444", label: "<50" },
            { color: "#f97316", label: "50+" },
            { color: "#eab308", label: "60+" },
            { color: "#84cc16", label: "70+" },
            { color: "#22c55e", label: "80+" },
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
              const state = statesData.find(s => {
                const pos = stateGrid[s.abbr];
                return pos && pos.row === rowIndex && pos.col === colIndex;
              });

              if (!state) {
                return <div key={`${rowIndex}-${colIndex}`} className="w-full aspect-square" />;
              }

              return (
                <button
                  key={state.abbr}
                  onClick={() => handleStateClick(state.abbr)}
                  onMouseEnter={() => setHoveredState(state.abbr)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={cn(
                    "w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110 hover:z-10 shadow-civic-sm",
                    hoveredState === state.abbr && "ring-2 ring-primary ring-offset-2"
                  )}
                  style={{ 
                    backgroundColor: getScoreColor(state.score),
                    color: state.score >= 60 ? "#1a1a2e" : "#ffffff"
                  }}
                >
                  {state.abbr}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
