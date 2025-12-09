import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStateScores } from "@/hooks/useStateData";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return "bg-green-500";
  if (score >= 70) return "bg-lime-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 50) return "bg-orange-500";
  return "bg-red-500";
};

const getScoreTextColor = (score: number): string => {
  if (score >= 80) return "text-green-500";
  if (score >= 70) return "text-lime-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 50) return "text-orange-500";
  return "text-red-500";
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 60) return "Average";
  if (score >= 50) return "Poor";
  return "Needs Work";
};

type SortField = "name" | "score" | "members";
type SortOrder = "asc" | "desc";

const StateGrid = () => {
  const navigate = useNavigate();
  const { data: stateScores, isLoading } = useStateScores();
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 50 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const allStates = Object.entries(STATE_NAMES).map(([abbr, name]) => {
    const stateData = stateScores?.find((s) => s.abbr === abbr);
    return {
      abbr,
      name,
      score: stateData?.score ?? 0,
      memberCount: stateData?.memberCount ?? 0,
    };
  });

  const sortedStates = [...allStates].sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === "score") {
      comparison = a.score - b.score;
    } else if (sortField === "members") {
      comparison = a.memberCount - b.memberCount;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return (
    <div className="space-y-6">
      {/* Sort Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Button
          variant={sortField === "name" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleSort("name")}
          className="gap-1"
        >
          Name
          {sortField === "name" && <ArrowUpDown className="h-3 w-3" />}
        </Button>
        <Button
          variant={sortField === "score" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleSort("score")}
          className="gap-1"
        >
          Score
          {sortField === "score" && (
            sortOrder === "desc" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant={sortField === "members" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleSort("members")}
          className="gap-1"
        >
          Members
          {sortField === "members" && <ArrowUpDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* State Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {sortedStates.map(({ abbr, name, score, memberCount }) => (
          <button
            key={abbr}
            onClick={() => navigate(`/state/${abbr}`)}
            className="group relative bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
          >
            {/* Score indicator bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${score > 0 ? getScoreColor(score) : "bg-muted"}`} />
            
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-foreground">{abbr}</span>
                {score > 0 && (
                  <span className={`text-xl font-bold ${getScoreTextColor(score)}`}>
                    {score}
                  </span>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground truncate">{name}</div>
              
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </span>
                {score > 0 && (
                  <span className={`font-medium ${getScoreTextColor(score)}`}>
                    {getScoreLabel(score)}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 flex-wrap pt-4 border-t border-border">
        {[
          { color: "bg-green-500", label: "80+ Excellent" },
          { color: "bg-lime-500", label: "70-79 Good" },
          { color: "bg-yellow-500", label: "60-69 Average" },
          { color: "bg-orange-500", label: "50-59 Poor" },
          { color: "bg-red-500", label: "<50 Needs Work" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <div className={`w-4 h-4 rounded ${color}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StateGrid;
