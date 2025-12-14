import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, Mail, Phone } from "lucide-react";
import type { Governor } from "../types";

interface GovernorCardProps {
  governor: Governor;
}

const partyColors: Record<string, string> = {
  D: "bg-democrat text-democrat-foreground",
  R: "bg-republican text-republican-foreground",
  I: "bg-independent text-independent-foreground",
};

const partyNames: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

export function GovernorCard({ governor }: GovernorCardProps) {
  const initials = governor.firstName && governor.lastName
    ? `${governor.firstName[0]}${governor.lastName[0]}`
    : governor.name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <Link to={`/governors/${governor.id}`}>
      <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30 overflow-hidden h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-border group-hover:ring-primary/30 transition-all">
              <AvatarImage src={governor.imageUrl || undefined} alt={governor.name} />
              <AvatarFallback className="text-lg font-semibold bg-muted">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {governor.name}
                </h3>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                Governor of {governor.state}
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Badge className={partyColors[governor.party]} variant="secondary">
                  {partyNames[governor.party]}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
            {governor.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Contact
              </span>
            )}
            {governor.capitolPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {governor.capitolPhone}
              </span>
            )}
            {governor.websiteUrl && (
              <span className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Website
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
