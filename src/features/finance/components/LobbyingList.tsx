import { Building } from "lucide-react";
import { formatCurrency, type Lobbying } from "../types";

interface LobbyingListProps {
  lobbying: Lobbying[];
}

export function LobbyingList({ lobbying }: LobbyingListProps) {
  if (lobbying.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No lobbying data available.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Data will be synced from public records.
        </p>
      </div>
    );
  }

  // Calculate max for relative bar widths
  const maxSpent = Math.max(...lobbying.map((l) => l.totalSpent));

  return (
    <div className="space-y-4">
      {lobbying.map((item, index) => (
        <div
          key={item.id}
          className="opacity-0 animate-slide-up"
          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground truncate">
                {item.industry}
              </span>
            </div>
            <div className="text-right ml-4">
              <span className="font-semibold text-foreground">
                {formatCurrency(item.totalSpent)}
              </span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-civic-gold h-2 rounded-full transition-all duration-500"
              style={{ width: `${(item.totalSpent / maxSpent) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {item.clientCount} clients · {item.cycle} cycle
          </p>
        </div>
      ))}
    </div>
  );
}
