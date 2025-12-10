import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ExternalLink, Database, DollarSign, FileText, Vote } from "lucide-react";
import { Helmet } from "react-helmet";

export default function DataSourcesPage() {
  const sources = [
    {
      name: "Congress.gov API",
      icon: FileText,
      description: "The official source for congressional information including member details, bill text, sponsorships, and legislative actions.",
      url: "https://api.congress.gov/",
      dataTypes: ["Member profiles", "Bill information", "Sponsorships", "Legislative actions"]
    },
    {
      name: "House Clerk Roll Call Votes",
      icon: Vote,
      description: "Official House of Representatives voting records with detailed roll call information for every vote.",
      url: "https://clerk.house.gov/Votes",
      dataTypes: ["House roll call votes", "Member vote positions", "Vote totals", "Vote dates"]
    },
    {
      name: "Senate.gov Vote Records",
      icon: Vote,
      description: "Official Senate voting records with comprehensive roll call data for all Senate votes.",
      url: "https://www.senate.gov/legislative/votes.htm",
      dataTypes: ["Senate roll call votes", "Senator positions", "Vote results"]
    },
    {
      name: "Federal Election Commission (FEC)",
      icon: DollarSign,
      description: "Campaign finance data including individual contributions, PAC donations, and expenditure reports.",
      url: "https://www.fec.gov/data/",
      dataTypes: ["Campaign contributions", "Donor information", "PAC data", "Expenditures"]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Data Sources - CivicScore</title>
        <meta name="description" content="CivicScore uses official government data sources to provide accurate, reliable information about congressional representatives." />
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

          <div className="space-y-6">
            {sources.map((source) => (
              <div key={source.name} className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <source.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="font-serif text-xl font-bold text-foreground">{source.name}</h2>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <p className="text-muted-foreground mb-4">{source.description}</p>
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

          <div className="mt-12 bg-muted/50 rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Data Processing</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              All data is processed and normalized by CivicScore to create consistent, comparable metrics across all members of Congress. 
              We do not editorialize or add commentary — our goal is to present the facts clearly and let you draw your own conclusions.
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
