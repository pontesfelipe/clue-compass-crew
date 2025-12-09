import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Scale } from "lucide-react";
import { useComparison } from "@/contexts/ComparisonContext";
import { cn } from "@/lib/utils";

const partyColors: Record<string, string> = {
  D: "bg-civic-blue",
  R: "bg-civic-red",
  I: "bg-civic-slate",
  L: "bg-civic-gold",
};

export function ComparisonBar() {
  const { members, removeMember, clearMembers } = useComparison();

  if (members.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur shadow-lg animate-fade-in">
      <div className="civic-container py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Compare:</span>
            </div>
            <div className="flex items-center gap-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 rounded-full border border-border bg-background pl-1 pr-2 py-1"
                >
                  <div className="relative h-6 w-6 rounded-full bg-muted overflow-hidden shrink-0">
                    {member.imageUrl ? (
                      <img
                        src={member.imageUrl}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className={cn("h-full w-full", partyColors[member.party])} />
                    )}
                  </div>
                  <span className="text-xs font-medium truncate max-w-[100px]">
                    {member.name.split(",")[0]}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {member.party}
                  </Badge>
                  <button
                    onClick={() => removeMember(member.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={clearMembers}>
              Clear
            </Button>
            <Button variant="civic" size="sm" asChild disabled={members.length < 2}>
              <Link to="/compare">
                Compare ({members.length})
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
