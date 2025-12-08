import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScoreRing } from "@/components/ScoreRing";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { StatsCard } from "@/components/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  FileText, 
  Vote, 
  Users, 
  Calendar,
  ExternalLink,
  Share2,
  Bookmark
} from "lucide-react";
import { cn } from "@/lib/utils";

type Party = "D" | "R" | "I";

// Mock data - would be fetched from API
const memberData: {
  id: string;
  name: string;
  party: Party;
  state: string;
  stateAbbr: string;
  chamber: string;
  district: string | null;
  termStart: string;
  website: string;
  phone: string;
  office: string;
  score: number;
  imageUrl: string | null;
  scores: { name: string; score: number; weight: number; description: string }[];
  recentBills: { number: string; title: string; status: string; date: string }[];
} = {
  id: "A000360",
  name: "Susan Collins",
  party: "R",
  state: "Maine",
  stateAbbr: "ME",
  chamber: "Senate",
  district: null,
  termStart: "1997-01-07",
  website: "https://www.collins.senate.gov",
  phone: "(202) 224-2523",
  office: "413 Dirksen Senate Office Building",
  score: 85,
  imageUrl: null,
  scores: [
    { name: "Productivity", score: 82, weight: 25, description: "Bills sponsored and enacted" },
    { name: "Attendance", score: 96, weight: 25, description: "Voting participation rate" },
    { name: "Bipartisanship", score: 91, weight: 30, description: "Cross-party collaboration" },
    { name: "Issue Alignment", score: 72, weight: 20, description: "Based on your preferences" },
  ],
  recentBills: [
    { number: "S.1234", title: "Infrastructure Investment Act", status: "Passed Senate", date: "2024-03-15" },
    { number: "S.567", title: "Healthcare Access Improvement Act", status: "In Committee", date: "2024-02-28" },
    { number: "S.890", title: "Small Business Relief Act", status: "Passed", date: "2024-01-20" },
  ]
};

const partyColors = {
  D: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  R: "bg-civic-red/10 text-civic-red border-civic-red/30",
  I: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
};

const partyNames = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

export default function MemberPage() {
  const { memberId } = useParams<{ memberId: string }>();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
            <Link to={`/state/${memberData.stateAbbr}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {memberData.state}
            </Link>
          </Button>
        </div>

        {/* Member Header */}
        <div className="grid gap-8 lg:grid-cols-3 mb-12">
          <div className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Photo */}
              <div className="relative flex-shrink-0">
                {memberData.imageUrl ? (
                  <img
                    src={memberData.imageUrl}
                    alt={memberData.name}
                    className="h-32 w-32 rounded-2xl object-cover border-2 border-border shadow-civic-md"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-muted border-2 border-border shadow-civic-md">
                    <span className="text-3xl font-semibold text-muted-foreground font-serif">
                      {memberData.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                )}
                <div className={cn(
                  "absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-4 border-background flex items-center justify-center text-sm font-bold",
                  memberData.party === "D" ? "bg-civic-blue text-primary-foreground" : 
                  memberData.party === "R" ? "bg-civic-red text-primary-foreground" : 
                  "bg-civic-slate text-primary-foreground"
                )}>
                  {memberData.party}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge 
                    variant="outline" 
                    className={cn("text-sm", partyColors[memberData.party])}
                  >
                    {partyNames[memberData.party]}
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    {memberData.chamber}
                  </Badge>
                </div>
                
                <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl mb-2">
                  {memberData.name}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {memberData.chamber === "Senate" ? "Senator" : "Representative"} from {memberData.state}
                </p>
                
                <div className="flex flex-wrap gap-4 mt-6">
                  <Button variant="civic" size="sm">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Track
                  </Button>
                  <Button variant="civic-outline" size="sm">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  <Button variant="civic-ghost" size="sm" asChild>
                    <a href={memberData.website} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Official Website
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Score Card */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-civic-md">
            <div className="flex flex-col items-center text-center">
              <p className="text-sm font-medium text-muted-foreground mb-4">Overall Score</p>
              <ScoreRing score={memberData.score} size="xl" />
              <p className="text-sm text-muted-foreground mt-4">
                Top 15% in {memberData.chamber}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          <StatsCard
            icon={FileText}
            value="47"
            label="Bills Sponsored"
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            icon={Users}
            value="156"
            label="Bills Co-sponsored"
          />
          <StatsCard
            icon={Vote}
            value="96%"
            label="Attendance Rate"
            trend={{ value: 2, isPositive: true }}
          />
          <StatsCard
            icon={Calendar}
            value="28 yrs"
            label="Time in Office"
          />
        </div>

        {/* Score Breakdown and Bills Grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Score Breakdown */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
              Score Breakdown
            </h2>
            <ScoreBreakdown categories={memberData.scores} />
            <div className="mt-6 pt-6 border-t border-border">
              <Button variant="civic-outline" size="sm" className="w-full">
                Customize Weights
              </Button>
            </div>
          </div>

          {/* Recent Bills */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
              Recent Bills
            </h2>
            <div className="space-y-4">
              {memberData.recentBills.map((bill, index) => (
                <div 
                  key={bill.number}
                  className="p-4 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{bill.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{bill.number}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs whitespace-nowrap",
                        bill.status.includes("Passed") && "bg-score-excellent/10 text-score-excellent border-score-excellent/30"
                      )}
                    >
                      {bill.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{bill.date}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <Button variant="civic-ghost" size="sm" className="w-full">
                View All Bills
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
