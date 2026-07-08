import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ExternalLink, DollarSign, FileText, Vote, Shield, Clock, Users, Building2, Landmark } from "lucide-react";
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
      description: "The official source for congressional information including member details, bill text, sponsorships, and legislative actions.",
      url: "https://api.congress.gov/",
      dataTypes: ["Member profiles", "Bill information", "Sponsorships", "Legislative actions"],
      lastSync: status?.congress_bills_last_synced_at,
      syncStatus: status?.congress_bills_status,
      recordCount: status?.congress_bills_total,
    },
    {
      name: "House Clerk & Senate Roll Call Votes",
      icon: Vote,
      description: "Official chamber voting records with detailed roll call information for every vote.",
      url: "https://clerk.house.gov/Votes",
      dataTypes: ["Roll call votes", "Member positions", "Vote totals", "Vote dates"],
      lastSync: status?.congress_votes_last_synced_at,
      syncStatus: status?.congress_votes_status,
      recordCount: status?.congress_votes_total,
    },
    {
      name: "Federal Election Commission (FEC)",
      icon: DollarSign,
      description: "Campaign finance data including individual contributions, PAC donations, and expenditure reports.",
      url: "https://www.fec.gov/data/",
      dataTypes: ["Campaign contributions", "Donor information", "PAC data", "Expenditures"],
      lastSync: status?.fec_funding_last_synced_at,
      syncStatus: status?.fec_funding_status,
      recordCount: status?.fec_funding_total,
    },
    {
      name: "OpenStates API",
      icon: Building2,
      description: "State legislature data including state legislators, bills, and votes across all 50 states.",
      url: "https://openstates.org/",
      dataTypes: ["State legislators", "State bills", "State votes", "Governors"],
      lastSync: null as string | null,
      syncStatus: "scheduled",
      recordCount: undefined as number | undefined,
    },
    {
      name: "Senate LDA (Lobbying Disclosure)",
      icon: Landmark,
      description: "Lobbying registrations and quarterly filings disclosed under the Lobbying Disclosure Act.",
      url: "https://lda.senate.gov/api/",
      dataTypes: ["Lobbying filings", "Industry activity", "Registrants"],
      lastSync: null as string | null,
      syncStatus: "scheduled",
      recordCount: undefined as number | undefined,
    },
    {
      name: "unitedstates/congress-legislators",
      icon: Users,
      description: "Curated dataset for congressional committee assignments and legislator biographical data.",
      url: "https://github.com/unitedstates/congress-legislators",
      dataTypes: ["Committee assignments", "Bioguide identifiers"],
      lastSync: null as string | null,
      syncStatus: "scheduled",
      recordCount: undefined as number | undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Data Sources - CivicScore</title>
        <meta name="description" content="CivicScore uses official government data sources to provide accurate, neutral information about congressional actions." />
      </Helmet>
      
      <Header />
      
      <main className="civic-container py-12 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              Data Sources
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We rely exclusively on official government sources to ensure accuracy and transparency
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
                            variant={source.syncStatus === "success" || source.syncStatus === "idle" ? "secondary" : "outline"}
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
          {/* end sources list */}


          {/* Data Update Notes */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-2xl font-bold text-foreground">Data Update Notes</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>Data is refreshed on a scheduled basis</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>Update timestamps are displayed throughout the platform</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>Historical data is preserved for auditability</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Data Processing */}
          <section>
            <div className="bg-muted/50 rounded-xl border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Data Processing</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                All data is processed and normalized by CivicScore to create consistent, comparable metrics across all members of Congress. 
                We do not editorialize or add commentary — our goal is to present the facts clearly and let you draw your own conclusions.
              </p>
            </div>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
