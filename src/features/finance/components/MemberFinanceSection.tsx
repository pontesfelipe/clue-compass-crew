import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Building, Building2, Users, TrendingUp, Calendar } from "lucide-react";
import { useMemberFinance } from "../hooks/useMemberFinance";
import { FinanceOverview } from "./FinanceOverview";
import { ContributorsList } from "./ContributorsList";
import { LobbyingList } from "./LobbyingList";
import { SponsorsList } from "./SponsorsList";
import { ContributionTrendsChart } from "./ContributionTrendsChart";

interface MemberFinanceSectionProps {
  memberId: string;
}

export function MemberFinanceSection({ memberId }: MemberFinanceSectionProps) {
  const { data: finance, isLoading } = useMemberFinance(memberId);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  // Get all available years from the data
  const availableYears = useMemo(() => {
    if (!finance) return [];
    const yearSet = new Set<number>();
    finance.contributions.forEach((c) => yearSet.add(c.cycle));
    finance.lobbying.forEach((l) => yearSet.add(l.cycle));
    finance.sponsors.forEach((s) => yearSet.add(s.cycle));
    return Array.from(yearSet).sort((a, b) => b - a); // Most recent first
  }, [finance]);

  // Derive effective selected year - default to latest available year
  const effectiveYear = useMemo(() => {
    if (selectedYear !== null) return selectedYear;
    if (availableYears.length > 0) return availableYears[0].toString();
    return "all";
  }, [selectedYear, availableYears]);

  // Filter data by selected year
  const filteredFinance = useMemo(() => {
    if (!finance) return null;
    if (effectiveYear === "all") return finance;
    
    const year = parseInt(effectiveYear);
    return {
      ...finance,
      contributions: finance.contributions.filter((c) => c.cycle === year),
      lobbying: finance.lobbying.filter((l) => l.cycle === year),
      sponsors: finance.sponsors.filter((s) => s.cycle === year),
      totalContributions: finance.contributions
        .filter((c) => c.cycle === year)
        .reduce((sum, c) => sum + c.amount, 0),
      totalLobbying: finance.lobbying
        .filter((l) => l.cycle === year)
        .reduce((sum, l) => sum + l.totalSpent, 0),
    };
  }, [finance, effectiveYear]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!finance || !filteredFinance) {
    return null;
  }

  const hasData = 
    finance.contributions.length > 0 || 
    finance.lobbying.length > 0 || 
    finance.sponsors.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Financial Relationships
          </h2>
        </div>
        {hasData && availableYears.length > 0 && (
          <Select value={effectiveYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {hasData ? (
        <>
          <FinanceOverview finance={filteredFinance} />

          <Tabs defaultValue="trends" className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="trends" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Trends</span>
              </TabsTrigger>
              <TabsTrigger value="donors" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Donors</span>
              </TabsTrigger>
              <TabsTrigger value="lobbying" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Lobbying</span>
              </TabsTrigger>
              <TabsTrigger value="sponsors" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Sponsors</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="mt-4">
              <ContributionTrendsChart contributions={finance.contributions} sponsors={finance.sponsors} />
            </TabsContent>

            <TabsContent value="donors" className="mt-4">
              <ContributorsList contributions={filteredFinance.contributions} />
            </TabsContent>

            <TabsContent value="lobbying" className="mt-4">
              <LobbyingList lobbying={filteredFinance.lobbying} />
            </TabsContent>

            <TabsContent value="sponsors" className="mt-4">
              <SponsorsList sponsors={filteredFinance.sponsors} />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">
            Financial data will be available soon.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            We're working on syncing campaign finance and lobbying data from public records.
          </p>
        </div>
      )}
    </div>
  );
}
