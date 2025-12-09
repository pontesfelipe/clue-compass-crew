import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStateScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";

const getScoreColor = (score: number): string => {
  if (score >= 80) return "#22c55e";
  if (score >= 70) return "#84cc16";
  if (score >= 60) return "#eab308";
  if (score >= 50) return "#f97316";
  return "#ef4444";
};

// --- statePaths object unchanged (keep exactly as you have it) ---
const statePaths: Record<string, { d: string; name: string }> = {
  // ... your existing state path definitions ...
};

const USMap = () => {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const navigate = useNavigate();
  const { data: stateScores, isLoading } = useStateScores();

  const handleStateClick = (stateCode: string) => {
    navigate(`/state/${stateCode}`);
  };

  if (isLoading) {
    return (
      <div className="w-full aspect-[1.6/1] flex items-center justify-center">
        <Skeleton className="w-full h-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <svg
        // FIX 1: use the native coordinate system of the paths
        viewBox="0 0 959 593"
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--background))" />
            <stop offset="100%" stopColor="hsl(var(--muted))" />
          </linearGradient>
          <filter id="stateShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.1" />
          </filter>
          <filter id="stateHover" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Map background aligned to full viewBox */}
        <rect x="0" y="0" width="959" height="593" fill="url(#mapBg)" rx="12" />

        {/* States */}
        {Object.entries(statePaths).map(([stateCode, { d, name }]) => {
          if (!d) return null;

          const stateData = stateScores?.find((s) => s.abbr === stateCode);
          const score = stateData?.score ?? 0;
          const isHovered = hoveredState === stateCode;
          const fillColor = score > 0 ? getScoreColor(score) : "hsl(var(--muted-foreground) / 0.3)";

          return (
            <path
              key={stateCode}
              d={d}
              fill={fillColor}
              stroke="hsl(var(--background))"
              strokeWidth={isHovered ? 2 : 1}
              strokeLinejoin="round"
              className="cursor-pointer transition-all duration-150"
              style={{
                filter: isHovered ? "url(#stateHover)" : "url(#stateShadow)",
                opacity: isHovered ? 1 : 0.95,
                // FIX 2: remove scale transform to avoid jumping/layout issues
                // If you really want scale, also set transformBox: "fill-box"
              }}
              onMouseEnter={() => setHoveredState(stateCode)}
              onMouseLeave={() => setHoveredState(null)}
              onClick={() => handleStateClick(stateCode)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredState && stateScores && (
        <div
          className="absolute pointer-events-none z-10 bg-card border border-border rounded-lg shadow-xl px-4 py-3 text-sm"
          style={{
            left: "50%",
            top: "16px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-foreground">{statePaths[hoveredState]?.name || hoveredState}</div>
          <div className="text-muted-foreground mt-1">
            {(() => {
              const stateData = stateScores.find((s) => s.abbr === hoveredState);
              if (stateData && stateData.score > 0) {
                return (
                  <div className="flex items-center gap-2">
                    <span>Avg Score:</span>
                    <span className="font-bold" style={{ color: getScoreColor(stateData.score) }}>
                      {stateData.score}
                    </span>
                    <span className="text-xs text-muted-foreground">({stateData.memberCount} members)</span>
                  </div>
                );
              }
              return "No data available";
            })()}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-6 flex-wrap">
        {[
          { color: "#22c55e", label: "80+ Excellent" },
          { color: "#84cc16", label: "70-79 Good" },
          { color: "#eab308", label: "60-69 Average" },
          { color: "#f97316", label: "50-59 Poor" },
          { color: "#ef4444", label: "<50 Needs Work" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default USMap;
