import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { USMap } from "@/components/USMap";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  FileText, 
  Vote, 
  TrendingUp,
  Filter,
  Download
} from "lucide-react";

export default function MapPage() {
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
          <div className="flex gap-2">
            <Button variant="civic-outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Button variant="civic-ghost" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatsCard
            icon={Users}
            value="535"
            label="Total Members Tracked"
            trend={{ value: 0, isPositive: true }}
          />
          <StatsCard
            icon={FileText}
            value="12,847"
            label="Bills Analyzed"
            trend={{ value: 8.2, isPositive: true }}
          />
          <StatsCard
            icon={Vote}
            value="94.2%"
            label="Avg. Attendance Rate"
            trend={{ value: -1.3, isPositive: false }}
          />
          <StatsCard
            icon={TrendingUp}
            value="67"
            label="National Avg. Score"
            trend={{ value: 2.1, isPositive: true }}
          />
        </div>

        {/* Map Section */}
        <div className="rounded-2xl border border-border bg-card shadow-civic-lg overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              State Performance Overview
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              118th Congress · Data updated daily from Congress.gov
            </p>
          </div>
          <div className="p-4 lg:p-8">
            <USMap />
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
