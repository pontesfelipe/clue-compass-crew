import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  FileText, 
  Filter,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBills, usePolicyAreas, useCongressSessions, BillListItem } from "@/hooks/useBills";
import { formatBillNumber } from "@/hooks/useBill";
import { useDebounce } from "@/hooks/useDebounce";

const ITEMS_PER_PAGE = 20;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function BillCard({ bill }: { bill: BillListItem }) {
  const billNumber = formatBillNumber(bill);
  
  return (
    <Link
      to={`/bill/${bill.id}`}
      className="block rounded-xl border border-border bg-card p-5 shadow-civic-sm hover:shadow-civic-md hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs font-mono">
            {billNumber}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {bill.congress}th Congress
          </Badge>
          {bill.enacted && (
            <Badge className="bg-score-excellent/10 text-score-excellent border-score-excellent/30 text-xs">
              <CheckCircle className="mr-1 h-3 w-3" />
              Enacted
            </Badge>
          )}
        </div>
      </div>
      
      <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
        {bill.short_title || bill.title}
      </h3>
      
      {bill.policy_area && (
        <Badge variant="outline" className="text-xs mb-3">
          {bill.policy_area}
        </Badge>
      )}
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Last action: {formatDate(bill.latest_action_date)}</span>
      </div>
      
      {bill.latest_action_text && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
          {bill.latest_action_text}
        </p>
      )}
    </Link>
  );
}

export default function BillsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [policyArea, setPolicyArea] = useState<string>("all");
  const [congress, setCongress] = useState<string>("all");
  const [enacted, setEnacted] = useState<string>("all");
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: policyAreas } = usePolicyAreas();
  const { data: congressSessions } = useCongressSessions();

  const { data, isLoading } = useBills({
    search: debouncedSearch || undefined,
    policyArea: policyArea !== "all" ? policyArea : undefined,
    congress: congress !== "all" ? parseInt(congress) : undefined,
    enacted: enacted === "all" ? null : enacted === "true",
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
  });

  const totalPages = useMemo(() => {
    return Math.ceil((data?.totalCount || 0) / ITEMS_PER_PAGE);
  }, [data?.totalCount]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(0);
  };

  const handleFilterChange = () => {
    setPage(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
                Bills
              </h1>
              <p className="text-muted-foreground">
                Browse and search congressional legislation
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="rounded-xl border border-border bg-card p-4 mb-8 shadow-civic-sm">
          <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bills by title or keyword..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select 
                value={policyArea} 
                onValueChange={(v) => { setPolicyArea(v); handleFilterChange(); }}
              >
                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                  <SelectValue placeholder="Policy Area" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50 max-h-60">
                  <SelectItem value="all">All Policy Areas</SelectItem>
                  {policyAreas?.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={congress} 
                onValueChange={(v) => { setCongress(v); handleFilterChange(); }}
              >
                <SelectTrigger className="w-full sm:w-[160px] bg-background">
                  <SelectValue placeholder="Congress" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="all">All Sessions</SelectItem>
                  {congressSessions?.map((session) => (
                    <SelectItem key={session} value={session.toString()}>
                      {session}th Congress
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={enacted} 
                onValueChange={(v) => { setEnacted(v); handleFilterChange(); }}
              >
                <SelectTrigger className="w-full sm:w-[140px] bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Enacted</SelectItem>
                  <SelectItem value="false">Not Enacted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              "Loading..."
            ) : (
              <>Showing {data?.bills.length || 0} of {data?.totalCount || 0} bills</>
            )}
          </p>
        </div>

        {/* Bills Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-5 w-24 mb-3" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : data?.bills.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No bills found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.bills.map((bill) => (
              <BillCard key={bill.id} bill={bill} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
