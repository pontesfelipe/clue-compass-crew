import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Database, Users, FileText, Vote, DollarSign, Building, Activity, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";

interface DataSourceInfo {
  table: string;
  source: string;
  syncFunction: string;
  fields: { name: string; source: string; notes: string }[];
}

// UI Section to Data Source mapping - mirrors MemberPage layout
interface UISectionMapping {
  section: string;
  description: string;
  component?: string;
  tables: string[];
  syncFunctions: string[];
  fields: { uiField: string; dbField: string; table: string; source: string }[];
}

const uiSectionMappings: UISectionMapping[] = [
  {
    section: "Member Header",
    description: "Photo, name, party, state, chamber, district badges",
    component: "MemberPage (inline)",
    tables: ["members"],
    syncFunctions: ["sync-congress-members"],
    fields: [
      { uiField: "Photo", dbField: "image_url", table: "members", source: "Congress.gov /member/{id} → depiction.imageUrl" },
      { uiField: "Full Name", dbField: "full_name", table: "members", source: "Congress.gov /member → name" },
      { uiField: "First Name", dbField: "first_name", table: "members", source: "Congress.gov /member → parsed from name" },
      { uiField: "Last Name", dbField: "last_name", table: "members", source: "Congress.gov /member → parsed from name" },
      { uiField: "Party Badge", dbField: "party", table: "members", source: "Congress.gov /member → partyName (D/R/I)" },
      { uiField: "Chamber Badge", dbField: "chamber", table: "members", source: "Inferred: has district = house, else senate" },
      { uiField: "District Badge", dbField: "district", table: "members", source: "Congress.gov /member → district (House only)" },
      { uiField: "State", dbField: "state", table: "members", source: "Congress.gov /member → state" },
      { uiField: "Website Button", dbField: "website_url", table: "members", source: "Congress.gov /member/{id} → officialWebsiteUrl" },
      { uiField: "Twitter Button", dbField: "twitter_handle", table: "members", source: "Congress.gov /member/{id} → depiction or manual" },
    ],
  },
  {
    section: "Score Card",
    description: "Overall score ring in the header",
    component: "ScoreRing",
    tables: ["member_scores"],
    syncFunctions: ["calculate-member-scores"],
    fields: [
      { uiField: "Overall Score", dbField: "overall_score", table: "member_scores", source: "Calculated: weighted avg of sub-scores" },
    ],
  },
  {
    section: "Stats Row",
    description: "6 stat cards below header",
    component: "StatsCard",
    tables: ["member_scores", "members"],
    syncFunctions: ["calculate-member-scores", "sync-congress-members"],
    fields: [
      { uiField: "Bills Sponsored", dbField: "bills_sponsored", table: "member_scores", source: "COUNT from bill_sponsorships WHERE is_sponsor=true" },
      { uiField: "Bills Co-sponsored", dbField: "bills_cosponsored", table: "member_scores", source: "COUNT from bill_sponsorships WHERE is_sponsor=false" },
      { uiField: "Attendance Rate", dbField: "attendance_score", table: "member_scores", source: "Calculated: votes_cast / total_votes × 100" },
      { uiField: "Time in Office", dbField: "start_date", table: "members", source: "Congress.gov /member/{id} → terms[0].startDate" },
      { uiField: "Term", dbField: "start_date", table: "members", source: "Calculated from start_date + chamber type" },
      { uiField: "Next Election", dbField: "start_date", table: "members", source: "Calculated from start_date + chamber (2yr House, 6yr Senate)" },
    ],
  },
  {
    section: "Contact Information",
    description: "Phone and office address",
    component: "MemberPage (inline)",
    tables: ["members"],
    syncFunctions: ["sync-congress-members"],
    fields: [
      { uiField: "Phone", dbField: "phone", table: "members", source: "Congress.gov /member/{id} → addressInformation.phoneNumber" },
      { uiField: "Office Address", dbField: "office_address", table: "members", source: "Congress.gov /member/{id} → addressInformation.officeAddress" },
      { uiField: "Office City", dbField: "office_city", table: "members", source: "Congress.gov /member/{id} → addressInformation.city" },
      { uiField: "Office State", dbField: "office_state", table: "members", source: "Congress.gov /member/{id} → addressInformation.district" },
      { uiField: "Office Zip", dbField: "office_zip", table: "members", source: "Congress.gov /member/{id} → addressInformation.zipCode" },
    ],
  },
  {
    section: "Your Alignment",
    description: "Personalized alignment score widget",
    component: "AlignmentWidget",
    tables: ["user_politician_alignment", "politician_issue_positions", "user_answers", "user_issue_priorities"],
    syncFunctions: ["compute-politician-positions", "classify-issue-signals"],
    fields: [
      { uiField: "Alignment Score", dbField: "overall_alignment", table: "user_politician_alignment", source: "Calculated: user answers vs politician positions" },
      { uiField: "Issue Breakdown", dbField: "breakdown", table: "user_politician_alignment", source: "JSON: per-issue alignment scores" },
      { uiField: "Politician Position", dbField: "score_value", table: "politician_issue_positions", source: "Calculated from issue_signals (bills/votes)" },
    ],
  },
  {
    section: "AI Summary",
    description: "AI-generated activity summary",
    component: "MemberAISummary",
    tables: ["member_summaries"],
    syncFunctions: ["generate-member-summary (on-demand)"],
    fields: [
      { uiField: "Summary Text", dbField: "summary", table: "member_summaries", source: "AI Generated via Lovable AI (gemini-2.5-flash)" },
      { uiField: "Generated Date", dbField: "generated_at", table: "member_summaries", source: "Timestamp when generated (1/month limit)" },
    ],
  },
  {
    section: "Policy Areas",
    description: "Top 10 policy areas with state/party comparison",
    component: "MemberPolicyAreas",
    tables: ["bill_sponsorships", "bills"],
    syncFunctions: ["sync-bills"],
    fields: [
      { uiField: "Policy Area Name", dbField: "policy_area", table: "bills", source: "Congress.gov /bill/{id} → policyArea.name" },
      { uiField: "Bill Count", dbField: "count(*)", table: "bill_sponsorships", source: "Aggregated from bill_sponsorships JOIN bills" },
    ],
  },
  {
    section: "Committees",
    description: "Committee assignments with roles",
    component: "MemberCommittees",
    tables: ["member_committees"],
    syncFunctions: ["sync-member-details"],
    fields: [
      { uiField: "Committee Name", dbField: "committee_name", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].name" },
      { uiField: "Committee Code", dbField: "committee_code", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].systemCode" },
      { uiField: "Chamber", dbField: "chamber", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].chamber" },
      { uiField: "Chair Badge", dbField: "is_chair", table: "member_committees", source: "Inferred from assignment data" },
      { uiField: "Ranking Badge", dbField: "is_ranking_member", table: "member_committees", source: "Inferred from assignment data" },
    ],
  },
  {
    section: "Voting Comparison",
    description: "Party and state delegation alignment",
    component: "MemberVotingComparison",
    tables: ["member_votes", "members"],
    syncFunctions: ["sync-votes"],
    fields: [
      { uiField: "Party Alignment %", dbField: "position", table: "member_votes", source: "Calculated: member votes vs party majority on each vote" },
      { uiField: "State Alignment %", dbField: "position", table: "member_votes", source: "Calculated: member votes vs state delegation majority" },
      { uiField: "Total Votes", dbField: "count(*)", table: "member_votes", source: "Count of member_votes records" },
    ],
  },
  {
    section: "Funding Profile",
    description: "Campaign finance metrics and charts",
    component: "FundingProfile",
    tables: ["funding_metrics"],
    syncFunctions: ["sync-fec-funding"],
    fields: [
      { uiField: "Total Receipts", dbField: "total_receipts", table: "funding_metrics", source: "FEC API /candidate/{id}/totals → receipts" },
      { uiField: "Individual %", dbField: "pct_from_individuals", table: "funding_metrics", source: "Calculated: individual_contributions / total" },
      { uiField: "PAC %", dbField: "pct_from_committees", table: "funding_metrics", source: "Calculated: committee_contributions / total" },
      { uiField: "Small Donor %", dbField: "pct_from_small_donors", table: "funding_metrics", source: "Calculated: contributions < $200 / total" },
      { uiField: "In-State %", dbField: "pct_from_in_state", table: "funding_metrics", source: "Calculated from contributor_state matching member state" },
      { uiField: "Grassroots Score", dbField: "grassroots_support_score", table: "funding_metrics", source: "Calculated: based on small donor %" },
      { uiField: "PAC Dependence", dbField: "pac_dependence_score", table: "funding_metrics", source: "Calculated: based on PAC %" },
      { uiField: "Local Money Score", dbField: "local_money_score", table: "funding_metrics", source: "Calculated: based on in-state %" },
    ],
  },
  {
    section: "Recent Activity",
    description: "Member statements and recent actions",
    component: "MemberActivity",
    tables: ["member_statements"],
    syncFunctions: ["sync-member-details"],
    fields: [
      { uiField: "Activity Title", dbField: "title", table: "member_statements", source: "Congress.gov /member/{id}/sponsored-legislation → title" },
      { uiField: "Activity Date", dbField: "statement_date", table: "member_statements", source: "Congress.gov → introducedDate" },
      { uiField: "Activity Type", dbField: "statement_type", table: "member_statements", source: "Hardcoded: 'sponsored_bill'" },
      { uiField: "Subjects", dbField: "subjects", table: "member_statements", source: "Congress.gov → policyArea.name" },
    ],
  },
  {
    section: "Score Breakdown",
    description: "Detailed score categories with weights",
    component: "ScoreBreakdown",
    tables: ["member_scores"],
    syncFunctions: ["calculate-member-scores"],
    fields: [
      { uiField: "Productivity Score", dbField: "productivity_score", table: "member_scores", source: "Calculated: bills sponsored × weight + enacted × bonus" },
      { uiField: "Attendance Score", dbField: "attendance_score", table: "member_scores", source: "Calculated: votes_cast / total_votes × 100" },
      { uiField: "Bipartisanship Score", dbField: "bipartisanship_score", table: "member_scores", source: "Calculated: cross-party bill collaborations" },
      { uiField: "Issue Alignment", dbField: "issue_alignment_score", table: "member_scores", source: "Calculated: based on user preferences (if set)" },
    ],
  },
  {
    section: "Sponsored Bills",
    description: "List of bills where member is primary sponsor",
    component: "MemberPage (inline)",
    tables: ["bill_sponsorships", "bills"],
    syncFunctions: ["sync-bills"],
    fields: [
      { uiField: "Bill Title", dbField: "short_title, title", table: "bills", source: "Congress.gov /bill → title or shortTitle[0].title" },
      { uiField: "Bill Number", dbField: "bill_type, bill_number", table: "bills", source: "Congress.gov /bill → type + number (e.g., H.R. 123)" },
      { uiField: "Status Badge", dbField: "enacted, latest_action_text", table: "bills", source: "Congress.gov /bill → latestAction.text, actions" },
      { uiField: "Policy Area", dbField: "policy_area", table: "bills", source: "Congress.gov /bill → policyArea.name" },
    ],
  },
  {
    section: "Cosponsored Bills",
    description: "List of bills where member is cosponsor",
    component: "MemberPage (inline)",
    tables: ["bill_sponsorships", "bills"],
    syncFunctions: ["sync-bills"],
    fields: [
      { uiField: "Bill Title", dbField: "short_title, title", table: "bills", source: "Congress.gov /bill → title or shortTitle[0].title" },
      { uiField: "Bill Number", dbField: "bill_type, bill_number", table: "bills", source: "Congress.gov /bill → type + number" },
      { uiField: "Status Badge", dbField: "enacted, latest_action_text", table: "bills", source: "Congress.gov /bill → latestAction.text" },
      { uiField: "Policy Area", dbField: "policy_area", table: "bills", source: "Congress.gov /bill → policyArea.name" },
    ],
  },
  {
    section: "Recent Votes",
    description: "Vote history with position badges",
    component: "MemberPage (inline)",
    tables: ["member_votes", "votes"],
    syncFunctions: ["sync-votes"],
    fields: [
      { uiField: "Vote Question", dbField: "question", table: "votes", source: "Congress.gov /vote → question OR House Clerk XML" },
      { uiField: "Vote Date", dbField: "vote_date", table: "votes", source: "Congress.gov /vote → date" },
      { uiField: "Position Badge", dbField: "position", table: "member_votes", source: "House Clerk XML or Senate.gov XML → Yea/Nay/Present/NotVoting" },
      { uiField: "Result", dbField: "result", table: "votes", source: "Congress.gov /vote → result" },
      { uiField: "Yea/Nay Counts", dbField: "total_yea, total_nay", table: "votes", source: "Congress.gov /vote → count.yea, count.nay" },
    ],
  },
  {
    section: "Financial Relationships",
    description: "Contributors, lobbying, and sponsors tabs",
    component: "MemberFinanceSection",
    tables: ["member_contributions", "member_lobbying", "member_sponsors"],
    syncFunctions: ["sync-fec-finance"],
    fields: [
      { uiField: "Contributor Name", dbField: "contributor_name", table: "member_contributions", source: "FEC API /schedules/schedule_a → contributor_name" },
      { uiField: "Contribution Amount", dbField: "amount", table: "member_contributions", source: "FEC API /schedules/schedule_a → contribution_receipt_amount" },
      { uiField: "Contributor Type", dbField: "contributor_type", table: "member_contributions", source: "Inferred from employer/occupation/entity_type" },
      { uiField: "Contributor State", dbField: "contributor_state", table: "member_contributions", source: "FEC API /schedules/schedule_a → contributor_state" },
      { uiField: "Industry", dbField: "industry", table: "member_contributions", source: "Inferred from contributor employer/occupation" },
      { uiField: "Lobbying Industry", dbField: "industry", table: "member_lobbying", source: "OpenSecrets/lobbying data (if integrated)" },
      { uiField: "Lobbying Amount", dbField: "total_spent", table: "member_lobbying", source: "OpenSecrets/lobbying data (if integrated)" },
      { uiField: "Sponsor Name", dbField: "sponsor_name", table: "member_sponsors", source: "Aggregated from major contributors > $5000" },
      { uiField: "Sponsor Total", dbField: "total_support", table: "member_sponsors", source: "SUM(contributions) from same contributor" },
    ],
  },
];

const dataSources: DataSourceInfo[] = [
  {
    table: "members",
    source: "Congress.gov API",
    syncFunction: "sync-congress-members",
    fields: [
      { name: "bioguide_id", source: "/member endpoint", notes: "Unique Congress identifier" },
      { name: "full_name", source: "/member endpoint", notes: "From member.name" },
      { name: "first_name", source: "/member endpoint", notes: "Parsed from name" },
      { name: "last_name", source: "/member endpoint", notes: "Parsed from name" },
      { name: "party", source: "/member endpoint", notes: "From partyName field" },
      { name: "state", source: "/member endpoint", notes: "From state field" },
      { name: "chamber", source: "/member endpoint", notes: "Inferred from district presence" },
      { name: "district", source: "/member endpoint", notes: "For House members only" },
      { name: "image_url", source: "/member endpoint", notes: "From depiction.imageUrl" },
      { name: "website_url", source: "/member/{id} detail", notes: "From officialWebsiteUrl" },
      { name: "phone", source: "/member/{id} detail", notes: "From addressInformation" },
      { name: "office_address", source: "/member/{id} detail", notes: "From addressInformation" },
    ],
  },
  {
    table: "member_scores",
    source: "Calculated from bill_sponsorships + member_votes",
    syncFunction: "calculate-member-scores",
    fields: [
      { name: "bills_sponsored", source: "COUNT from bill_sponsorships", notes: "Where is_sponsor = true" },
      { name: "bills_cosponsored", source: "COUNT from bill_sponsorships", notes: "Where is_sponsor = false" },
      { name: "bills_enacted", source: "COUNT from bill_sponsorships + bills", notes: "Where bills.enacted = true" },
      { name: "votes_cast", source: "COUNT from member_votes", notes: "All positions except not_voting" },
      { name: "votes_missed", source: "COUNT from member_votes", notes: "Where position = not_voting" },
      { name: "productivity_score", source: "Calculated", notes: "Based on bills sponsored/enacted" },
      { name: "attendance_score", source: "Calculated", notes: "votes_cast / total_votes * 100" },
      { name: "bipartisanship_score", source: "Calculated", notes: "Cross-party bill collaboration" },
      { name: "overall_score", source: "Calculated", notes: "Weighted average of sub-scores" },
    ],
  },
];

export default function AdminDataInspectorPage() {
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["admin-members-search", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select("id, full_name, bioguide_id, state, chamber, party")
        .eq("in_office", true)
        .order("full_name")
        .limit(20);

      if (searchTerm) {
        query = query.ilike("full_name", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: memberData, isLoading: memberDataLoading } = useQuery({
    queryKey: ["admin-member-data", selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return null;

      const [
        memberRes,
        scoresRes,
        sponsorshipsRes,
        votesRes,
        committeesRes,
        contributionsRes,
        sponsorsRes,
        lobbyingRes,
        fundingRes,
        statementsRes,
      ] = await Promise.all([
        supabase.from("members").select("*").eq("id", selectedMemberId).single(),
        supabase.from("member_scores").select("*").eq("member_id", selectedMemberId).is("user_id", null),
        supabase.from("bill_sponsorships").select("*, bills(title, bill_type, bill_number, policy_area)").eq("member_id", selectedMemberId).limit(50),
        supabase.from("member_votes").select("*, votes(question, vote_date, chamber)").eq("member_id", selectedMemberId).limit(50),
        supabase.from("member_committees").select("*").eq("member_id", selectedMemberId),
        supabase.from("member_contributions").select("*").eq("member_id", selectedMemberId),
        supabase.from("member_sponsors").select("*").eq("member_id", selectedMemberId),
        supabase.from("member_lobbying").select("*").eq("member_id", selectedMemberId),
        supabase.from("funding_metrics").select("*").eq("member_id", selectedMemberId),
        supabase.from("member_statements").select("*").eq("member_id", selectedMemberId),
      ]);

      return {
        member: memberRes.data,
        scores: scoresRes.data || [],
        sponsorships: sponsorshipsRes.data || [],
        votes: votesRes.data || [],
        committees: committeesRes.data || [],
        contributions: contributionsRes.data || [],
        sponsors: sponsorsRes.data || [],
        lobbying: lobbyingRes.data || [],
        funding: fundingRes.data || [],
        statements: statementsRes.data || [],
      };
    },
    enabled: !!selectedMemberId && isAdmin,
  });

  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8">
          <div className="text-center py-20">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">You need admin privileges to view this page.</p>
            <Button asChild className="mt-4">
              <Link to="/">Go Home</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const countIssues = (data: typeof memberData) => {
    if (!data) return [];
    const issues: string[] = [];
    
    const scores = data.scores[0];
    if (scores) {
      if (scores.bills_sponsored > 0 && data.sponsorships.filter((s: any) => s.is_sponsor).length === 0) {
        issues.push(`Score shows ${scores.bills_sponsored} bills sponsored but bill_sponsorships has 0 sponsor records`);
      }
      if (scores.bills_cosponsored > 0 && data.sponsorships.filter((s: any) => !s.is_sponsor).length === 0) {
        issues.push(`Score shows ${scores.bills_cosponsored} bills cosponsored but bill_sponsorships has 0 cosponsor records`);
      }
    }
    
    if (data.committees.length === 0) {
      issues.push("No committee assignments - run sync-member-details");
    }
    
    if (data.contributions.length > 0) {
      const genericContribs = data.contributions.filter((c: any) => 
        c.contributor_name === "Individual Contributors (Total)" ||
        c.contributor_name?.includes("(Total)")
      );
      if (genericContribs.length > 0) {
        issues.push(`${genericContribs.length} generic "Total" contributions instead of actual donor names`);
      }
      
      const duplicates = data.contributions.filter((c: any, i: number, arr: any[]) =>
        arr.findIndex((x: any) => x.contributor_name === c.contributor_name && x.amount === c.amount) !== i
      );
      if (duplicates.length > 0) {
        issues.push(`${duplicates.length} duplicate contribution records`);
      }
    }
    
    if (data.funding.length === 0 && data.contributions.length > 0) {
      issues.push("Has contributions but no funding_metrics - run sync-fec-funding");
    }
    
    if (data.statements.length === 0) {
      issues.push("No activity/statements - run sync-member-details");
    }
    
    return issues;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold">Data Inspector</h1>
            <p className="text-muted-foreground">Debug member data sources and identify sync issues</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin">Back to Admin</Link>
          </Button>
        </div>

        <Tabs defaultValue="inspector" className="space-y-6">
          <TabsList>
            <TabsTrigger value="inspector">
              <Search className="h-4 w-4 mr-2" />
              Member Inspector
            </TabsTrigger>
            <TabsTrigger value="sources">
              <Database className="h-4 w-4 mr-2" />
              Data Sources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspector" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Search Members</CardTitle>
                <CardDescription>Select a member to inspect their data across all tables</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {membersLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {members?.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          selectedMemberId === m.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{m.full_name}</span>
                            <span className="text-muted-foreground ml-2">({m.bioguide_id})</span>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{m.party}</Badge>
                            <Badge variant="secondary">{m.chamber}</Badge>
                            <Badge variant="outline">{m.state}</Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedMemberId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Member Data: {memberData?.member?.full_name}
                  </CardTitle>
                  {memberDataLoading ? (
                    <Skeleton className="h-4 w-48" />
                  ) : (
                    <CardDescription>
                      Bioguide: {memberData?.member?.bioguide_id} | 
                      FEC ID: {memberData?.member?.fec_candidate_id || "Not linked"}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {memberDataLoading ? (
                    <div className="space-y-4">
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : memberData ? (
                    <div className="space-y-6">
                      {/* Issues Alert */}
                      {countIssues(memberData).length > 0 && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                          <h4 className="font-semibold text-destructive flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            Data Issues Detected ({countIssues(memberData).length})
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                            {countIssues(memberData).map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Scores */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Vote className="h-4 w-4" />
                          member_scores ({memberData.scores.length} records)
                        </h4>
                        {memberData.scores[0] ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-muted-foreground">Overall:</span> {memberData.scores[0].overall_score}</div>
                            <div><span className="text-muted-foreground">Bills Sponsored:</span> {memberData.scores[0].bills_sponsored}</div>
                            <div><span className="text-muted-foreground">Bills Cosponsored:</span> {memberData.scores[0].bills_cosponsored}</div>
                            <div><span className="text-muted-foreground">Bills Enacted:</span> {memberData.scores[0].bills_enacted}</div>
                            <div><span className="text-muted-foreground">Votes Cast:</span> {memberData.scores[0].votes_cast}</div>
                            <div><span className="text-muted-foreground">Votes Missed:</span> {memberData.scores[0].votes_missed}</div>
                            <div><span className="text-muted-foreground">Productivity:</span> {memberData.scores[0].productivity_score}</div>
                            <div><span className="text-muted-foreground">Attendance:</span> {memberData.scores[0].attendance_score}</div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No scores calculated</p>
                        )}
                      </div>

                      {/* Sponsorships */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4" />
                          bill_sponsorships ({memberData.sponsorships.length} records)
                        </h4>
                        <div className="text-sm mb-2">
                          <span className="text-muted-foreground">Sponsors:</span> {memberData.sponsorships.filter((s: any) => s.is_sponsor).length} | 
                          <span className="text-muted-foreground ml-2">Cosponsors:</span> {memberData.sponsorships.filter((s: any) => !s.is_sponsor).length}
                        </div>
                        {memberData.sponsorships.length > 0 ? (
                          <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                            {memberData.sponsorships.slice(0, 10).map((s: any) => (
                              <div key={s.id} className="flex justify-between">
                                <span className="truncate flex-1">{s.bills?.title || "Unknown bill"}</span>
                                <Badge variant={s.is_sponsor ? "default" : "secondary"} className="ml-2">
                                  {s.is_sponsor ? "Sponsor" : "Cosponsor"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No sponsorship records</p>
                        )}
                      </div>

                      {/* Votes */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Vote className="h-4 w-4" />
                          member_votes ({memberData.votes.length} records)
                        </h4>
                        {memberData.votes.length > 0 ? (
                          <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                            {memberData.votes.slice(0, 10).map((v: any) => (
                              <div key={v.id} className="flex justify-between">
                                <span className="truncate flex-1">{v.votes?.question || "Unknown vote"}</span>
                                <Badge variant="outline">{v.position}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No vote records</p>
                        )}
                      </div>

                      {/* Committees */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Building className="h-4 w-4" />
                          member_committees ({memberData.committees.length} records)
                        </h4>
                        {memberData.committees.length > 0 ? (
                          <div className="space-y-1 text-sm">
                            {memberData.committees.map((c: any) => (
                              <div key={c.id}>{c.committee_name}</div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No committee records - sync-member-details needed</p>
                        )}
                      </div>

                      {/* Contributions */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <DollarSign className="h-4 w-4" />
                          member_contributions ({memberData.contributions.length} records)
                        </h4>
                        {memberData.contributions.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto text-xs space-y-1">
                            {memberData.contributions.map((c: any) => (
                              <div key={c.id} className="flex justify-between items-center border-b pb-1">
                                <div className="flex-1">
                                  <span className="font-medium">{c.contributor_name}</span>
                                  <span className="text-muted-foreground ml-2">({c.contributor_type})</span>
                                  {c.contributor_state && <span className="text-muted-foreground ml-1">[{c.contributor_state}]</span>}
                                </div>
                                <span className="font-mono">${c.amount?.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No contribution records</p>
                        )}
                      </div>

                      {/* Sponsors */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Users className="h-4 w-4" />
                          member_sponsors ({memberData.sponsors.length} records)
                        </h4>
                        {memberData.sponsors.length > 0 ? (
                          <div className="space-y-1 text-sm">
                            {memberData.sponsors.map((s: any) => (
                              <div key={s.id} className="flex justify-between">
                                <span>{s.sponsor_name} ({s.sponsor_type})</span>
                                <span className="font-mono">${s.total_support?.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No sponsor records</p>
                        )}
                      </div>

                      {/* Funding Metrics */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <DollarSign className="h-4 w-4" />
                          funding_metrics ({memberData.funding.length} records)
                        </h4>
                        {memberData.funding[0] ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-muted-foreground">Total Receipts:</span> ${memberData.funding[0].total_receipts?.toLocaleString()}</div>
                            <div><span className="text-muted-foreground">Grassroots:</span> {memberData.funding[0].grassroots_support_score}</div>
                            <div><span className="text-muted-foreground">PAC Dependence:</span> {memberData.funding[0].pac_dependence_score}</div>
                            <div><span className="text-muted-foreground">Local Money:</span> {memberData.funding[0].local_money_score}</div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No funding metrics - sync-fec-funding needed</p>
                        )}
                      </div>

                      {/* Statements/Activity */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Activity className="h-4 w-4" />
                          member_statements ({memberData.statements.length} records)
                        </h4>
                        {memberData.statements.length > 0 ? (
                          <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                            {memberData.statements.map((s: any) => (
                              <div key={s.id}>{s.title}</div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No activity records - sync-member-details needed</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sources" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Member Page Data Sources</CardTitle>
                <CardDescription>
                  Maps each UI section on the Member Detail page to its database tables and sync functions
                </CardDescription>
              </CardHeader>
            </Card>

            {uiSectionMappings.map((section, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{section.section}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                    {section.component && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {section.component}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {section.tables.map((table) => (
                      <Badge key={table} variant="secondary" className="font-mono text-xs">
                        <Database className="h-3 w-3 mr-1" />
                        {table}
                      </Badge>
                    ))}
                    {section.syncFunctions.map((fn) => (
                      <Badge key={fn} variant="outline" className="font-mono text-xs bg-primary/5">
                        ⚡ {fn}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left py-2 px-3 font-medium">UI Element</th>
                          <th className="text-left py-2 px-3 font-medium">DB Field</th>
                          <th className="text-left py-2 px-3 font-medium">Table</th>
                          <th className="text-left py-2 px-3 font-medium">Data Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.fields.map((f, fIdx) => (
                          <tr key={fIdx} className="border-b hover:bg-muted/30">
                            <td className="py-2 px-3 font-medium">{f.uiField}</td>
                            <td className="py-2 px-3 font-mono text-xs text-primary">{f.dbField}</td>
                            <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{f.table}</td>
                            <td className="py-2 px-3 text-xs text-muted-foreground max-w-md">{f.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Raw Table Reference
                </CardTitle>
                <CardDescription>Quick reference for database tables and their sync functions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {dataSources.map((ds) => (
                    <div key={ds.table} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-medium">{ds.table}</span>
                        <Badge variant="outline" className="text-xs">
                          {ds.syncFunction}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{ds.source}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}
