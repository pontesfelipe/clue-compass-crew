import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/FeatureCard";
import { USMapSVG } from "@/components/USMapSVG";
import { MemberCard } from "@/components/MemberCard";
import { ScoreRing } from "@/components/ScoreRing";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  Scale, 
  Map, 
  Users,
  ArrowRight,
  Database,
  Target,
  Grid3X3
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTopMembers } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { data: topMembers, isLoading } = useTopMembers(4);
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <ProfileCompletionBanner />
      
      {/* Hero Section - Calm, analytical, no imagery */}
      <section className="py-16 lg:py-24">
        <div className="civic-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-6">
              <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
                Neutral · Data-driven · Non-partisan
              </p>
              
              <h1 className="text-foreground">
                Understand What Your Representatives Actually Do
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                CivicScore turns public records on votes, legislation, and campaign 
                finance into structured, neutral insights. No opinions. No party labels. 
                Just actions and patterns from official sources.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button size="lg" asChild>
                  <Link to="/map">
                    Explore by State
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/how-it-works">
                    How It Works
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <span>535 Members</span>
                <span className="text-border">|</span>
                <span>Official Public Data</span>
                <span className="text-border">|</span>
                <span>No Ideology Labels</span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-medium text-foreground">National Overview</h3>
                  <ScoreRing score={67} size="sm" />
                </div>
                <USMapSVG showStats={false} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What This Is Section */}
      <section className="py-12 lg:py-16 border-t border-border">
        <div className="civic-container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-foreground mb-4">
              What This Is
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Politics generates enormous amounts of public data, but it is scattered, 
              technical, and difficult to interpret. CivicScore brings verified public 
              records together and presents them clearly. We measure how actions compare 
              to the priorities you choose — without telling you what to think.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-secondary/30 py-16 lg:py-20">
        <div className="civic-container">
          <div className="text-center mb-12">
            <h2 className="text-foreground mb-3">
              From Data to Clarity
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We transform raw congressional data into structured signals — 
              without adding opinions or ideological labels.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Database}
              title="Public Data Collection"
              description="Votes, bills, and campaign finance from official government sources like Congress.gov and the FEC."
              delay={100}
            />
            <FeatureCard
              icon={BarChart3}
              title="Behavioral Signals"
              description="Raw data structured into indicators of behavior over time — not raw spreadsheets."
              delay={150}
            />
            <FeatureCard
              icon={Target}
              title="Priority-Based Alignment"
              description="Define what matters to you. Compare actions to your priorities and see alignment."
              delay={200}
            />
            <FeatureCard
              icon={Users}
              title="Attendance Tracking"
              description="Monitor vote participation rates. Know if your representative shows up when it matters."
              delay={250}
            />
            <FeatureCard
              icon={Scale}
              title="Collaboration Patterns"
              description="See cross-party collaboration on legislation. Understand working relationships."
              delay={300}
            />
            <FeatureCard
              icon={Map}
              title="Geographic Insights"
              description="Explore patterns by state or chamber. Compare regions at a glance."
              delay={350}
            />
          </div>
        </div>
      </section>

      {/* Featured Members Section */}
      <section className="py-16 lg:py-20">
        <div className="civic-container">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-foreground mb-1">
                High Activity Members
              </h2>
              <p className="text-muted-foreground text-sm">
                Members with notable cross-party collaboration based on available data
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/members">
                View All Members
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                </div>
              ))
            ) : (
              topMembers?.map((member, index) => (
                <div
                  key={member.id}
                  className="opacity-0 animate-slide-up"
                  style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'forwards' }}
                >
                  <MemberCard
                    id={member.id}
                    name={member.fullName}
                    party={member.party}
                    state={member.state}
                    chamber={member.chamber === "senate" ? "Senate" : "House"}
                    score={member.score ?? 0}
                    imageUrl={member.imageUrl}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA Section - Only show for non-authenticated users */}
      {!isAuthenticated && (
        <section className="py-16 lg:py-20 border-t border-border bg-secondary/20">
          <div className="civic-container">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-foreground mb-4">
                Compare Actions to Your Priorities
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Create a free account to define your priorities and see how representatives' 
                actions align with what matters to you — based on public data, not opinions.
              </p>
              <Button size="lg" asChild>
                <Link to="/auth">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
