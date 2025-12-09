import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MemberCard } from "@/components/MemberCard";
import { ScoreRing } from "@/components/ScoreRing";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  Vote, 
  Scale,
  MapPin,
  Filter
} from "lucide-react";
import { useStateMembers, useStateStats, stateNames } from "@/hooks/useStateData";

type ScoreFilter = "all" | "top" | "good" | "average" | "below";

const scoreFilters: { value: ScoreFilter; label: string; min: number; max: number }[] = [
  { value: "all", label: "All Scores", min: 0, max: 100 },
  { value: "top", label: "Top Performers (80+)", min: 80, max: 100 },
  { value: "good", label: "Good (60-79)", min: 60, max: 79 },
  { value: "average", label: "Average (40-59)", min: 40, max: 59 },
  { value: "below", label: "Below Average (<40)", min: 0, max: 39 },
];

export default function StatePage() {
  const { stateAbbr } = useParams<{ stateAbbr: string }>();
  const normalizedAbbr = stateAbbr?.toUpperCase() || "";
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  
  const { data: members, isLoading: membersLoading } = useStateMembers(normalizedAbbr);
  const { data: stats, isLoading: statsLoading } = useStateStats(normalizedAbbr);

  const stateName = stateNames[normalizedAbbr] || normalizedAbbr;
  
  const filterByScore = (memberList: typeof members) => {
    if (!memberList || scoreFilter === "all") return memberList || [];
    const filter = scoreFilters.find(f => f.value === scoreFilter);
    if (!filter) return memberList;
    return memberList.filter(m => (m.score ?? 0) >= filter.min && (m.score ?? 0) <= filter.max);
  };

  const senators = filterByScore(members?.filter(m => m.chamber === "senate"));
  const representatives = filterByScore(members?.filter(m => m.chamber === "house"));

  const isLoading = membersLoading || statsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
            <Link to="/map">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Map
            </Link>
          </Button>
        </div>

        {/* State Header */}
        <div className="flex flex-col lg:flex-row gap-8 items-start mb-12">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="outline" className="text-sm">
                <MapPin className="mr-1 h-3 w-3" />
                {normalizedAbbr}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                119th Congress
              </Badge>
            </div>
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              {stateName}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              View the performance scores for all congressional representatives from {stateName}. 
              Scores are calculated based on productivity, attendance, and bipartisanship.
            </p>
          </div>
          
          <div className="flex flex-col items-center bg-card rounded-2xl border border-border p-8 shadow-civic-md">
            <p className="text-sm font-medium text-muted-foreground mb-2">State Average</p>
            {isLoading ? (
              <Skeleton className="h-24 w-24 rounded-full" />
            ) : (
              <ScoreRing score={stats?.avgScore ?? 0} size="xl" />
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Based on {stats?.memberCount ?? 0} members
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))
          ) : (
            <>
              <StatsCard
                icon={Users}
                value={stats?.memberCount ?? 0}
                label="Total Members"
              />
              <StatsCard
                icon={FileText}
                value={stats?.totalBillsSponsored ?? 0}
                label="Bills Sponsored"
              />
              <StatsCard
                icon={Vote}
                value={`${stats?.avgAttendance ?? 0}%`}
                label="Avg. Attendance"
              />
              <StatsCard
                icon={Scale}
                value={`${stats?.avgBipartisanship ?? 0}%`}
                label="Bipartisan Score"
              />
            </>
          )}
        </div>

        {/* Score Filter */}
        <div className="flex items-center justify-between mb-8 p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filter by Score</span>
          </div>
          <Select value={scoreFilter} onValueChange={(v) => setScoreFilter(v as ScoreFilter)}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Select score range" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              {scoreFilters.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Senators Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Senators
            </h2>
            <Badge variant="secondary">{senators.length} members</Badge>
          </div>
          {membersLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : senators.length === 0 ? (
            <p className="text-muted-foreground">No senators found for this state.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {senators.map((member) => (
                <MemberCard
                  key={member.id}
                  id={member.id}
                  name={member.fullName}
                  party={member.party}
                  state={member.state}
                  chamber="Senate"
                  score={member.score ?? 0}
                  imageUrl={member.imageUrl}
                />
              ))}
            </div>
          )}
        </section>

        {/* Representatives Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Representatives
            </h2>
            <Badge variant="secondary">{representatives.length} members</Badge>
          </div>
          {membersLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : representatives.length === 0 ? (
            <p className="text-muted-foreground">No representatives found for this state.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {representatives.map((member) => (
                <MemberCard
                  key={member.id}
                  id={member.id}
                  name={member.fullName}
                  party={member.party}
                  state={member.state}
                  chamber="House"
                  score={member.score ?? 0}
                  imageUrl={member.imageUrl}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
