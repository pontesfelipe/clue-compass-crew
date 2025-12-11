import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { USMapSVG } from "@/components/USMapSVG";
import { StatsCard } from "@/components/StatsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  FileText, 
  Vote, 
  TrendingUp
} from "lucide-react";
import { useStateScores, getNationalAverage } from "@/hooks/useStateData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useNationalStats() {
  return useQuery({
    queryKey: ["national-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(`
          id,
          member_scores!inner (
            overall_score,
            attendance_score,
            bills_sponsored
          )
        `)
        .eq("in_office", true)
        .is("member_scores.user_id", null);

      if (error) throw error;

      const members = data || [];
      const memberCount = members.length;

      if (memberCount === 0) {
        return { memberCount: 0, avgAttendance: 0, totalBillsSponsored: 0 };
      }

      let totalAttendance = 0;
      let totalBillsSponsored = 0;

      members.forEach((m: any) => {
        const scores = m.member_scores?.[0];
        if (scores) {
          totalAttendance += Number(scores.attendance_score) || 0;
          totalBillsSponsored += Number(scores.bills_sponsored) || 0;
        }
      });

      return {
        memberCount,
        avgAttendance: Math.round(totalAttendance / memberCount * 10) / 10,
        totalBillsSponsored,
      };
    },
  });
}

export default function MapPage() {
  const { data: stateScores, isLoading: statesLoading } = useStateScores();
  const { data: nationalStats, isLoading: statsLoading } = useNationalStats();
  
  const nationalAvg = stateScores ? getNationalAverage(stateScores) : 0;
  const isLoading = statesLoading || statsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl mb-2">
              Congressional Map
            </h1>
            <p className="text-muted-foreground">
              Explore performance scores by state. Click any state to view details.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
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
                value={nationalStats?.memberCount ?? 0}
                label="Total Members Tracked"
              />
              <StatsCard
                icon={FileText}
                value={nationalStats?.totalBillsSponsored ?? 0}
                label="Bills Sponsored"
              />
              <StatsCard
                icon={Vote}
                value={`${nationalStats?.avgAttendance ?? 0}%`}
                label="Avg. Attendance Rate"
              />
              <StatsCard
                icon={TrendingUp}
                value={nationalAvg}
                label="National Avg. Score"
              />
            </>
          )}
        </div>

        {/* Map Section */}
        <div className="rounded-2xl border border-border bg-card shadow-civic-lg overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              State Performance Overview
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              119th Congress · Data synced from Congress.gov
            </p>
          </div>
          <div className="p-4 lg:p-8">
            <USMapSVG />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 lg:grid-cols-3 mt-8">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-serif font-semibold text-foreground mb-2">
              How Scores Are Calculated
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each state's average score combines individual member scores weighted 
              by chamber representation. Scores factor in productivity, attendance, 
              and bipartisanship.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-serif font-semibold text-foreground mb-2">
              Data Sources
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All data is sourced directly from the official Congress.gov API, 
              ensuring accuracy and transparency. Updates are processed nightly.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-serif font-semibold text-foreground mb-2">
              Customize Your View
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sign in to adjust scoring weights based on issues that matter to you. 
              Your personalized scores will be reflected across the platform.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
