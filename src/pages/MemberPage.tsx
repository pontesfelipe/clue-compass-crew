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
  CalendarClock,
  Hash,
  ExternalLink,
  Share2,
  Bookmark,
  Scale,
  Check,
  AlertCircle,
  Twitter,
  Phone,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMember } from "@/hooks/useMembers";
import { stateNames, getStateAbbr } from "@/hooks/useStateData";
import { useComparison } from "@/contexts/ComparisonContext";
import { MemberFinanceSection, FundingProfile } from "@/features/finance";
import { MemberAISummary } from "@/components/MemberAISummary";
import { MemberPolicyAreas } from "@/components/MemberPolicyAreas";
import { ScoringPreferencesDialog } from "@/components/ScoringPreferencesDialog";
import { toast } from "@/hooks/use-toast";
import { VoteDetailDialog } from "@/components/VoteDetailDialog";
import { BillDetailDialog } from "@/components/BillDetailDialog";
import { MemberCommittees } from "@/features/members/components/MemberCommittees";
import { MemberVotingComparison } from "@/features/members/components/MemberVotingComparison";
import { MemberActivity } from "@/features/members/components/MemberActivity";
import { AlignmentWidget } from "@/features/alignment";
import { useMemberTracking } from "@/hooks/useMemberTracking";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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
  // Support both camelCase (mapped) and snake_case (raw) properties
  const billType = bill.billType || bill.bill_type;
  const billNumber = bill.billNumber || bill.bill_number;
  const prefix = typeMap[billType] || billType?.toUpperCase() || "";
  return `${prefix}${billNumber}`;
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

function calculateTerms(startDate: string | null, chamber: string): string {
  if (!startDate) return "N/A";
  const start = new Date(startDate);
  const now = new Date();
  const yearsServed = (now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const termLength = chamber === "senate" ? 6 : 2;
  const terms = Math.ceil(yearsServed / termLength);
  return terms <= 0 ? "1st" : `${terms}${getOrdinalSuffix(terms)}`;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function getNextElection(startDate: string | null, chamber: string): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  if (chamber === "house") {
    // House elections every 2 years (even years)
    const nextElectionYear = currentYear % 2 === 0 
      ? (now.getMonth() >= 11 ? currentYear + 2 : currentYear) // After November, next cycle
      : currentYear + 1;
    return `Nov ${nextElectionYear}`;
  }
  
  // Senate: 6-year terms, staggered classes
  if (!startDate) {
    // Fallback: find next even year
    const nextEven = currentYear % 2 === 0 ? currentYear : currentYear + 1;
    return `Nov ${nextEven}`;
  }
  
  const start = new Date(startDate);
  const startYear = start.getFullYear();
  
  // Calculate which class based on start year pattern
  // Senate classes: Class 1 (2024, 2030), Class 2 (2026, 2032), Class 3 (2028, 2034)
  let nextElectionYear = startYear;
  while (nextElectionYear <= currentYear || (nextElectionYear === currentYear && now.getMonth() >= 11)) {
    nextElectionYear += 6;
  }
  
  return `Nov ${nextElectionYear}`;
}

export default function MemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const { data: member, isLoading, error } = useMember(memberId || "");
  const { addMember, removeMember, isMemberSelected, canAddMore } = useComparison();
  const { user } = useAuth();
  const { isTracking, trackMember, untrackMember, isTrackingPending } = useMemberTracking();
  const queryClient = useQueryClient();
  const [isBackfillPending, setIsBackfillPending] = useState(false);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [selectedVotePosition, setSelectedVotePosition] = useState<string | undefined>();
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const canBackfill = useMemo(() => Boolean(user && member?.id), [user, member?.id]);

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
                  <Button 
                    variant={isTracking(member.id) ? "default" : "civic-outline"} 
                    size="sm"
                    disabled={!user || isTrackingPending}
                    onClick={() => {
                      if (!user) {
                        toast({ title: "Sign in required", description: "Please sign in to track members.", variant: "destructive" });
                        return;
                      }
                      if (isTracking(member.id)) {
                        untrackMember(member.id);
                      } else {
                        trackMember(member.id);
                      }
                    }}
                  >
                    {isTracking(member.id) ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Tracking
                      </>
                    ) : (
                      <>
                        <Bookmark className="mr-2 h-4 w-4" />
                        {user ? "Track" : "Sign in to Track"}
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="civic-ghost" 
                    size="sm"
                    onClick={async () => {
                      const shareUrl = window.location.href;
                      const shareTitle = `${member.fullName} - CivicScore`;
                      const shareText = `Check out ${member.fullName}'s CivicScore - ${chamberDisplay === "Senate" ? "Senator" : "Representative"} from ${stateName}`;
                      
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: shareTitle,
                            text: shareText,
                            url: shareUrl,
                          });
                        } catch (err) {
                          // User cancelled or share failed silently
                          if ((err as Error).name !== 'AbortError') {
                            await navigator.clipboard.writeText(shareUrl);
                            toast({ title: "Link copied to clipboard" });
                          }
                        }
                      } else {
                        await navigator.clipboard.writeText(shareUrl);
                        toast({ title: "Link copied to clipboard" });
                      }
                    }}
                  >
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
                  {member.twitterHandle && (
                    <Button variant="civic-ghost" size="sm" asChild>
                      <a href={`https://x.com/${member.twitterHandle}`} target="_blank" rel="noopener noreferrer">
                        <Twitter className="mr-2 h-4 w-4" />
                        @{member.twitterHandle}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-12">
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
          <StatsCard
            icon={Hash}
            value={calculateTerms(member.startDate, member.chamber)}
            label="Term"
          />
          <StatsCard
            icon={CalendarClock}
            value={getNextElection(member.startDate, member.chamber)}
            label="Next Election"
          />
        </div>

        {/* Contact Section */}
        {(member.phone || member.officeAddress) && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md mb-8">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
              Contact Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {member.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <a 
                      href={`tel:${member.phone}`} 
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {member.phone}
                    </a>
                  </div>
                </div>
              )}
              {member.officeAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Office Address</p>
                    <p className="text-foreground">
                      {member.officeAddress}
                      {member.officeCity && member.officeState && (
                        <><br />{member.officeCity}, {member.officeState} {member.officeZip}</>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Your Alignment */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
            Your Alignment
          </h2>
          <AlignmentWidget politicianId={member.id} politicianName={member.fullName} />
        </div>

        {/* AI Summary and Policy Areas */}
        <div className="grid gap-8 lg:grid-cols-2 mb-8">
          <MemberAISummary memberId={member.id} memberName={member.fullName} />
          <MemberPolicyAreas memberId={member.id} memberState={member.state} memberParty={member.party} />
        </div>

        {/* Committees and Voting Comparison */}
        <div className="grid gap-8 lg:grid-cols-2 mb-8">
          <MemberCommittees memberId={member.id} />
          <MemberVotingComparison 
            memberId={member.id} 
            party={member.party as "D" | "R" | "I" | "L"} 
            state={member.state} 
          />
        </div>

        {/* Funding Profile (FEC Data) */}
        <div className="mb-8">
          <FundingProfile memberId={member.id} />
        </div>

        {/* Recent Activity */}
        <div className="mb-8">
          <MemberActivity memberId={member.id} />
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
              <ScoringPreferencesDialog />
            </div>
          </div>

          {/* Sponsored Bills */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Sponsored Bills
              </h2>
              <Button
                variant="civic-outline"
                size="sm"
                disabled={!canBackfill || isBackfillPending}
                onClick={async () => {
                  if (!user) {
                    toast({
                      title: "Sign in required",
                      description: "Please sign in to refresh sponsored bills.",
                      variant: "destructive",
                    });
                    return;
                  }

                  setIsBackfillPending(true);
                  const t = toast({ title: "Refreshing sponsored bills…", description: "This can take a few seconds." });

                  try {
                    const { data, error } = await supabase.functions.invoke(
                      "backfill-member-sponsored-bills",
                      { body: { memberId: member.id, limit: 25 } },
                    );

                    if (error) throw error;

                    toast({
                      title: "Refresh complete",
                      description: `Added ${data?.sponsorshipsUpserted ?? 0} sponsored bill links.`,
                    });

                    await queryClient.invalidateQueries({ queryKey: ["member", member.id] });
                  } catch (e: any) {
                    toast({
                      title: "Refresh failed",
                      description: e?.message ? String(e.message) : "Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsBackfillPending(false);
                    try {
                      (t as any)?.dismiss?.();
                    } catch {
                      // ignore
                    }
                  }
                }}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", isBackfillPending && "animate-spin")} />
                Refresh
              </Button>
            </div>
            <div className="space-y-4">
              {member.sponsoredBills && member.sponsoredBills.length > 0 ? (
                member.sponsoredBills.map((bill: any, index: number) => {
                  const status = getBillStatus(bill);
                  return (
                    <button
                      key={bill.id}
                      onClick={() => setSelectedBillId(bill.id)}
                      className="w-full text-left block p-4 rounded-lg bg-muted/50 opacity-0 animate-slide-up hover:bg-muted transition-colors cursor-pointer"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
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
                            status === "Passed" && "bg-score-good/10 text-score-good border-score-good/30",
                          )}
                        >
                          {status}
                        </Badge>
                      </div>
                      {bill.policyArea && (
                        <p className="text-xs text-muted-foreground mt-2">{bill.policyArea}</p>
                      )}
                    </button>
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
                    <button 
                      key={bill.id}
                      onClick={() => setSelectedBillId(bill.id)}
                      className="w-full text-left block p-4 rounded-lg bg-muted/50 opacity-0 animate-slide-up hover:bg-muted transition-colors cursor-pointer"
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
                      {bill.policyArea && (
                        <p className="text-xs text-muted-foreground mt-2">{bill.policyArea}</p>
                      )}
                    </button>
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
                  <button 
                    key={vote.id}
                    onClick={() => {
                      setSelectedVoteId(vote.id);
                      setSelectedVotePosition(vote.position);
                    }}
                    className="w-full text-left p-4 rounded-lg bg-muted/50 opacity-0 animate-slide-up hover:bg-muted transition-colors cursor-pointer"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground line-clamp-2">
                          {vote.question || vote.description || `Roll Call #${vote.rollNumber}`}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {vote.voteDate ? new Date(vote.voteDate).toLocaleDateString() : 'Unknown date'}
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
                    {(vote.totalYea || vote.totalNay) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Yea: {vote.totalYea || 0} · Nay: {vote.totalNay || 0}
                      </p>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No vote history available yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Vote Detail Dialog */}
        <VoteDetailDialog 
          voteId={selectedVoteId} 
          memberPosition={selectedVotePosition}
          onClose={() => {
            setSelectedVoteId(null);
            setSelectedVotePosition(undefined);
          }}
        />

        {/* Bill Detail Dialog */}
        <BillDetailDialog 
          billId={selectedBillId}
          onClose={() => setSelectedBillId(null)}
        />

        {/* Financial Relationships Section */}
        <div className="mt-8">
          <MemberFinanceSection memberId={member.id} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
