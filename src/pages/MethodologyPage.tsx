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
  RefreshCw,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Helmet } from "react-helmet";

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Methodology - CivicScore</title>
        <meta name="description" content="Learn how CivicScore calculates neutral alignment scores using official public data and symmetric distance metrics." />
      </Helmet>
      
      <Header />
      
      <main className="civic-container py-12 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              Our Methodology
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Transparent, neutral scoring that measures distance between actions and priorities
            </p>
          </div>

          {/* Golden Rule */}
          <section className="mb-16">
            <div className="bg-primary/5 rounded-xl border border-primary/20 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-primary" />
                <h2 className="font-serif text-xl font-bold text-foreground">The Golden Rule</h2>
              </div>
              <p className="text-lg text-foreground leading-relaxed">
                The system measures <strong>distance</strong> between user priorities and politician actions. 
                It <strong>never</strong> infers ideology, party, or intent.
              </p>
            </div>
          </section>

          {/* Allowed vs Forbidden Inputs */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Data Inputs</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-score-excellent" />
                  <h3 className="font-semibold text-foreground">Allowed Inputs (Only These)</h3>
                </div>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• Voting records (Yea / Nay / Present / Missed)</li>
                  <li>• Bill sponsorships and co-sponsorships</li>
                  <li>• Committee memberships</li>
                  <li>• Campaign finance data (FEC only)</li>
                  <li>• Timing of actions vs. donations</li>
                </ul>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="h-5 w-5 text-score-bad" />
                  <h3 className="font-semibold text-foreground">Forbidden Inputs (Never Used)</h3>
                </div>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• Party affiliation</li>
                  <li>• Caucus membership</li>
                  <li>• Ideological labels</li>
                  <li>• Statements, speeches, slogans</li>
                  <li>• Media classifications</li>
                  <li>• Left/right or progressive/conservative tagging</li>
                </ul>
              </div>
            </div>
          </section>

          {/* User Preference Model */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">User Preference Model</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Users answer issue-based questions only. Each answer is normalized to a 0–1 scale.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-2">Example questions:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Importance of environmental protection</li>
                    <li>• Importance of healthcare affordability</li>
                    <li>• Importance of reducing corporate influence</li>
                    <li>• Importance of national security spending</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-2">We do NOT ask:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Political identity</li>
                    <li>• Party preference</li>
                    <li>• Ideological leaning</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Scoring Model */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Scoring Model</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                All politician signals are normalized to a -1 to +1 scale:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2">
                <p className="text-foreground">+1 = strongly aligned with preference</p>
                <p className="text-foreground"> 0 = neutral or no signal</p>
                <p className="text-foreground">-1 = strongly misaligned</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-foreground">
                  Alignment = 1 - normalized_distance(user_vector, politician_vector)
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">Rules:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Missing data defaults to neutral, NOT negative</li>
                  <li>• Low data confidence must be disclosed</li>
                  <li>• Recent actions weigh more than old actions</li>
                  <li>• Votes &gt; sponsorships &gt; inferred behavior</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Bias Guardrails */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Bias Guardrails (Mandatory)</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Party-blind computation</h3>
                <p className="text-sm text-muted-foreground">Party fields are inaccessible to the scorer</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Symmetry test</h3>
                <p className="text-sm text-muted-foreground">Invert votes → inverted score</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Null test</h3>
                <p className="text-sm text-muted-foreground">No data → ~50 alignment (neutral)</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Explainability test</h3>
                <p className="text-sm text-muted-foreground">Every score must list inputs</p>
              </div>
            </div>
          </section>

          {/* Scoring Components */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Scoring Components</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 className="h-5 w-5 text-score-excellent" />
                  <h3 className="font-semibold text-foreground">Productivity</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Measures legislative activity including bills sponsored, co-sponsored, and enacted into law.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="h-5 w-5 text-score-good" />
                  <h3 className="font-semibold text-foreground">Attendance</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tracks vote participation. Members who vote consistently score higher than those who frequently miss votes.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Scale className="h-5 w-5 text-score-average" />
                  <h3 className="font-semibold text-foreground">Collaboration</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Evaluates cross-party collaboration by analyzing co-sponsorship patterns.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Issue Alignment</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Compares your selected priority issues with the member's voting record and sponsored legislation.
                </p>
              </div>
            </div>
          </section>

          {/* Data Updates */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Data Freshness</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Data is refreshed on a scheduled basis. Update timestamps are displayed. Historical data is preserved for auditability.
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li>• <strong className="text-foreground">Votes:</strong> Updated every 2 hours</li>
                <li>• <strong className="text-foreground">Bills:</strong> Updated every 6 hours</li>
                <li>• <strong className="text-foreground">Member Information:</strong> Updated daily</li>
                <li>• <strong className="text-foreground">Campaign Finance:</strong> Updated nightly</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
