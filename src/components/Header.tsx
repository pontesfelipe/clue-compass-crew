import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, Map, FileText, Settings, User } from "lucide-react";
import { MemberSearch } from "@/components/MemberSearch";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="civic-container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-semibold text-primary">
            CivicScore
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <MemberSearch />
          <Button variant="civic-ghost" size="sm" asChild>
            <Link to="/map">
              <Map className="mr-2 h-4 w-4" />
              Map
            </Link>
          </Button>
          <Button variant="civic-ghost" size="sm" asChild>
            <Link to="/bills">
              <FileText className="mr-2 h-4 w-4" />
              Bills
            </Link>
          </Button>
          <Button variant="civic-ghost" size="sm" asChild>
            <Link to="/preferences">
              <Settings className="mr-2 h-4 w-4" />
              Preferences
            </Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <MemberSearch />
          </div>
          <Button variant="civic-outline" size="sm" className="hidden sm:flex">
            <User className="mr-2 h-4 w-4" />
            Sign In
          </Button>
          <Button variant="civic" size="sm">
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
}
