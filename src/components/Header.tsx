import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, Map, FileText, Scale, User, Vote, LogOut, Shield, UserCircle } from "lucide-react";
import { MemberSearch } from "@/components/MemberSearch";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, isAuthenticated, signOut } = useAuth();
  const { isAdmin } = useAdmin();

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
            <Link to="/votes">
              <Vote className="mr-2 h-4 w-4" />
              Votes
            </Link>
          </Button>
          <Button variant="civic-ghost" size="sm" asChild>
            <Link to="/compare">
              <Scale className="mr-2 h-4 w-4" />
              Compare
            </Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <MemberSearch />
          </div>
          
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="civic-outline" size="sm" className="hidden sm:flex">
                  <User className="mr-2 h-4 w-4" />
                  {user?.email?.split("@")[0] || "Account"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-profile" className="flex items-center">
                    <UserCircle className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="civic-outline" size="sm" className="hidden sm:flex" asChild>
                <Link to="/auth">
                  <User className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
              <Button variant="civic" size="sm" asChild>
                <Link to="/auth">
                  Get Started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}