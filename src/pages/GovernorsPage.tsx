import { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GovernorCard, useGovernors } from "@/features/governors";

export default function GovernorsPage() {
  const { data: governors, isLoading, error } = useGovernors();
  const [search, setSearch] = useState("");

  const filteredGovernors = useMemo(() => {
    if (!governors) return [];
    if (!search.trim()) return governors;
    
    const query = search.toLowerCase();
    return governors.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        g.state.toLowerCase().includes(query)
    );
  }, [governors, search]);

  const partyBreakdown = useMemo(() => {
    if (!governors) return { D: 0, R: 0, I: 0 };
    return governors.reduce(
      (acc, g) => {
        acc[g.party] = (acc[g.party] || 0) + 1;
        return acc;
      },
      { D: 0, R: 0, I: 0 } as Record<string, number>
    );
  }, [governors]);

  return (
    <>
      <Helmet>
        <title>U.S. Governors | CivicScore</title>
        <meta
          name="description"
          content="Explore all 50 U.S. state governors with contact information and party affiliation."
        />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">
                  U.S. Governors
                </h1>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  Work in Progress
                </Badge>
              </div>
              <p className="text-muted-foreground">
                All 50 state governors with contact information and party affiliation.
                More features coming soon, including governance scores and detailed profiles.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {governors?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Governors</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-democrat">
                  {partyBreakdown.D}
                </div>
                <div className="text-sm text-muted-foreground">Democrats</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-republican">
                  {partyBreakdown.R}
                </div>
                <div className="text-sm text-muted-foreground">Republicans</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-independent">
                  {partyBreakdown.I}
                </div>
                <div className="text-sm text-muted-foreground">Independent</div>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Results count */}
            {search && (
              <p className="text-sm text-muted-foreground mb-4">
                Showing {filteredGovernors.length} of {governors?.length || 0} governors
              </p>
            )}

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive">Failed to load governors</p>
              </div>
            ) : filteredGovernors.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No governors found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGovernors.map((governor) => (
                  <GovernorCard key={governor.id} governor={governor} />
                ))}
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
