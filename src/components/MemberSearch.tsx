import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  full_name: string;
  party: "D" | "R" | "I" | "L";
  state: string;
  chamber: "house" | "senate";
  image_url: string | null;
}

export function MemberSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const searchMembers = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, party, state, chamber, image_url")
        .eq("in_office", true)
        .ilike("full_name", `%${searchQuery}%`)
        .order("full_name")
        .limit(10);

      if (error) throw error;
      setResults((data as SearchResult[]) || []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchMembers(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, searchMembers]);

  const handleSelect = (memberId: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(`/member/${memberId}`);
  };

  const getPartyColor = (party: string) => {
    switch (party) {
      case "D": return "bg-score-average/20 text-score-average border-score-average/30";
      case "R": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getPartyLabel = (party: string) => {
    switch (party) {
      case "D": return "Democrat";
      case "R": return "Republican";
      case "I": return "Independent";
      default: return party;
    }
  };

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="civic-ghost" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Search Members</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search members by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10 h-12 text-base border-0 border-b rounded-none focus-visible:ring-0"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent mr-2" />
              Searching...
            </div>
          )}

          {!isLoading && query.length < 2 && (
            <div className="py-8 text-center text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}

          {!isLoading && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No members found matching "{query}"
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="space-y-1">
              {results.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleSelect(member.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="relative h-10 w-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {member.image_url ? (
                      <img
                        src={member.image_url}
                        alt={member.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {member.full_name}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{member.state}</span>
                      <span>·</span>
                      <span className="capitalize">{member.chamber}</span>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getPartyColor(member.party)}`}
                  >
                    {getPartyLabel(member.party)}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
