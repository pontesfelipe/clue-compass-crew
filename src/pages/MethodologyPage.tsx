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
  XCircle,
  Palette,
} from "lucide-react";
import { Helmet } from "react-helmet";

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Methodology - CivicScore</title>
        <meta
          name="description"
          content="How CivicScore computes neutral, party-blind scores from voting records, sponsorships, committees, and FEC filings — with the exact weights, rules, and guardrails."
        />
      </Helmet>

      <Header />

      <main className="civic-container py-12 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              Our Methodology
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A transparent, party-blind scoring system built on official records. Every number can be
              traced back to a specific vote, sponsorship, committee assignment, or FEC filing.
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
                CivicScore measures <strong>distance</strong> between a user's stated priorities and a
                legislator's recorded actions. It <strong>never</strong> infers ideology, party, or
                intent, and it never uses party affiliation as an input to the score.
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
                  <li>• Roll call votes (Yea / Nay / Present / Not Voting)</li>
                  <li>• Bill sponsorships and cosponsorships</li>
                  <li>• Committee and subcommittee memberships</li>
                  <li>• FEC campaign finance filings (itemized)</li>
                  <li>• Lobbying disclosures (Senate LDA)</li>
                  <li>• Timing of actions relative to donations</li>
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
                  <li>• Ideological labels (left/right, progressive/conservative)</li>
                  <li>• Speeches, press releases, or social posts</li>
                  <li>• Media classifications</li>
                  <li>• Third-party ideology scores</li>
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
                Users answer <strong className="text-foreground">issue-based</strong> questions only.
                Each response is normalized to a 0–1 scale and stored as a private priority vector.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-2">Example questions</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Importance of environmental protection</li>
                    <li>• Importance of healthcare affordability</li>
                    <li>• Importance of reducing corporate influence</li>
                    <li>• Importance of national security spending</li>
                    <li>• Importance of small business support</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-2">We never ask</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Political identity</li>
                    <li>• Party preference</li>
                    <li>• Who you voted for</li>
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
                Every legislator signal is normalized to a −1 to +1 scale before scoring:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-1">
                <p className="text-foreground">+1 = strongly aligned with the priority</p>
                <p className="text-foreground"> 0 = neutral or no signal available</p>
                <p className="text-foreground">−1 = strongly misaligned</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-foreground">
                  Alignment = 1 − normalized_distance(user_vector, politician_vector)
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">Rules</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Missing data defaults to neutral, never negative</li>
                  <li>• Low-confidence signals are disclosed with a completeness badge</li>
                  <li>• Recent actions weigh more than old actions (time decay)</li>
                  <li>• Votes &gt; sponsorships &gt; cosponsorships &gt; inferred behavior</li>
                  <li>• Freshman legislators show partial data until upstream records populate</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Scoring Components & Weights */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Scoring Components</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-score-good" />
                    <h3 className="font-semibold text-foreground">Attendance</h3>
                  </div>
                  <span className="text-sm font-mono text-primary">30%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Vote participation rate. Members who show up and cast a position on the record score
                  higher than those who frequently miss votes.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-score-excellent" />
                    <h3 className="font-semibold text-foreground">Productivity</h3>
                  </div>
                  <span className="text-sm font-mono text-primary">35%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Legislative activity — bills sponsored, cosponsored, and enacted into law, weighted by
                  how far each bill advanced through the process.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-score-average" />
                    <h3 className="font-semibold text-foreground">Collaboration</h3>
                  </div>
                  <span className="text-sm font-mono text-primary">35%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cross-party cosponsorship patterns. Measures how often a legislator works across the
                  aisle — computed from cosponsorship data only, not party labels used as scoring input.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Your Alignment</h3>
                  </div>
                  <span className="text-sm font-mono text-primary">Personal</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only shown once you complete a profile. Compares your priorities to the member's votes
                  and sponsorships. <strong className="text-foreground">Never blended</strong> into the
                  public overall score, so the base score stays party-blind for everyone.
                </p>
              </div>
            </div>
            <div className="mt-4 bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Public overall score</p>
              <p>
                Attendance 30% · Productivity 35% · Collaboration 35%. Personalized alignment is
                displayed as a separate widget and never mixed into the public score.
              </p>
            </div>
          </section>

          {/* Score Color Tiers */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Score Color Tiers</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-muted-foreground mb-4 text-sm">
                Colors on the map and rankings are calibrated to the actual distribution of scores, not
                a fixed 0–100 gradient. This makes real differences between legislators visible.
              </p>
              <div className="grid gap-2 sm:grid-cols-5">
                {[
                  { label: "Top tier", range: "70+", color: "#15803d" },
                  { label: "Above avg", range: "64–69", color: "#4ade80" },
                  { label: "Average", range: "60–63", color: "#facc15" },
                  { label: "Below avg", range: "55–59", color: "#fb923c" },
                  { label: "Bottom tier", range: "< 55", color: "#dc2626" },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg border border-border p-3 text-center">
                    <div
                      className="mx-auto h-6 w-full rounded mb-2"
                      style={{ backgroundColor: t.color }}
                      aria-hidden
                    />
                    <p className="text-xs font-medium text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t.range}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bias Guardrails */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Bias Guardrails</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Party-blind computation</h3>
                <p className="text-sm text-muted-foreground">
                  Party fields are inaccessible to the scoring engine. Removing all party labels from the
                  database would not change any score.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Symmetry test</h3>
                <p className="text-sm text-muted-foreground">
                  Inverting every vote on both sides produces an exactly inverted alignment score — no
                  hidden directional bias.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Null test</h3>
                <p className="text-sm text-muted-foreground">
                  A legislator with no data lands at neutral (~50), not at zero. Absence of data is never
                  treated as opposition.
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-2">Explainability</h3>
                <p className="text-sm text-muted-foreground">
                  Every score can be expanded to the specific votes, sponsorships, and committee
                  assignments that produced it.
                </p>
              </div>
            </div>
          </section>

          {/* Data Freshness */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Data Freshness</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Every card and score is stamped with a "last updated" indicator. Historical data is
                preserved so past scores remain auditable.
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li>• <strong className="text-foreground">Roll call votes:</strong> every 2 hours</li>
                <li>• <strong className="text-foreground">Bills & sponsorships:</strong> every 6 hours</li>
                <li>• <strong className="text-foreground">Member profiles & committees:</strong> daily</li>
                <li>• <strong className="text-foreground">Campaign finance:</strong> nightly</li>
                <li>• <strong className="text-foreground">Lobbying filings:</strong> weekly</li>
                <li>• <strong className="text-foreground">State legislators & bills:</strong> daily</li>
              </ul>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
