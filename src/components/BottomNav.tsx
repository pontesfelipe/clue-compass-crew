import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Map, FileText, Scale, Vote, Heart } from "lucide-react";

const bottomNavItems = [
  { to: "/map", icon: Map, label: "Map" },
  { to: "/bills", icon: FileText, label: "Bills" },
  { to: "/compare", icon: Scale, label: "Compare" },
  { to: "/votes", icon: Vote, label: "Votes" },
  { to: "/my-matches", icon: Heart, label: "Matches" },
];

export function BottomNav() {
  const location = useLocation();

  // Don't show on admin or auth pages
  if (location.pathname.startsWith("/admin") || location.pathname === "/auth") {
    return null;
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== "/" && location.pathname.startsWith(item.to));
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-lg transition-colors touch-target",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:text-foreground"
              )}
            >
              <item.icon 
                className={cn(
                  "h-5 w-5 transition-transform active:scale-95",
                  isActive && "text-primary"
                )} 
              />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
