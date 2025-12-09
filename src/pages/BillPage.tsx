import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PartyVoteBreakdown } from "@/components/PartyVoteBreakdown";
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  Vote,
  Calendar,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBill, formatBillNumber } from "@/hooks/useBill";

type Party = "D" | "R" | "I" | "L";

const partyColors: Record<Party, string> = {
  D: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  R: "bg-civic-red/10 text-civic-red border-civic-red/30",
  I: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
  L: "bg-civic-gold/10 text-civic-gold border-civic-gold/30",
};

function getBillStatus(bill: any): { label: string; variant: "success" | "warning" | "default" } {
  if (bill.enacted) return { label: "Enacted", variant: "success" };
  if (bill.latest_action_text?.toLowerCase().includes("passed")) return { label: "Passed", variant: "success" };
  if (bill.latest_action_text?.toLowerCase().includes("committee")) return { label: "In Committee", variant: "warning" };
  return { label: "Introduced", variant: "default" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BillPage() {
  const { billId } = useParams<{ billId: string }>();
  const { data: bill, isLoading, error } = useBill(billId || "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8 lg:py-12">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8 lg:py-12">
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">
              Bill Not Found
            </h1>
            <p className="text-muted-foreground mb-6">
              We couldn't find the bill you're looking for.
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

  const status = getBillStatus(bill);
  const billNumber = formatBillNumber(bill);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        {/* Bill Header */}
        <div className="mb-12">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant="secondary" className="text-sm font-mono">
              {billNumber}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {bill.congress}th Congress
            </Badge>
            <Badge 
              variant="outline" 
              className={cn(
                "text-sm",
                status.variant === "success" && "bg-score-excellent/10 text-score-excellent border-score-excellent/30",
                status.variant === "warning" && "bg-score-average/10 text-score-average border-score-average/30"
              )}
            >
              {status.label}
            </Badge>
          </div>
          
          <h1 className="font-serif text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl mb-4 leading-tight">
            {bill.short_title || bill.title}
          </h1>
          
          {bill.short_title && bill.title !== bill.short_title && (
            <p className="text-muted-foreground text-lg">
              {bill.title}
            </p>
          )}

          {bill.url && (
            <Button variant="civic-outline" size="sm" className="mt-6" asChild>
              <a href={bill.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Congress.gov
              </a>
            </Button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Key Dates */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Timeline
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Introduced</p>
                    <p className="text-sm text-muted-foreground">{formatDate(bill.introduced_date)}</p>
                  </div>
                </div>
                
                {bill.latest_action_date && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-score-average/10">
                      <Vote className="h-4 w-4 text-score-average" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Latest Action</p>
                      <p className="text-sm text-muted-foreground">{formatDate(bill.latest_action_date)}</p>
                      {bill.latest_action_text && (
                        <p className="text-sm text-muted-foreground mt-1">{bill.latest_action_text}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {bill.enacted && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-score-excellent/10">
                      <CheckCircle className="h-4 w-4 text-score-excellent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Enacted</p>
                      <p className="text-sm text-muted-foreground">{formatDate(bill.enacted_date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            {bill.summary && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                  Summary
                </h2>
                <div 
                  className="text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: bill.summary }}
                />
              </div>
            )}

            {/* Vote Results */}
            {bill.votes && bill.votes.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                  <Vote className="h-5 w-5 text-muted-foreground" />
                  Vote Results
                </h2>
                <div className="space-y-4">
                  {bill.votes.map((vote: any) => (
                    <div key={vote.id} className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {vote.question || `Roll Call #${vote.roll_number}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(vote.vote_date)} · {vote.chamber === "senate" ? "Senate" : "House"}
                          </p>
                        </div>
                        <Badge 
                          variant="outline"
                          className={cn(
                            "text-xs",
                            vote.result?.toLowerCase().includes("passed") && "bg-score-excellent/10 text-score-excellent border-score-excellent/30",
                            vote.result?.toLowerCase().includes("failed") && "bg-score-bad/10 text-score-bad border-score-bad/30"
                          )}
                        >
                          {vote.result}
                        </Badge>
                      </div>
                      
                      {/* Vote Breakdown Bar */}
                      <div className="space-y-2">
                        <div className="flex gap-1 h-4 rounded-full overflow-hidden bg-muted">
                          {vote.total_yea > 0 && (
                            <div 
                              className="bg-score-excellent transition-all"
                              style={{ width: `${(vote.total_yea / (vote.total_yea + vote.total_nay + (vote.total_present || 0) + (vote.total_not_voting || 0))) * 100}%` }}
                            />
                          )}
                          {vote.total_nay > 0 && (
                            <div 
                              className="bg-score-bad transition-all"
                              style={{ width: `${(vote.total_nay / (vote.total_yea + vote.total_nay + (vote.total_present || 0) + (vote.total_not_voting || 0))) * 100}%` }}
                            />
                          )}
                          {(vote.total_present || 0) > 0 && (
                            <div 
                              className="bg-score-average transition-all"
                              style={{ width: `${((vote.total_present || 0) / (vote.total_yea + vote.total_nay + (vote.total_present || 0) + (vote.total_not_voting || 0))) * 100}%` }}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-score-excellent" />
                            Yea: {vote.total_yea}
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-score-bad" />
                            Nay: {vote.total_nay}
                          </span>
                          {(vote.total_present || 0) > 0 && (
                            <span className="text-muted-foreground">Present: {vote.total_present}</span>
                          )}
                          {(vote.total_not_voting || 0) > 0 && (
                            <span className="text-muted-foreground">Not Voting: {vote.total_not_voting}</span>
                          )}
                        </div>
                        
                        {/* Party Breakdown */}
                        <PartyVoteBreakdown voteId={vote.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Policy Area & Subjects */}
            {(bill.policy_area || (bill.subjects && bill.subjects.length > 0)) && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                  Topics
                </h2>
                <div className="flex flex-wrap gap-2">
                  {bill.policy_area && (
                    <Badge variant="secondary" className="text-sm">
                      {bill.policy_area}
                    </Badge>
                  )}
                  {bill.subjects?.slice(0, 10).map((subject: string) => (
                    <Badge key={subject} variant="outline" className="text-sm">
                      {subject}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Sponsors */}
          <div className="space-y-6">
            {/* Primary Sponsor */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                Sponsor
              </h2>
              {bill.primarySponsor ? (
                <Link 
                  to={`/member/${bill.primarySponsor.member.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="relative h-12 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {bill.primarySponsor.member.image_url ? (
                      <img
                        src={bill.primarySponsor.member.image_url}
                        alt={bill.primarySponsor.member.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {bill.primarySponsor.member.full_name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", partyColors[bill.primarySponsor.member.party])}
                      >
                        {bill.primarySponsor.member.party}
                      </Badge>
                      <span>{bill.primarySponsor.member.state}</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <p className="text-muted-foreground text-center py-4">No sponsor information available</p>
              )}
            </div>

            {/* Cosponsors */}
            {bill.cosponsors && bill.cosponsors.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  Cosponsors ({bill.cosponsors.length})
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {bill.cosponsors.slice(0, 20).map((cosponsor: any) => (
                    <Link 
                      key={cosponsor.id}
                      to={`/member/${cosponsor.member.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="relative h-8 w-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {cosponsor.member.image_url ? (
                          <img
                            src={cosponsor.member.image_url}
                            alt={cosponsor.member.full_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-muted-foreground">
                            {cosponsor.member.full_name?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {cosponsor.member.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cosponsor.member.party} · {cosponsor.member.state}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {bill.cosponsors.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      +{bill.cosponsors.length - 20} more cosponsors
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
