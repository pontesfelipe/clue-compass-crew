import { Link } from "react-router-dom";
import { ScoreRing } from "./ScoreRing";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MemberCardProps {
  id: string;
  name: string;
  party: "D" | "R" | "I";
  state: string;
  chamber: "House" | "Senate";
  score: number;
  imageUrl?: string;
}

const partyColors = {
  D: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  R: "bg-civic-red/10 text-civic-red border-civic-red/30",
  I: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
};

const partyNames = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

export function MemberCard({ 
  id, 
  name, 
  party, 
  state, 
  chamber, 
  score,
  imageUrl 
}: MemberCardProps) {
  return (
    <Link
      to={`/member/${id}`}
      className="group block rounded-xl border border-border bg-card p-5 shadow-civic-sm transition-all duration-300 hover:shadow-civic-lg hover:-translate-y-1"
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
            "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold",
            party === "D" && "bg-civic-blue text-primary-foreground",
            party === "R" && "bg-civic-red text-primary-foreground",
            party === "I" && "bg-civic-slate text-primary-foreground"
          )}>
            {party}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {state} · {chamber}
          </p>
          <Badge 
            variant="outline" 
            className={cn("mt-2 text-xs", partyColors[party])}
          >
            {partyNames[party]}
          </Badge>
        </div>

        <ScoreRing score={score} size="sm" />
      </div>
    </Link>
  );
}
