import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { 
  BarChart3, 
  Users, 
  Scale, 
  TrendingUp, 
  Database,
  Calculator,
  Shield,
  RefreshCw
} from "lucide-react";
import { Helmet } from "react-helmet";

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Methodology - CivicScore</title>
        <meta name="description" content="Learn how CivicScore calculates representative performance scores using official congressional data." />
      </Helmet>
      
      <Header />
      
      <main className="civic-container py-12 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              Our Methodology
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Transparent, data-driven scoring that puts facts first
            </p>
          </div>

          {/* Data Collection */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">1. Data Collection</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                We collect data directly from official government sources to ensure accuracy and reliability:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Congress.gov API</strong> — Official voting records, bill sponsorships, and member information
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">FEC.gov</strong> — Campaign finance data including contributions and funding sources
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">House Clerk & Senate.gov</strong> — Detailed roll call vote information
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Scoring Components */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">2. Scoring Components</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className="h-5 w-5 text-score-excellent" />
                  <h3 className="font-semibold text-foreground">Productivity Score</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Measures legislative activity including bills sponsored, co-sponsored, and successfully enacted into law. Higher productivity indicates an active legislator.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="h-5 w-5 text-score-good" />
                  <h3 className="font-semibold text-foreground">Attendance Rate</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tracks vote participation. Representatives who show up and vote consistently score higher than those who frequently miss votes.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Scale className="h-5 w-5 text-score-average" />
                  <h3 className="font-semibold text-foreground">Bipartisanship Index</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Evaluates cross-party collaboration by analyzing co-sponsorship patterns and voting alignment with members of the opposing party.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Issue Alignment</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Compares your selected priority issues with the representative's voting record and sponsored legislation on those topics.
                </p>
              </div>
            </div>
          </section>

          {/* Score Calculation */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">3. Score Calculation</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                The overall CivicScore is calculated using a weighted average of all components:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-foreground">
                  CivicScore = (Productivity × W₁) + (Attendance × W₂) + (Bipartisanship × W₃) + (Issue Alignment × W₄)
                </p>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Default weights are evenly distributed, but authenticated users can customize these weights to prioritize the factors that matter most to them.
              </p>
            </div>
          </section>

          {/* Data Updates */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">4. Data Freshness</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Our data is synchronized automatically on a regular schedule:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li>• <strong className="text-foreground">Votes:</strong> Updated every 2 hours</li>
                <li>• <strong className="text-foreground">Bills:</strong> Updated every 6 hours</li>
                <li>• <strong className="text-foreground">Member Information:</strong> Updated daily</li>
                <li>• <strong className="text-foreground">Campaign Finance:</strong> Updated nightly</li>
              </ul>
              <p className="text-sm text-muted-foreground italic">
                This "near real-time" approach ensures you have access to recent data while managing API rate limits responsibly.
              </p>
            </div>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
