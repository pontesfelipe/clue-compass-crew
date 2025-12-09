import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScoreRing } from "@/components/ScoreRing";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { StatsCard } from "@/components/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  FileText, 
  Vote, 
  Users, 
  Calendar,
  ExternalLink,
  Share2,
  Bookmark,
  Scale,
  Check,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMember } from "@/hooks/useMembers";
import { stateNames, getStateAbbr } from "@/hooks/useStateData";
import { useComparison } from "@/contexts/ComparisonContext";

type Party = "D" | "R" | "I";

const partyColors: Record<Party, string> = {
  D: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  R: "bg-civic-red/10 text-civic-red border-civic-red/30",
  I: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
};

const partyNames: Record<Party, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

function formatBillNumber(bill: any): string {
  const typeMap: Record<string, string> = {
    hr: "H.R.",
    s: "S.",
    hjres: "H.J.Res.",
    sjres: "S.J.Res.",
    hconres: "H.Con.Res.",
    sconres: "S.Con.Res.",
    hres: "H.Res.",
    sres: "S.Res.",
  };
  const prefix = typeMap[bill.bill_type] || bill.bill_type?.toUpperCase() || "";
  return `${prefix}${bill.bill_number}`;
}

function getBillStatus(bill: any): string {
  if (bill.enacted) return "Enacted";
  if (bill.latest_action_text?.toLowerCase().includes("passed")) return "Passed";
  if (bill.latest_action_text?.toLowerCase().includes("committee")) return "In Committee";
  return "Introduced";
}

function calculateYearsInOffice(startDate: string | null): string {
  if (!startDate) return "N/A";
  const start = new Date(startDate);
  const now = new Date();
  const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) return "< 1 yr";
  return `${years} yr${years > 1 ? "s" : ""}`;
}

export default function MemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const { data: member, isLoading, error } = useMember(memberId || "");
  const { addMember, removeMember, isMemberSelected, canAddMore } = useComparison();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8 lg:py-12">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="grid gap-8 lg:grid-cols-3 mb-12">
            <div className="lg:col-span-2">
              <div className="flex gap-6">
                <Skeleton className="h-32 w-32 rounded-2xl" />
                <div className="flex-1 space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-10 w-64" />
                  <Skeleton className="h-5 w-48" />
                </div>
              </div>
            </div>
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8 lg:py-12">
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">
              Member Not Found
            </h1>
            <p className="text-muted-foreground mb-6">
              We couldn't find the member you're looking for.
            </p>
            <Button variant="civic" asChild>
              <Link to="/map">Back to Map</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const stateName = stateNames[member.state] || member.state;
  const chamberDisplay = member.chamber === "senate" ? "Senate" : "House";
  const scores = member.scores;

  const scoreBreakdown = scores ? [
    { name: "Productivity", score: Number(scores.productivityScore) || 0, weight: 25, description: "Bills sponsored and enacted" },
    { name: "Attendance", score: Number(scores.attendanceScore) || 0, weight: 25, description: "Voting participation rate" },
    { name: "Bipartisanship", score: Number(scores.bipartisanshipScore) || 0, weight: 25, description: "Cross-party collaboration" },
    { name: "Issue Alignment", score: Number(scores.issueAlignmentScore) || 0, weight: 25, description: "Based on your preferences" },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
            <Link to={`/state/${getStateAbbr(member.state)}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {stateName}
            </Link>
          </Button>
        </div>

        {/* Member Header */}
        <div className="grid gap-8 lg:grid-cols-3 mb-12">
          <div className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Photo */}
              <div className="relative flex-shrink-0">
                {member.imageUrl ? (
                  <img
                    src={member.imageUrl}
                    alt={member.fullName}
                    className="h-32 w-32 rounded-2xl object-cover border-2 border-border shadow-civic-md"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-muted border-2 border-border shadow-civic-md">
                    <span className="text-3xl font-semibold text-muted-foreground font-serif">
                      {member.firstName?.[0]}{member.lastName?.[0]}
                    </span>
                  </div>
                )}
                <div className={cn(
                  "absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-4 border-background flex items-center justify-center text-sm font-bold",
                  member.party === "D" ? "bg-civic-blue text-primary-foreground" : 
                  member.party === "R" ? "bg-civic-red text-primary-foreground" : 
                  "bg-civic-slate text-primary-foreground"
                )}>
                  {member.party}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge 
                    variant="outline" 
                    className={cn("text-sm", partyColors[member.party])}
                  >
                    {partyNames[member.party]}
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    {chamberDisplay}
                  </Badge>
                  {member.district && (
                    <Badge variant="outline" className="text-sm">
                      District {member.district}
                    </Badge>
                  )}
                </div>
                
                <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl mb-2">
                  {member.fullName}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {chamberDisplay === "Senate" ? "Senator" : "Representative"} from {stateName}
                </p>
                
                <div className="flex flex-wrap gap-4 mt-6">
                  <Button 
                    variant={isMemberSelected(member.id) ? "default" : "civic-outline"} 
                    size="sm"
                    onClick={() => {
                      if (isMemberSelected(member.id)) {
                        removeMember(member.id);
                      } else if (canAddMore) {
                        addMember({
                          id: member.id,
                          name: member.fullName,
                          party: member.party,
                          state: member.state,
                          chamber: member.chamber === "senate" ? "Senate" : "House",
                          imageUrl: member.imageUrl,
                        });
                      }
                    }}
                    disabled={!isMemberSelected(member.id) && !canAddMore}
                  >
                    {isMemberSelected(member.id) ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Added to Compare
                      </>
                    ) : (
                      <>
                        <Scale className="mr-2 h-4 w-4" />
                        Compare
                      </>
                    )}
                  </Button>
                  <Button variant="civic-outline" size="sm">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Track
                  </Button>
                  <Button variant="civic-ghost" size="sm">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  {member.websiteUrl && (
                    <Button variant="civic-ghost" size="sm" asChild>
                      <a href={member.websiteUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Website
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Score Card */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-civic-md">
            <div className="flex flex-col items-center text-center">
              <p className="text-sm font-medium text-muted-foreground mb-4">Overall Score</p>
              <ScoreRing score={member.score ?? 0} size="xl" />
              <p className="text-sm text-muted-foreground mt-4">
                {chamberDisplay} · {stateName}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          <StatsCard
            icon={FileText}
            value={scores?.billsSponsored ?? 0}
            label="Bills Sponsored"
          />
          <StatsCard
            icon={Users}
            value={scores?.billsCosponsored ?? 0}
            label="Bills Co-sponsored"
          />
          <StatsCard
            icon={Vote}
            value={`${scores?.attendanceScore ?? 0}%`}
            label="Attendance Rate"
          />
          <StatsCard
            icon={Calendar}
            value={calculateYearsInOffice(member.startDate)}
            label="Time in Office"
          />
        </div>

        {/* Score Breakdown and Bills Grid */}
        <div className="grid gap-8 lg:grid-cols-2 mb-8">
          {/* Score Breakdown */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
              Score Breakdown
            </h2>
            {scoreBreakdown.length > 0 ? (
              <ScoreBreakdown categories={scoreBreakdown} />
            ) : (
              <p className="text-muted-foreground">No score data available.</p>
            )}
            <div className="mt-6 pt-6 border-t border-border">
              <Button variant="civic-outline" size="sm" className="w-full">
                Customize Weights
              </Button>
            </div>
          </div>

          {/* Sponsored Bills */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
              Sponsored Bills
            </h2>
            <div className="space-y-4">
              {member.sponsoredBills && member.sponsoredBills.length > 0 ? (
                member.sponsoredBills.map((bill: any, index: number) => {
                  const status = getBillStatus(bill);
                  return (
                    <Link 
                      to={`/bill/${bill.id}`}
                      key={bill.id}
                      className="block p-4 rounded-lg bg-muted/50 opacity-0 animate-slide-up hover:bg-muted transition-colors"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground line-clamp-2">
                            {bill.short_title || bill.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatBillNumber(bill)}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs whitespace-nowrap flex-shrink-0",
                            status === "Enacted" && "bg-score-excellent/10 text-score-excellent border-score-excellent/30",
                            status === "Passed" && "bg-score-good/10 text-score-good border-score-good/30"
                          )}
                        >
                          {status}
                        </Badge>
                      </div>
                      {bill.policy_area && (
                        <p className="text-xs text-muted-foreground mt-2">{bill.policy_area}</p>
                      )}
                    </Link>
                  );
                })
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No sponsored bills yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cosponsored Bills and Vote History */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Cosponsored Bills */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Cosponsored Bills
              </h2>
            </div>
            <div className="space-y-4">
              {member.cosponsoredBills && member.cosponsoredBills.length > 0 ? (
                member.cosponsoredBills.map((bill: any, index: number) => {
                  const status = getBillStatus(bill);
                  return (
                    <Link 
                      to={`/bill/${bill.id}`}
                      key={bill.id}
                      className="block p-4 rounded-lg bg-muted/50 opacity-0 animate-slide-up hover:bg-muted transition-colors"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground line-clamp-2">
                            {bill.short_title || bill.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatBillNumber(bill)}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs whitespace-nowrap flex-shrink-0",
                            status === "Enacted" && "bg-score-excellent/10 text-score-excellent border-score-excellent/30",
                            status === "Passed" && "bg-score-good/10 text-score-good border-score-good/30"
                          )}
                        >
                          {status}
                        </Badge>
                      </div>
                      {bill.policy_area && (
                        <p className="text-xs text-muted-foreground mt-2">{bill.policy_area}</p>
                      )}
                    </Link>
                  );
                })
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No cosponsored bills yet.
                </p>
              )}
            </div>
          </div>

          {/* Vote History */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
            <div className="flex items-center gap-2 mb-6">
              <Vote className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Recent Votes
              </h2>
            </div>
            <div className="space-y-4">
              {member.voteHistory && member.voteHistory.length > 0 ? (
                member.voteHistory.map((vote: any, index: number) => (
                  <div 
                    key={vote.id}
                    className="p-4 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground line-clamp-2">
                          {vote.question || vote.description || `Roll Call #${vote.roll_number}`}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {vote.vote_date ? new Date(vote.vote_date).toLocaleDateString() : 'Unknown date'}
                          {vote.result && ` · ${vote.result}`}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs whitespace-nowrap flex-shrink-0 capitalize",
                          vote.position === "yea" && "bg-score-excellent/10 text-score-excellent border-score-excellent/30",
                          vote.position === "nay" && "bg-score-bad/10 text-score-bad border-score-bad/30",
                          vote.position === "present" && "bg-score-average/10 text-score-average border-score-average/30",
                          vote.position === "not_voting" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {vote.position === "not_voting" ? "Not Voting" : vote.position}
                      </Badge>
                    </div>
                    {(vote.total_yea || vote.total_nay) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Yea: {vote.total_yea || 0} · Nay: {vote.total_nay || 0}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No vote history available yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
