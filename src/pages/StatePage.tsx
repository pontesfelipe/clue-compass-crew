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
  ArrowLeft, 
  Users, 
  FileText, 
  Vote, 
  Scale,
  MapPin
} from "lucide-react";
import { useStateMembers, useStateStats, stateNames } from "@/hooks/useStateData";

export default function StatePage() {
  const { stateAbbr } = useParams<{ stateAbbr: string }>();
  const normalizedAbbr = stateAbbr?.toUpperCase() || "";
  
  const { data: members, isLoading: membersLoading } = useStateMembers(normalizedAbbr);
  const { data: stats, isLoading: statsLoading } = useStateStats(normalizedAbbr);

  const stateName = stateNames[normalizedAbbr] || normalizedAbbr;
  const senators = members?.filter(m => m.chamber === "senate") || [];
  const representatives = members?.filter(m => m.chamber === "house") || [];

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
              {senators.map((member, index) => (
                <div
                  key={member.id}
                  className="opacity-0 animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <MemberCard
                    id={member.id}
                    name={member.full_name}
                    party={member.party}
                    state={member.state}
                    chamber="Senate"
                    score={member.score ?? 0}
                    imageUrl={member.image_url}
                  />
                </div>
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
              {representatives.map((member, index) => (
                <div
                  key={member.id}
                  className="opacity-0 animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <MemberCard
                    id={member.id}
                    name={member.full_name}
                    party={member.party}
                    state={member.state}
                    chamber="House"
                    score={member.score ?? 0}
                    imageUrl={member.image_url}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
