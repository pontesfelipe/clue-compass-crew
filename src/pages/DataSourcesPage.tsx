import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  ExternalLink,
  DollarSign,
  FileText,
  Vote,
  Shield,
  Clock,
  Users,
  Building2,
  Landmark,
  MapPin,
  Database,
  RefreshCw,
} from "lucide-react";
import { Helmet } from "react-helmet";
import { useDataStatus } from "@/hooks/useDataStatus";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function DataSourcesPage() {
  const { data: status } = useDataStatus();

  const fmt = (ts: string | null | undefined) =>
    ts ? `${formatDistanceToNow(new Date(ts))} ago` : "Not yet synced";

  const sources = [
    {
      name: "Congress.gov API",
      icon: FileText,
      description:
        "The official U.S. Congress data service. We pull member profiles, bill text and metadata, sponsorships, cosponsorships, and legislative actions for the 118th and 119th Congresses.",
      url: "https://api.congress.gov/",
      dataTypes: ["Member profiles", "Bill text & status", "Sponsorships", "Legislative actions"],
      lastSync: status?.congress_bills_last_synced_at,
      syncStatus: status?.congress_bills_status,
      recordCount: status?.congress_bills_total,
    },
    {
      name: "House Clerk & Senate Roll Call Votes",
      icon: Vote,
      description:
        "Official chamber vote records. We ingest every roll call, each member's position (Yea/Nay/Present/Not Voting), and link votes back to their underlying bills.",
      url: "https://clerk.house.gov/Votes",
      dataTypes: ["Roll call votes", "Member positions", "Vote totals", "Bill linkage"],
      lastSync: status?.congress_votes_last_synced_at,
      syncStatus: status?.congress_votes_status,
      recordCount: status?.congress_votes_total,
    },
    {
      name: "Federal Election Commission (FEC)",
      icon: DollarSign,
      description:
        "Campaign finance filings. We aggregate itemized contributions, PAC transfers, and committee-to-candidate rollups on a rolling even-year cycle basis, matched to members via legal name and nickname mapping.",
      url: "https://www.fec.gov/data/",
      dataTypes: ["Itemized contributions", "PAC & committee data", "Cycle totals", "Funding dependency metrics"],
      lastSync: status?.fec_funding_last_synced_at,
      syncStatus: status?.fec_funding_status,
      recordCount: status?.fec_funding_total,
    },
    {
      name: "Senate LDA (Lobbying Disclosure)",
      icon: Landmark,
      description:
        "Quarterly lobbying registrations and filings disclosed under the Lobbying Disclosure Act. Used to surface industry activity and registrant relationships tied to legislative topics.",
      url: "https://lda.senate.gov/api/",
      dataTypes: ["Lobbying filings", "Registrants", "Industry activity", "Quarterly spend"],
      lastSync: null as string | null,
      syncStatus: "active",
      recordCount: undefined as number | undefined,
    },
    {
      name: "OpenStates API",
      icon: Building2,
      description:
        "State legislature coverage across all 50 states — state legislators, bills, and roll call votes. Federal and state records share the same schema so scores and comparisons work at both levels.",
      url: "https://openstates.org/",
      dataTypes: ["State legislators", "State bills", "State votes"],
      lastSync: null as string | null,
      syncStatus: "active",
      recordCount: undefined as number | undefined,
    },
    {
      name: "National Governors Association",
      icon: MapPin,
      description:
        "Current governors dataset used as the authoritative fallback for executive-branch state leaders while individual state APIs are integrated.",
      url: "https://www.nga.org/governors/",
      dataTypes: ["Governor profiles", "Party & term data", "State linkage"],
      lastSync: null as string | null,
      syncStatus: "active",
      recordCount: undefined as number | undefined,
    },
    {
      name: "unitedstates/congress-legislators",
      icon: Users,
      description:
        "Community-curated dataset (used by ProPublica, GovTrack, and others) for congressional committee assignments, subcommittees, and stable bioguide identifiers.",
      url: "https://github.com/unitedstates/congress-legislators",
      dataTypes: ["Committee assignments", "Subcommittees", "Bioguide IDs", "Biographical data"],
      lastSync: null as string | null,
      syncStatus: "active",
      recordCount: undefined as number | undefined,
    },
    {
      name: "US Census Geocoding API",
      icon: MapPin,
      description:
        "Used to resolve a user's ZIP code or address into a congressional district so we can surface the correct representatives without storing location data.",
      url: "https://geocoding.geo.census.gov/",
      dataTypes: ["ZIP → district", "Address → district"],
      lastSync: null as string | null,
      syncStatus: "on-demand",
      recordCount: undefined as number | undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Data Sources - CivicScore</title>
        <meta
          name="description"
          content="Every metric on CivicScore traces back to an official public source: Congress.gov, House & Senate roll calls, the FEC, Senate LDA lobbying filings, and OpenStates."
        />
      </Helmet>

      <Header />

      <main className="civic-container py-12 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              Data Sources
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every number on CivicScore traces back to an official public record. No opinion polls, no
              editorial classifications, no third-party ideology scores.
            </p>
          </div>

          {/* Primary Sources */}
          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-foreground mb-6">Primary Sources</h2>
            <div className="space-y-6">
              {sources.map((source) => (
                <div key={source.name} className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <source.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-serif text-xl font-bold text-foreground">{source.name}</h3>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors"
                          aria-label={`Visit ${source.name}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <p className="text-muted-foreground mb-3">{source.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {fmt(source.lastSync)}
                        </Badge>
                        {source.syncStatus && (
                          <Badge
                            variant={
                              source.syncStatus === "success" ||
                              source.syncStatus === "idle" ||
                              source.syncStatus === "active"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {source.syncStatus}
                          </Badge>
                        )}
                        {typeof source.recordCount === "number" && source.recordCount > 0 && (
                          <Badge variant="secondary">
                            {source.recordCount.toLocaleString()} records
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {source.dataTypes.map((type) => (
                          <span
                            key={type}
                            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Refresh cadence */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-2xl font-bold text-foreground">Refresh Cadence</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Roll call votes</span>
                  <span className="font-medium text-foreground">Every 2 hours</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Bills & sponsorships</span>
                  <span className="font-medium text-foreground">Every 6 hours</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Member profiles & committees</span>
                  <span className="font-medium text-foreground">Daily</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">FEC campaign finance</span>
                  <span className="font-medium text-foreground">Nightly</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Lobbying (LDA)</span>
                  <span className="font-medium text-foreground">Weekly</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">State legislators & bills</span>
                  <span className="font-medium text-foreground">Daily</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Freshman legislators may briefly show partial data until upstream sources (Congress.gov
                bioguide, community committee YAML, FEC name mappings) publish their records — typically
                within a few weeks of being sworn in.
              </p>
            </div>
          </section>

          {/* Data Processing */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-2xl font-bold text-foreground">How We Process the Data</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4 text-muted-foreground">
              <p>
                Every sync is <strong className="text-foreground">idempotent and resumable</strong>: jobs
                use cursors and stable upserts so a retry never double-counts, and rate limits are
                centrally enforced with backoff and retry-after honoring.
              </p>
              <p>
                Records are normalized into a single schema before scoring so a state vote and a federal
                vote are computed identically. FEC contributions are rolled up on a two-year cycle basis
                and matched to members through a legal-name and nickname mapping table.
              </p>
              <p>
                All historical data is preserved. Every displayed metric carries a "last updated"
                timestamp and, where relevant, a completeness badge indicating how much of the underlying
                data the source has published.
              </p>
            </div>
          </section>

          {/* Data quality note */}
          <section>
            <div className="bg-muted/50 rounded-xl border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Neutrality Commitment</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                We deliberately exclude speeches, press releases, media classifications, and any
                third-party ideology scores. If it can't be traced to an official filing, roll call, or
                government record, it doesn't appear on CivicScore.
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
