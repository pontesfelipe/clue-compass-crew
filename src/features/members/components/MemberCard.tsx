/**
 * Member Card Component
 * Displays a member summary card with score and compare functionality
 */

import { Link } from "react-router-dom";
import { ScoreRing } from "@/components/ScoreRing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComparison } from "@/contexts/ComparisonContext";
import { useMemberTracking } from "@/hooks/useMemberTracking";
import { partyColors, partyNames, partyBgColors } from "../types";
import type { Party } from "@/types/domain";

interface MemberCardProps {
  id: string;
  name: string;
  party: Party | "L";
  state: string;
  chamber: "House" | "Senate";
  score: number;
  imageUrl?: string | null;
}

export function MemberCard({ 
  id, 
  name, 
  party, 
  state, 
  chamber, 
  score,
  imageUrl 
}: MemberCardProps) {
  const { addMember, removeMember, isMemberSelected, canAddMore } = useComparison();
  const { isTracking } = useMemberTracking();
  const isSelected = isMemberSelected(id);
  const isMyRep = isTracking(id);

  const handleCompareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSelected) {
      removeMember(id);
    } else if (canAddMore) {
      addMember({
        id,
        name,
        party,
        state,
        chamber,
        imageUrl,
      });
    }
  };

  return (
    <div className="relative group">
      <Link
        to={`/member/${id}`}
        className="block rounded-xl border border-border bg-card p-5 shadow-civic-sm transition-all duration-300 hover:shadow-civic-lg hover:-translate-y-1"
      >
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="h-16 w-16 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted border-2 border-border">
                <span className="text-lg font-semibold text-muted-foreground">
                  {name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
            )}
            <div className={cn(
              "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary-foreground",
              partyBgColors[party] || "bg-muted"
            )}>
              {party}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-semibold text-foreground group-hover:text-primary transition-colors truncate pr-8 flex items-center gap-1.5">
              {name}
              {isMyRep && (
                <Star
                  className="h-4 w-4 text-primary fill-primary flex-shrink-0"
                  aria-label="Tracked member"
                />
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {state} · {chamber}
            </p>
            <Badge 
              variant="outline" 
              className={cn("mt-2 text-xs", partyColors[party])}
            >
              {partyNames[party] || party}
            </Badge>
          </div>

          <ScoreRing score={score} size="sm" />
        </div>
      </Link>
      
      {/* Compare Button */}
      <Button
        variant={isSelected ? "default" : "outline"}
        size="icon"
        className={cn(
          "absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10",
          isSelected && "opacity-100 bg-primary"
        )}
        onClick={handleCompareClick}
        disabled={!isSelected && !canAddMore}
        title={isSelected ? "Remove from comparison" : "Add to comparison"}
      >
        {isSelected ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Scale className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
