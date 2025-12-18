import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/FeatureCard";
import { MemberCard } from "@/components/MemberCard";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  Scale, 
  Map, 
  Users,
  ArrowRight,
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
      
      {/* Hero Section - Mission Focused */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ 
            backgroundImage: `radial-gradient(circle at 20% 50%, hsl(var(--civic-gold)) 0%, transparent 50%), 
                              radial-gradient(circle at 80% 50%, hsl(var(--civic-blue)) 0%, transparent 50%)` 
          }} />
        </div>
        
        <div className="civic-container relative py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Mission Statement */}
            <div className="space-y-6">
              <h2 className="font-serif text-xl font-semibold text-foreground sm:text-2xl">
                CivicScore's Mission
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                CivicScore's mission is to deliver public voting and campaign financial information 
                of current politicians in your State on whether they are serving and protecting your 
                human rights, with the goal of helping you to form your own opinions about the 
                individuals you choose to represent your interests.
              </p>
            </div>

            {/* Neutral Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-3 shadow-sm">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Neutral – Data driven – Non-partisan
                </span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl pt-4">
              Understand politicians you are choosing
              <span className="block mt-2">
                <span className="civic-gradient-text">to represent you</span>
              </span>
            </h1>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button variant="hero" size="xl" asChild>
                <Link to="/map">
                  Select your State
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="civic-outline" size="xl" asChild>
                <Link to="/how-it-works">
                  How it Works
                </Link>
              </Button>
            </div>
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
