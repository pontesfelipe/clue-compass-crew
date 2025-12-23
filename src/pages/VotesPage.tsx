import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { VoteDetailDialog } from "@/components/VoteDetailDialog";
import { CompactPartyBreakdown } from "@/components/CompactPartyBreakdown";
import { Vote, Calendar, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Helmet } from "react-helmet";

const ITEMS_PER_PAGE = 20;

interface PartyVoteData {
  party: "D" | "R" | "I" | "L";
  yea: number;
  nay: number;
}

export default function VotesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chamberFilter, setChamberFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [policyAreaFilter, setPolicyAreaFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all policy areas from bills (since most votes aren't linked yet, show all available)
  const { data: policyAreas } = useQuery({
    queryKey: ["vote-policy-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("policy_area")
        .not("policy_area", "is", null);

      if (error) throw error;
      
      const areas = data
        .map((b: any) => b.policy_area)
        .filter(Boolean);
      return [...new Set(areas)].sort() as string[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["votes-paginated", debouncedSearch, chamberFilter, resultFilter, policyAreaFilter, dateFrom, dateTo, currentPage],
    queryFn: async () => {
      // Build query with server-side filters
      let query = supabase
        .from("votes")
        .select(`
          *,
          bills (
            id,
            title,
            short_title,
            bill_type,
            bill_number,
            policy_area
          )
        `, { count: "exact" });

      // Chamber filter
      if (chamberFilter !== "all") {
        query = query.eq("chamber", chamberFilter as "house" | "senate");
      }

      // Result filter
      if (resultFilter === "passed") {
        query = query.ilike("result", "%passed%");
      } else if (resultFilter === "failed") {
        query = query.ilike("result", "%failed%");
      }

      // Date filters
      if (dateFrom) {
        query = query.gte("vote_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("vote_date", dateTo);
      }

      // Policy area filter - filter by related bill's policy area
      if (policyAreaFilter !== "all") {
        query = query.eq("bills.policy_area", policyAreaFilter);
      }

      // Search filter - search in question and description
      if (debouncedSearch) {
        query = query.or(`question.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }

      // Order and paginate
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const { data: votesData, error: votesError, count } = await query
        .order("vote_date", { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      if (votesError) throw votesError;

      // Fetch party breakdown for visible votes
      const voteIds = votesData?.map(v => v.id) || [];
      
      if (voteIds.length === 0) return { votes: [], totalCount: 0 };

      const { data: memberVotes, error: mvError } = await supabase
        .from("member_votes")
        .select(`
          vote_id,
          position,
          members (party)
        `)
        .in("vote_id", voteIds);

      if (mvError) throw mvError;

      // Aggregate party data per vote
      const partyDataByVote: Record<string, Record<string, { yea: number; nay: number }>> = {};
      
      for (const mv of memberVotes || []) {
        const party = (mv.members as any)?.party;
        if (!party || !mv.vote_id) continue;
        
        if (!partyDataByVote[mv.vote_id]) {
          partyDataByVote[mv.vote_id] = {};
        }
        if (!partyDataByVote[mv.vote_id][party]) {
          partyDataByVote[mv.vote_id][party] = { yea: 0, nay: 0 };
        }
        
        if (mv.position === "yea") {
          partyDataByVote[mv.vote_id][party].yea++;
        } else if (mv.position === "nay") {
          partyDataByVote[mv.vote_id][party].nay++;
        }
      }

      // Attach party data to votes
      const votes = votesData?.map(vote => ({
        ...vote,
        partyBreakdown: Object.entries(partyDataByVote[vote.id] || {})
          .map(([party, data]) => ({ party: party as "D" | "R" | "I" | "L", ...data }))
          .sort((a, b) => {
            const order = { D: 0, R: 1, I: 2, L: 3 };
            return (order[a.party] ?? 4) - (order[b.party] ?? 4);
          })
      })) || [];

      return { votes, totalCount: count || 0 };
    },
  });

  const votes = data?.votes || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const resetFilters = () => {
    setSearchQuery("");
    setChamberFilter("all");
    setResultFilter("all");
    setPolicyAreaFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || chamberFilter !== "all" || resultFilter !== "all" || policyAreaFilter !== "all" || dateFrom || dateTo;

  return (
    <>
      <Helmet>
        <title>Congressional Votes | CivicScore</title>
        <meta name="description" content="Browse all congressional votes with filtering by date, chamber, and result. Track how your representatives vote on important legislation." />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 civic-container py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Vote className="h-6 w-6 text-primary" />
              </div>
              <h1 className="font-serif text-3xl font-bold text-foreground">
                Congressional Votes
              </h1>
            </div>
            <p className="text-muted-foreground">
              Browse and filter all congressional roll call votes
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* Search */}
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search votes..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>

                {/* Chamber Filter */}
                <Select
                  value={chamberFilter}
                  onValueChange={(value) => {
                    setChamberFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chamber" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chambers</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="senate">Senate</SelectItem>
                  </SelectContent>
                </Select>

                {/* Result Filter */}
                <Select
                  value={resultFilter}
                  onValueChange={(value) => {
                    setResultFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                {/* Policy Area Filter */}
                <Select
                  value={policyAreaFilter}
                  onValueChange={(value) => {
                    setPolicyAreaFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Policy Area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Policy Areas</SelectItem>
                    {policyAreas?.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="outline" onClick={resetFilters} className="w-full">
                    Reset Filters
                  </Button>
                )}
              </div>

              {/* Date Range */}
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Date Range:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-auto"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-auto"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Count */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount} vote{totalCount !== 1 ? "s" : ""} found
            </p>
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>

          {/* Votes List */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : votes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg text-foreground mb-2">No votes found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters to find what you're looking for.
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={resetFilters}>
                    Reset Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {votes.map((vote) => {
                const isPassed = vote.result?.toLowerCase().includes("passed");
                const isFailed = vote.result?.toLowerCase().includes("failed");

                return (
                  <Card
                    key={vote.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                    onClick={() => setSelectedVoteId(vote.id)}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-3">
                        {/* Vote Title */}
                        <div>
                          <h3 className="font-semibold text-foreground line-clamp-2">
                            {vote.question || `Roll Call #${vote.roll_number}`}
                          </h3>
                          {vote.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {vote.description}
                            </p>
                          )}
                        </div>

                        {/* Meta Info */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {vote.chamber}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              isPassed
                                ? "bg-score-excellent/10 text-score-excellent border-score-excellent/30"
                                : isFailed
                                ? "bg-score-bad/10 text-score-bad border-score-bad/30"
                                : ""
                            }
                          >
                            {vote.result || "Unknown"}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {vote.vote_date
                              ? format(new Date(vote.vote_date), "MMM d, yyyy")
                              : "Unknown date"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Roll #{vote.roll_number}
                          </span>
                        </div>

                        {/* Vote Totals */}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-score-excellent font-medium">
                            {vote.total_yea || 0} Yea
                          </span>
                          <span className="text-score-bad font-medium">
                            {vote.total_nay || 0} Nay
                          </span>
                          {(vote.total_present || 0) > 0 && (
                            <span className="text-muted-foreground">
                              {vote.total_present} Present
                            </span>
                          )}
                          {(vote.total_not_voting || 0) > 0 && (
                            <span className="text-muted-foreground">
                              {vote.total_not_voting} Not Voting
                            </span>
                          )}
                        </div>

                        {/* Party Breakdown */}
                        {vote.partyBreakdown && vote.partyBreakdown.length > 0 && (
                          <CompactPartyBreakdown partyData={vote.partyBreakdown} />
                        )}

                        {/* Policy Area Tag */}
                        {vote.bills?.policy_area && (
                          <Badge variant="secondary" className="w-fit text-xs">
                            {vote.bills.policy_area}
                          </Badge>
                        )}

                        {/* Related Bill */}
                        {vote.bills && (
                          <p className="text-sm text-muted-foreground">
                            Related: {vote.bills.short_title || vote.bills.title}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </main>

        <Footer />
      </div>

      <VoteDetailDialog
        voteId={selectedVoteId}
        onClose={() => setSelectedVoteId(null)}
      />
    </>
  );
}