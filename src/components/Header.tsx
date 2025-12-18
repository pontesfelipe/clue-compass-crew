import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Map, FileText, Scale, User, Vote, LogOut, Shield, UserCircle, Heart, Bookmark, RotateCcw, Newspaper, Landmark, Menu } from "lucide-react";
import { MemberSearch } from "@/components/MemberSearch";
import { CivicScoreLogo } from "@/components/CivicScoreLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { ResetProfileDialog } from "@/components/ResetProfileDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { to: "/map", icon: Map, label: "Map" },
  { to: "/bills", icon: FileText, label: "Bills" },
  { to: "/votes", icon: Vote, label: "Votes" },
  { to: "/compare", icon: Scale, label: "Compare" },
  { to: "/news", icon: Newspaper, label: "News" },
  { to: "/governors", icon: Landmark, label: "Governors" },
  { to: "/my-matches", icon: Heart, label: "My Matches" },
  { to: "/tracked-members", icon: Bookmark, label: "Tracked" },
];

export function Header() {
  const { user, isAuthenticated, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="civic-container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle>
                  <CivicScoreLogo size="sm" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col p-4">
                <div className="mb-4">
                  <MemberSearch />
                </div>
                <div className="flex flex-col gap-1">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={closeMobileMenu}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
                
                {/* Auth section in mobile menu */}
                <div className="mt-4 border-t pt-4">
                  {isAuthenticated ? (
                    <div className="flex flex-col gap-1">
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        {user?.email}
                      </div>
                      <Link
                        to="/my-profile"
                        onClick={closeMobileMenu}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          location.pathname === "/my-profile"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <UserCircle className="h-4 w-4" />
                        My Profile
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={closeMobileMenu}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                            location.pathname.startsWith("/admin")
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Shield className="h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          signOut();
                          closeMobileMenu();
                        }}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button variant="civic-outline" asChild className="w-full" onClick={closeMobileMenu}>
                        <Link to="/auth">
                          <User className="mr-2 h-4 w-4" />
                          Sign In
                        </Link>
                      </Button>
                      <Button variant="civic" asChild className="w-full" onClick={closeMobileMenu}>
                        <Link to="/auth">
                          Get Started
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="flex items-center">
            <CivicScoreLogo size="md" />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          <MemberSearch />
          {navItems.map((item) => (
            <Button key={item.to} variant="civic-ghost" size="sm" asChild>
              <Link to={item.to}>
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>

        {/* Desktop Auth */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="civic-outline" size="sm" className="hidden md:flex">
                  <User className="mr-2 h-4 w-4" />
                  {user?.email?.split("@")[0] || "Account"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover">
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
                <DropdownMenuItem asChild>
                  <Link to="/tracked-members" className="flex items-center">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Tracked Members
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
                <ResetProfileDialog
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset Profile Data
                    </DropdownMenuItem>
                  }
                />
                <DeleteAccountDialog />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="civic" size="sm" asChild className="hidden md:flex">
              <Link to="/auth">
                Get Started
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
