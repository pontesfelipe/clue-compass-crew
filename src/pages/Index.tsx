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
  Sliders, 
  TrendingUp, 
  Users,
  ArrowRight,
  CheckCircle,
  Shield,
  Database,
  Target
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTopMembers } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { data: topMembers, isLoading } = useTopMembers(4);
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <ProfileCompletionBanner />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ 
            backgroundImage: `radial-gradient(circle at 20% 50%, hsl(var(--civic-gold)) 0%, transparent 50%), 
                              radial-gradient(circle at 80% 50%, hsl(var(--civic-blue)) 0%, transparent 50%)` 
          }} />
        </div>
        
        <div className="civic-container relative py-20 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Shield className="h-4 w-4" />
                Neutral · Data-driven · Non-partisan
              </div>
              
              <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Understand who you are voting
                <span className="block mt-2">
                  <span className="civic-gradient-text">to represent you.</span>
                </span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                We turn public data on votes, money, and behavior into clear, neutral insights 
                — so you can decide for yourself. No opinions. No party labels. Just actions and patterns.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/map">
                    See How Your State Performs
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="civic-outline" size="xl" asChild>
                  <Link to="/how-it-works">
                    How It Works
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-6 pt-4">
                {[
                  "535 Members Tracked",
                  "Official Public Data",
                  "No Ideology Labels"
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-score-excellent" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5 blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-civic-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-serif text-lg font-semibold text-foreground">National Overview</h3>
                  <ScoreRing score={67} size="md" />
                </div>
                <USMapSVG showStats={false} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What This Is Section */}
      <section className="py-16 lg:py-20 border-t border-border">
        <div className="civic-container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-serif text-2xl font-bold text-foreground sm:text-3xl mb-6">
              What This Is
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Politics generates enormous amounts of public data, but it is scattered, technical, 
              and difficult to trust. CivicScore brings verified public records together and presents 
              them clearly. We measure how actions align with the priorities <em>you</em> choose — 
              without telling you what to think or how to vote.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 py-20 lg:py-28">
        <div className="civic-container">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl mb-4">
              From Data to Clarity
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We transform raw congressional data into structured signals you can understand — 
              without adding opinions or ideological labels.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Database}
              title="Public Data Collection"
              description="Votes, bills, and campaign finance from official government sources like Congress.gov and the FEC."
              delay={100}
            />
            <FeatureCard
              icon={BarChart3}
              title="Behavioral Signals"
              description="We turn raw data into structured indicators of behavior over time — not raw spreadsheets."
              delay={200}
            />
            <FeatureCard
              icon={Target}
              title="Priority-Based Alignment"
              description="You define what matters to you. We compare actions to your priorities and show alignment."
              delay={300}
            />
            <FeatureCard
              icon={Users}
              title="Attendance Tracking"
              description="Monitor vote participation rates. Know if your representative shows up when it matters."
              delay={400}
            />
            <FeatureCard
              icon={Scale}
              title="Collaboration Patterns"
              description="See cross-party collaboration on legislation. Understand working relationships."
              delay={500}
            />
            <FeatureCard
              icon={Map}
              title="Geographic Insights"
              description="Explore performance by state or chamber. Compare regions at a glance."
              delay={600}
            />
          </div>
        </div>
      </section>

      {/* Featured Members Section */}
      <section className="py-20 lg:py-28">
        <div className="civic-container">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl mb-2">
                High Activity Members
              </h2>
              <p className="text-muted-foreground">
                Members with the highest cross-party collaboration based on available data
              </p>
            </div>
            <Button variant="civic-outline" asChild>
              <Link to="/map">
                View All Members
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border bg-card p-4">
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
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
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
        <section className="relative overflow-hidden py-20 lg:py-28">
          <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 30% 30%, hsl(var(--civic-gold) / 0.3) 0%, transparent 40%)`
            }} />
          </div>
          
          <div className="civic-container relative">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl font-bold text-primary-foreground sm:text-4xl lg:text-5xl mb-6">
                Compare Politicians to What Matters to You
              </h2>
              <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">
                Create a free account to define your priorities and see how actions 
                align with what matters to you — based on public data, not opinions.
              </p>
              <Button variant="hero" size="xl" asChild>
                <Link to="/auth">
                  Create Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
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
