import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Database, Users, FileText, Vote, DollarSign, Building, Activity, AlertTriangle, GitBranch, ExternalLink, Clock, Layers, ArrowRight, CheckCircle2, XCircle, Info, Code, Table, Zap, RefreshCw, Globe, Server, Eye, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
      { uiField: "First Name", dbField: "first_name", table: "members", source: "Congress.gov /member → firstName" },
      { uiField: "Last Name", dbField: "last_name", table: "members", source: "Congress.gov /member → lastName" },
      { uiField: "Party Badge", dbField: "party", table: "members", source: "Congress.gov /member → partyName (D/R/I)" },
      { uiField: "Chamber Badge", dbField: "chamber", table: "members", source: "Inferred: has district = house, else senate" },
      { uiField: "State", dbField: "state", table: "members", source: "Congress.gov /member → state" },
      { uiField: "District", dbField: "district", table: "members", source: "Congress.gov /member → district (House only)" },
      { uiField: "Bioguide ID", dbField: "bioguide_id", table: "members", source: "Congress.gov /member → bioguideId" },
    ],
  },
  {
    section: "Contact Information",
    description: "Office address, phone, website, social media",
    component: "MemberPage (inline)",
    tables: ["members"],
    syncFunctions: ["sync-member-details"],
    fields: [
      { uiField: "Office Address", dbField: "office_address", table: "members", source: "Congress.gov /member/{id} → addressInformation.officeAddress" },
      { uiField: "City", dbField: "office_city", table: "members", source: "Congress.gov /member/{id} → addressInformation.city" },
      { uiField: "State", dbField: "office_state", table: "members", source: "Congress.gov /member/{id} → addressInformation.officeState" },
      { uiField: "ZIP", dbField: "office_zip", table: "members", source: "Congress.gov /member/{id} → addressInformation.zipCode" },
      { uiField: "Phone", dbField: "phone", table: "members", source: "Congress.gov /member/{id} → addressInformation.phoneNumber" },
      { uiField: "Website", dbField: "website_url", table: "members", source: "Congress.gov /member/{id} → officialWebsiteUrl" },
      { uiField: "Twitter", dbField: "twitter_handle", table: "members", source: "Congress.gov /member/{id} → twitterId (fallback to Twitter API)" },
    ],
  },
  {
    section: "Score Card",
    description: "Overall score ring and breakdown scores",
    component: "ScoreRing, ScoreBreakdown",
    tables: ["member_scores"],
    syncFunctions: ["calculate-member-scores"],
    fields: [
      { uiField: "Overall Score", dbField: "overall_score", table: "member_scores", source: "Calculated: weighted avg of sub-scores" },
      { uiField: "Productivity Score", dbField: "productivity_score", table: "member_scores", source: "Calculated: bills_sponsored + bills_cosponsored + bills_enacted" },
      { uiField: "Attendance Score", dbField: "attendance_score", table: "member_scores", source: "Calculated: votes_cast / (votes_cast + votes_missed)" },
      { uiField: "Bipartisanship Score", dbField: "bipartisanship_score", table: "member_scores", source: "Calculated: bipartisan_bills / total_bills" },
      { uiField: "Issue Alignment", dbField: "issue_alignment_score", table: "member_scores", source: "Calculated: from politician_issue_positions" },
      { uiField: "Bills Sponsored", dbField: "bills_sponsored", table: "member_scores", source: "Count from bill_sponsorships where is_sponsor=true" },
      { uiField: "Bills Cosponsored", dbField: "bills_cosponsored", table: "member_scores", source: "Count from bill_sponsorships where is_sponsor=false" },
      { uiField: "Bills Enacted", dbField: "bills_enacted", table: "member_scores", source: "Count from bills where enacted=true" },
      { uiField: "Votes Cast", dbField: "votes_cast", table: "member_scores", source: "Count from member_votes (yea/nay/present)" },
      { uiField: "Votes Missed", dbField: "votes_missed", table: "member_scores", source: "Count from member_votes where position=not_voting" },
    ],
  },
  {
    section: "Committees",
    description: "Committee assignments with roles (chair, ranking member)",
    component: "MemberCommittees",
    tables: ["member_committees"],
    syncFunctions: ["sync-member-details"],
    fields: [
      { uiField: "Committee Name", dbField: "committee_name", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].name" },
      { uiField: "Committee Code", dbField: "committee_code", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].systemCode" },
      { uiField: "Chamber", dbField: "chamber", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].chamber" },
      { uiField: "Is Chair", dbField: "is_chair", table: "member_committees", source: "Congress.gov → title contains 'Chair'" },
      { uiField: "Is Ranking Member", dbField: "is_ranking_member", table: "member_committees", source: "Congress.gov → title contains 'Ranking'" },
      { uiField: "Rank", dbField: "rank", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].rank" },
      { uiField: "Congress", dbField: "congress", table: "member_committees", source: "Current congress (119)" },
    ],
  },
  {
    section: "Voting Record",
    description: "Recent votes with positions and bill context",
    component: "MemberVotingComparison, VoteDetailDialog",
    tables: ["member_votes", "votes", "bills"],
    syncFunctions: ["sync-votes"],
    fields: [
      { uiField: "Vote Position", dbField: "position", table: "member_votes", source: "House Clerk XML → recorded-vote/legislator[@vote]" },
      { uiField: "Vote Date", dbField: "vote_date", table: "votes", source: "Congress.gov /vote → date" },
      { uiField: "Vote Question", dbField: "question", table: "votes", source: "Congress.gov /vote → question" },
      { uiField: "Vote Result", dbField: "result", table: "votes", source: "Congress.gov /vote → result" },
      { uiField: "Yea Count", dbField: "total_yea", table: "votes", source: "House Clerk XML → vote-totals/yea" },
      { uiField: "Nay Count", dbField: "total_nay", table: "votes", source: "House Clerk XML → vote-totals/nay" },
      { uiField: "Related Bill", dbField: "bill_id", table: "votes", source: "Congress.gov /vote → bill.number + bill.type" },
    ],
  },
  {
    section: "Funding Profile",
    description: "Campaign finance metrics and funding source charts",
    component: "FundingProfile",
    tables: ["funding_metrics"],
    syncFunctions: ["sync-fec-funding"],
    fields: [
      { uiField: "Total Receipts", dbField: "total_receipts", table: "funding_metrics", source: "FEC API /candidate/{id}/totals → receipts" },
      { uiField: "Individual %", dbField: "pct_from_individuals", table: "funding_metrics", source: "Calculated: individual_contributions / total" },
      { uiField: "Committee %", dbField: "pct_from_committees", table: "funding_metrics", source: "Calculated: other_political_committee_contributions / total" },
      { uiField: "Small Donor %", dbField: "pct_from_small_donors", table: "funding_metrics", source: "Calculated: individual_itemized_contributions under $200 / total" },
      { uiField: "In-State %", dbField: "pct_from_in_state", table: "funding_metrics", source: "Calculated: contributions from member's state / total" },
      { uiField: "Out-of-State %", dbField: "pct_from_out_of_state", table: "funding_metrics", source: "Calculated: 100 - pct_from_in_state" },
      { uiField: "Grassroots Score", dbField: "grassroots_support_score", table: "funding_metrics", source: "Calculated: weighted(small_donor%, individual%)" },
      { uiField: "PAC Dependence", dbField: "pac_dependence_score", table: "funding_metrics", source: "Calculated: 100 - (committee% * 100)" },
      { uiField: "Local Money Score", dbField: "local_money_score", table: "funding_metrics", source: "Calculated: in_state%" },
      { uiField: "Cycle", dbField: "cycle", table: "funding_metrics", source: "FEC election cycle (2024, 2022, etc.)" },
    ],
  },
  {
    section: "Financial Relationships",
    description: "Contributors, lobbying, and sponsors tabs",
    component: "MemberFinanceSection (ContributorsList, LobbyingList, SponsorsList)",
    tables: ["member_contributions", "member_lobbying", "member_sponsors"],
    syncFunctions: ["sync-fec-finance"],
    fields: [
      { uiField: "Contributor Name", dbField: "contributor_name", table: "member_contributions", source: "FEC API /schedules/schedule_a → contributor_name" },
      { uiField: "Contribution Amount", dbField: "amount", table: "member_contributions", source: "FEC API /schedules/schedule_a → contribution_receipt_amount" },
      { uiField: "Contributor Type", dbField: "contributor_type", table: "member_contributions", source: "FEC API → entity_type (IND/COM/etc)" },
      { uiField: "Contributor State", dbField: "contributor_state", table: "member_contributions", source: "FEC API /schedules/schedule_a → contributor_state" },
      { uiField: "Industry", dbField: "industry", table: "member_contributions", source: "FEC API → contributor_occupation mapped to industry" },
      { uiField: "Lobby Industry", dbField: "industry", table: "member_lobbying", source: "OpenSecrets/LDA → client_name + industry" },
      { uiField: "Lobby Amount", dbField: "total_spent", table: "member_lobbying", source: "OpenSecrets/LDA → amount" },
      { uiField: "Sponsor Name", dbField: "sponsor_name", table: "member_sponsors", source: "FEC API → committee_name" },
      { uiField: "Sponsor Type", dbField: "sponsor_type", table: "member_sponsors", source: "FEC API → committee_type" },
      { uiField: "Support Amount", dbField: "total_support", table: "member_sponsors", source: "FEC API → total disbursements" },
    ],
  },
  {
    section: "AI Summary",
    description: "AI-generated member activity summary",
    component: "MemberAISummary",
    tables: ["member_summaries"],
    syncFunctions: ["generate-member-summary"],
    fields: [
      { uiField: "Summary Text", dbField: "summary", table: "member_summaries", source: "Lovable AI (gemini-2.5-flash) generation" },
      { uiField: "Generated At", dbField: "generated_at", table: "member_summaries", source: "Timestamp of last generation" },
    ],
  },
  {
    section: "Alignment Widget",
    description: "User-politician alignment score",
    component: "AlignmentWidget",
    tables: ["user_politician_alignment", "politician_issue_positions"],
    syncFunctions: ["compute-politician-positions"],
    fields: [
      { uiField: "Overall Alignment", dbField: "overall_alignment", table: "user_politician_alignment", source: "Calculated: weighted avg across issues" },
      { uiField: "Issue Breakdown", dbField: "breakdown", table: "user_politician_alignment", source: "JSON: per-issue alignment scores" },
      { uiField: "Politician Position", dbField: "score_value", table: "politician_issue_positions", source: "Calculated: from issue_signals weighted by direction" },
    ],
  },
  {
    section: "Policy Areas",
    description: "Member's legislative focus areas",
    component: "MemberPolicyAreas",
    tables: ["bills", "bill_sponsorships"],
    syncFunctions: ["sync-bills"],
    fields: [
      { uiField: "Policy Area", dbField: "policy_area", table: "bills", source: "Congress.gov /bill → policyArea.name" },
      { uiField: "Bill Count", dbField: "count", table: "aggregated", source: "Count of bills per policy_area" },
    ],
  },
];

const dataSources = [
  {
    table: "members",
    source: "Congress.gov API",
    syncFunction: "sync-congress-members",
    apiEndpoint: "https://api.congress.gov/v3/member",
    frequency: "Daily at midnight UTC",
    keyFields: ["bioguide_id", "full_name", "party", "chamber", "state", "district"],
    notes: "Syncs all 539 current members (100 senators + 439 representatives)",
  },
  {
    table: "member_committees",
    source: "Congress.gov API",
    syncFunction: "sync-member-details",
    apiEndpoint: "https://api.congress.gov/v3/member/{bioguideId}",
    frequency: "Daily at 1 AM UTC",
    keyFields: ["committee_name", "committee_code", "is_chair", "is_ranking_member"],
    notes: "Committee assignments from individual member detail endpoints",
  },
  {
    table: "bills",
    source: "Congress.gov API",
    syncFunction: "sync-bills",
    apiEndpoint: "https://api.congress.gov/v3/bill/{congress}/{type}",
    frequency: "Every 6 hours",
    keyFields: ["bill_type", "bill_number", "congress", "title", "policy_area", "enacted"],
    notes: "Syncs HR and S bill types with sponsorship data",
  },
  {
    table: "bill_sponsorships",
    source: "Congress.gov API",
    syncFunction: "sync-bills",
    apiEndpoint: "https://api.congress.gov/v3/bill/{congress}/{type}/{number}/cosponsors",
    frequency: "Every 6 hours",
    keyFields: ["bill_id", "member_id", "is_sponsor", "is_original_cosponsor"],
    notes: "Links members to bills they sponsor or cosponsor",
  },
  {
    table: "votes",
    source: "Congress.gov API + House/Senate XML",
    syncFunction: "sync-votes",
    apiEndpoint: "https://api.congress.gov/v3/vote/{congress}/{chamber}",
    frequency: "Every 2 hours",
    keyFields: ["roll_number", "vote_date", "chamber", "result", "total_yea", "total_nay"],
    notes: "Vote metadata from Congress.gov, individual positions from Clerk XML",
  },
  {
    table: "member_votes",
    source: "House Clerk XML / Senate.gov XML",
    syncFunction: "sync-votes",
    apiEndpoint: "https://clerk.house.gov/evs/{year}/roll{number}.xml",
    frequency: "Every 2 hours",
    keyFields: ["member_id", "vote_id", "position"],
    notes: "Individual member vote positions parsed from roll call XML",
  },
  {
    table: "member_scores",
    source: "Calculated from bill_sponsorships + member_votes",
    syncFunction: "calculate-member-scores",
    apiEndpoint: "N/A (internal calculation)",
    frequency: "Every 2 hours at :30",
    keyFields: ["overall_score", "productivity_score", "attendance_score", "bipartisanship_score"],
    notes: "Aggregated scores with recency weighting",
  },
  {
    table: "state_scores",
    source: "Calculated from member_scores + funding_metrics",
    syncFunction: "recalculate-state-scores",
    apiEndpoint: "N/A (internal calculation)",
    frequency: "Every 2 hours at :45",
    keyFields: ["avg_member_score", "member_count", "avg_pac_dependence"],
    notes: "Pre-computed state aggregates for map visualization",
  },
  {
    table: "member_contributions",
    source: "FEC API",
    syncFunction: "sync-fec-finance",
    apiEndpoint: "https://api.open.fec.gov/v1/schedules/schedule_a/",
    frequency: "Nightly at 2 AM + 5 min batches",
    keyFields: ["contributor_name", "amount", "contributor_type", "contributor_state"],
    notes: "Itemized individual contributions (>$200)",
  },
  {
    table: "funding_metrics",
    source: "FEC API (calculated)",
    syncFunction: "sync-fec-funding",
    apiEndpoint: "https://api.open.fec.gov/v1/candidate/{id}/totals/",
    frequency: "Nightly at 2 AM",
    keyFields: ["total_receipts", "pct_from_individuals", "grassroots_support_score"],
    notes: "Computed funding dependency metrics",
  },
  {
    table: "member_lobbying",
    source: "FEC API (placeholder)",
    syncFunction: "sync-fec-finance",
    apiEndpoint: "TBD - OpenSecrets/LDA",
    frequency: "Nightly at 2 AM",
    keyFields: ["industry", "total_spent", "client_count"],
    notes: "Lobbying data - planned integration",
  },
  {
    table: "member_sponsors",
    source: "FEC API",
    syncFunction: "sync-fec-finance",
    apiEndpoint: "https://api.open.fec.gov/v1/committee/{id}/",
    frequency: "Nightly at 2 AM",
    keyFields: ["sponsor_name", "sponsor_type", "total_support"],
    notes: "PAC and committee support data",
  },
  {
    table: "issue_signals",
    source: "AI Classification",
    syncFunction: "classify-issue-signals",
    apiEndpoint: "Lovable AI (gemini-2.5-flash)",
    frequency: "Every 6 hours at :15",
    keyFields: ["issue_id", "external_ref", "direction", "weight"],
    notes: "AI-classified bill/vote to issue mappings",
  },
  {
    table: "politician_issue_positions",
    source: "Calculated from issue_signals",
    syncFunction: "compute-politician-positions",
    apiEndpoint: "N/A (internal calculation)",
    frequency: "Every 6 hours at :30",
    keyFields: ["politician_id", "issue_id", "score_value"],
    notes: "Aggregated politician stance on each issue",
  },
  {
    table: "member_summaries",
    source: "AI Generation",
    syncFunction: "generate-member-summary",
    apiEndpoint: "Lovable AI (gemini-2.5-flash)",
    frequency: "On-demand (rate limited monthly)",
    keyFields: ["summary", "generated_at"],
    notes: "AI-generated member activity summaries",
  },
];

const cronSchedule = [
  { job: "sync-congress-members", schedule: "Daily at midnight UTC", cron: "0 0 * * *", description: "Syncs all 539 current members from Congress.gov" },
  { job: "sync-member-details", schedule: "Daily at 1 AM UTC", cron: "0 1 * * *", description: "Fetches detailed info (committees, contact) for each member" },
  { job: "sync-bills", schedule: "Every 6 hours", cron: "0 */6 * * *", description: "Syncs HR and S bills with sponsorships" },
  { job: "sync-votes", schedule: "Every 2 hours", cron: "0 */2 * * *", description: "Syncs vote metadata and individual positions" },
  { job: "calculate-member-scores", schedule: "Every 2 hours at :30", cron: "30 */2 * * *", description: "Recalculates all member scores" },
  { job: "recalculate-state-scores", schedule: "Every 2 hours at :45", cron: "45 */2 * * *", description: "Updates state-level aggregates" },
  { job: "sync-fec-finance", schedule: "Every 5 min batches", cron: "*/5 * * * *", description: "Processes 20 members per batch for FEC data" },
  { job: "sync-fec-funding", schedule: "Daily at 2 AM UTC", cron: "0 2 * * *", description: "Calculates funding metrics from contribution data" },
  { job: "classify-issue-signals", schedule: "Every 6 hours at :15", cron: "15 */6 * * *", description: "AI classifies new bills/votes to issues" },
  { job: "compute-politician-positions", schedule: "Every 6 hours at :30", cron: "30 */6 * * *", description: "Aggregates signals into politician positions" },
  { job: "send-member-notifications", schedule: "Daily at 8 AM UTC", cron: "0 8 * * *", description: "Sends email notifications for tracked members" },
  { job: "send-weekly-digest", schedule: "Weekly on Monday at 8 AM UTC", cron: "0 8 * * 1", description: "Sends weekly digest emails" },
];

// Map sync_progress IDs to edge function names
const syncProgressMapping: Record<string, string> = {
  'congress-members': 'sync-congress-members',
  'member-details': 'sync-member-details',
  'bills': 'sync-bills',
  'votes': 'sync-votes',
  'fec-finance': 'sync-fec-finance',
  'fec-funding': 'sync-fec-funding',
  'member-scores': 'calculate-member-scores',
  'state-scores': 'recalculate-state-scores',
};

export function DataInspectorContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Live sync status query with auto-refetch
  const { data: syncProgress } = useQuery({
    queryKey: ["admin-sync-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_progress")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000, // Refetch every 5 seconds for live updates
  });

  // Helper to get sync status for a function
  const getSyncStatus = (functionName: string) => {
    if (!syncProgress) return null;
    const mappedId = Object.entries(syncProgressMapping).find(([_, fn]) => fn === functionName)?.[0];
    if (!mappedId) return null;
    return syncProgress.find((sp: any) => sp.id === mappedId);
  };

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
        fundingRes,
      ] = await Promise.all([
        supabase.from("members").select("*").eq("id", selectedMemberId).single(),
        supabase.from("member_scores").select("*").eq("member_id", selectedMemberId).is("user_id", null),
        supabase.from("bill_sponsorships").select("id").eq("member_id", selectedMemberId),
        supabase.from("member_votes").select("id").eq("member_id", selectedMemberId),
        supabase.from("member_committees").select("*").eq("member_id", selectedMemberId),
        supabase.from("member_contributions").select("*").eq("member_id", selectedMemberId),
        supabase.from("funding_metrics").select("*").eq("member_id", selectedMemberId),
      ]);

      return {
        member: memberRes.data,
        scores: scoresRes.data || [],
        sponsorships: sponsorshipsRes.data || [],
        votes: votesRes.data || [],
        committees: committeesRes.data || [],
        contributions: contributionsRes.data || [],
        funding: fundingRes.data || [],
      };
    },
    enabled: !!selectedMemberId,
  });

  const countIssues = (data: typeof memberData) => {
    if (!data) return [];
    const issues: string[] = [];
    
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
    }
    
    if (data.funding.length === 0 && data.contributions.length > 0) {
      issues.push("Has contributions but no funding_metrics - run sync-fec-funding");
    }
    
    return issues;
  };

  return (
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
        <TabsTrigger value="flow">
          <GitBranch className="h-4 w-4 mr-2" />
          Data Flow
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

                  {/* Data Summary Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Bill Sponsorships
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.sponsorships.length}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">Source: sync-bills → bill_sponsorships</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Vote className="h-4 w-4" />
                          Vote Records
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.votes.length}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">Source: sync-votes → member_votes</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-amber-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Committee Assignments
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.committees.length}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">Source: sync-member-details → member_committees</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Contribution Records
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.contributions.length}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">Source: sync-fec-finance → member_contributions</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-pink-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Funding Metrics
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.funding.length}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">Source: sync-fec-funding → funding_metrics</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-cyan-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Score Records
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.scores.length}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground">Source: calculate-member-scores → member_scores</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Raw Data Inspection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Raw Member Data
                      </CardTitle>
                      <CardDescription>Database record from members table</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48 w-full rounded border p-3 bg-muted/30">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(memberData.member, null, 2)}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Scores Breakdown */}
                  {memberData.scores.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Score Breakdown
                        </CardTitle>
                        <CardDescription>Values from member_scores table</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {memberData.scores.map((score: any, idx: number) => (
                            <div key={idx} className="space-y-3">
                              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                                <span className="text-xs text-muted-foreground">Overall</span>
                                <span className="font-bold">{score.overall_score?.toFixed(1) ?? 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                                <span className="text-xs text-muted-foreground">Productivity</span>
                                <span className="font-medium">{score.productivity_score?.toFixed(1) ?? 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                                <span className="text-xs text-muted-foreground">Attendance</span>
                                <span className="font-medium">{score.attendance_score?.toFixed(1) ?? 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                                <span className="text-xs text-muted-foreground">Bipartisan</span>
                                <span className="font-medium">{score.bipartisanship_score?.toFixed(1) ?? 'N/A'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 p-3 rounded bg-muted/30 border">
                          <p className="text-xs text-muted-foreground mb-2">Raw score data:</p>
                          <ScrollArea className="h-32">
                            <pre className="text-xs font-mono">
                              {JSON.stringify(memberData.scores, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Committees Detail */}
                  {memberData.committees.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Committee Assignments Detail
                        </CardTitle>
                        <CardDescription>Records from member_committees table</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {memberData.committees.map((comm: any) => (
                            <div key={comm.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                              <div>
                                <p className="font-medium text-sm">{comm.committee_name}</p>
                                <p className="text-xs text-muted-foreground">Code: {comm.committee_code} | Chamber: {comm.chamber}</p>
                              </div>
                              <div className="flex gap-1">
                                {comm.is_chair && <Badge className="bg-amber-500/20 text-amber-600 text-xs">Chair</Badge>}
                                {comm.is_ranking_member && <Badge className="bg-blue-500/20 text-blue-600 text-xs">Ranking</Badge>}
                                {comm.rank && <Badge variant="outline" className="text-xs">Rank #{comm.rank}</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Contributions Sample */}
                  {memberData.contributions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Contribution Records Sample
                        </CardTitle>
                        <CardDescription>First 10 records from member_contributions table</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Contributor</th>
                                <th className="px-3 py-2 text-left font-medium">Type</th>
                                <th className="px-3 py-2 text-left font-medium">State</th>
                                <th className="px-3 py-2 text-right font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {memberData.contributions.slice(0, 10).map((contrib: any) => (
                                <tr key={contrib.id} className="border-t">
                                  <td className="px-3 py-2 max-w-48 truncate">{contrib.contributor_name}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="text-xs">{contrib.contributor_type}</Badge>
                                  </td>
                                  <td className="px-3 py-2">{contrib.contributor_state || '-'}</td>
                                  <td className="px-3 py-2 text-right font-mono">${contrib.amount?.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {memberData.contributions.length > 10 && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Showing 10 of {memberData.contributions.length} records
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Funding Metrics Detail */}
                  {memberData.funding.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Funding Metrics Detail
                        </CardTitle>
                        <CardDescription>Records from funding_metrics table</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {memberData.funding.map((fm: any) => (
                            <div key={fm.id} className="space-y-2 p-3 rounded-lg border bg-card">
                              <Badge variant="outline" className="text-xs">Cycle {fm.cycle}</Badge>
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Total Receipts</span>
                                  <span className="font-mono">${(fm.total_receipts || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Individual %</span>
                                  <span>{fm.pct_from_individuals?.toFixed(1) ?? 'N/A'}%</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">In-State %</span>
                                  <span>{fm.pct_from_in_state?.toFixed(1) ?? 'N/A'}%</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Grassroots Score</span>
                                  <span>{fm.grassroots_support_score?.toFixed(1) ?? 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">PAC Dependence</span>
                                  <span>{fm.pac_dependence_score?.toFixed(1) ?? 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Links */}
                  <div className="flex gap-3 pt-2">
                    <Link
                      to={`/member/${selectedMemberId}`}
                      className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                      target="_blank"
                    >
                      <Eye className="h-4 w-4" />
                      View Member Page
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="sources" className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">3</p>
                  <p className="text-xs text-muted-foreground">External APIs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Zap className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">12</p>
                  <p className="text-xs text-muted-foreground">Edge Functions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Table className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dataSources.length}</p>
                  <p className="text-xs text-muted-foreground">Database Tables</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">2</p>
                  <p className="text-xs text-muted-foreground">AI Integrations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Data Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Tables & Data Sources
            </CardTitle>
            <CardDescription>Complete mapping of all data tables, their sources, and sync configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {dataSources.map((ds, index) => (
                <AccordionItem key={ds.table} value={`ds-${index}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        <code className="font-mono font-bold text-sm">{ds.table}</code>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground hidden group-data-[state=open]:rotate-90 transition-transform" />
                      <div className="flex gap-2 ml-auto mr-4">
                        <Badge variant="outline" className="text-xs">{ds.syncFunction}</Badge>
                        <Badge variant="secondary" className="text-xs">{ds.frequency}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2 pl-6 border-l-2 border-primary/20 ml-2">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Data Source</p>
                          <p className="text-sm font-medium">{ds.source}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Sync Frequency</p>
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {ds.frequency}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">API Endpoint</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">{ds.apiEndpoint}</code>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Key Fields</p>
                        <div className="flex flex-wrap gap-1">
                          {ds.keyFields.map((field) => (
                            <Badge key={field} variant="outline" className="text-xs font-mono">{field}</Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
                        <p className="text-sm text-muted-foreground">{ds.notes}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* API Sources Quick Reference */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                Congress.gov API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <p className="font-medium">Endpoints Used:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>• /v3/member - All members list</li>
                  <li>• /v3/member/{'{id}'} - Member details</li>
                  <li>• /v3/bill/{'{congress}'}/{'{type}'} - Bills</li>
                  <li>• /v3/vote/{'{congress}'}/{'{chamber}'} - Votes</li>
                </ul>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Auth: </span>
                <code className="bg-muted px-1 rounded">CONGRESS_API_KEY</code>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                FEC API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <p className="font-medium">Endpoints Used:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>• /v1/candidates/search - Find candidates</li>
                  <li>• /v1/candidate/{'{id}'}/totals - Finance totals</li>
                  <li>• /v1/schedules/schedule_a - Contributions</li>
                  <li>• /v1/committee/{'{id}'} - Committee info</li>
                </ul>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Auth: </span>
                <code className="bg-muted px-1 rounded">FEC_API_KEY</code>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                Roll Call XML
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <p className="font-medium">Sources:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>• clerk.house.gov - House roll calls</li>
                  <li>• senate.gov - Senate roll calls</li>
                </ul>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Format: </span>
                <code className="bg-muted px-1 rounded">XML (parsed)</code>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Auth: </span>
                <span>None required</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="flow" className="space-y-6">
        {/* Visual Data Pipeline */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Data Pipeline Architecture
            </CardTitle>
            <CardDescription>Complete visualization of how data flows through CivicScore from external sources to UI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Main Pipeline Flow - 4 columns */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Stage 1: External APIs */}
                <div className="space-y-3">
                  <div className="text-center">
                    <Badge className="mb-3 bg-blue-500/20 text-blue-600 border-blue-500/30 px-4 py-1">
                      <Globe className="h-3 w-3 mr-1 inline" />
                      1. External APIs
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors">
                      <div className="font-semibold text-blue-600 text-sm flex items-center gap-2">
                        <Building className="h-3 w-3" />
                        Congress.gov API
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Members, Bills, Votes, Committees</div>
                      <div className="text-xs text-blue-500 mt-1">api.congress.gov/v3</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors">
                      <div className="font-semibold text-blue-600 text-sm flex items-center gap-2">
                        <DollarSign className="h-3 w-3" />
                        FEC API
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Campaign Finance, Contributions</div>
                      <div className="text-xs text-blue-500 mt-1">api.open.fec.gov/v1</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors">
                      <div className="font-semibold text-blue-600 text-sm flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        House Clerk XML
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Individual Vote Positions</div>
                      <div className="text-xs text-blue-500 mt-1">clerk.house.gov/evs</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors">
                      <div className="font-semibold text-blue-600 text-sm flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        Senate.gov XML
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Senate Vote Roll Calls</div>
                      <div className="text-xs text-blue-500 mt-1">senate.gov/legislative</div>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors">
                      <div className="font-semibold text-purple-600 text-sm flex items-center gap-2">
                        <Sparkles className="h-3 w-3" />
                        Lovable AI
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Classification & Summaries</div>
                      <div className="text-xs text-purple-500 mt-1">gemini-2.5-flash</div>
                    </div>
                  </div>
                </div>

                {/* Stage 2: Edge Functions with Live Status */}
                <div className="space-y-3">
                  <div className="text-center">
                    <Badge className="mb-3 bg-green-500/20 text-green-600 border-green-500/30 px-4 py-1">
                      <Zap className="h-3 w-3 mr-1 inline" />
                      2. Edge Functions
                    </Badge>
                    {syncProgress?.some((sp: any) => sp.status === 'running') && (
                      <div className="text-xs text-green-500 animate-pulse mt-1">● Live syncing</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'sync-congress-members', schedule: 'Daily @ midnight', type: 'sync' as const },
                      { name: 'sync-member-details', schedule: 'Daily @ 1 AM', type: 'sync' as const },
                      { name: 'sync-bills', schedule: 'Every 6 hours', type: 'sync' as const },
                      { name: 'sync-votes', schedule: 'Every 2 hours', type: 'sync' as const },
                      { name: 'sync-fec-finance', schedule: '5 min batches', type: 'sync' as const },
                      { name: 'sync-fec-funding', schedule: 'Daily @ 2 AM', type: 'sync' as const },
                      { name: 'calculate-member-scores', schedule: 'Every 2h @ :30', type: 'compute' as const },
                      { name: 'recalculate-state-scores', schedule: 'Every 2h @ :45', type: 'compute' as const },
                      { name: 'classify-issue-signals', schedule: 'Every 6h @ :15', type: 'ai' as const },
                    ].map((func) => {
                      const status = getSyncStatus(func.name);
                      const isRunning = status?.status === 'running';
                      const isComplete = status?.status === 'complete';
                      
                      const baseClasses = func.type === 'compute' 
                        ? 'bg-amber-500/10 border-amber-500/30' 
                        : func.type === 'ai' 
                          ? 'bg-purple-500/10 border-purple-500/30' 
                          : 'bg-green-500/10 border-green-500/30';
                      
                      const runningClasses = func.type === 'compute'
                        ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/30'
                        : func.type === 'ai'
                          ? 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
                          : 'bg-green-500/20 border-green-500/50 ring-2 ring-green-500/30';
                      
                      const textColor = func.type === 'compute' ? 'text-amber-600' : func.type === 'ai' ? 'text-purple-600' : 'text-green-600';
                      const pingColor = func.type === 'compute' ? 'bg-amber-400' : func.type === 'ai' ? 'bg-purple-400' : 'bg-green-400';
                      const dotColor = func.type === 'compute' ? 'bg-amber-500' : func.type === 'ai' ? 'bg-purple-500' : 'bg-green-500';
                      const progressColor = func.type === 'compute' ? 'bg-amber-500' : func.type === 'ai' ? 'bg-purple-500' : 'bg-green-500';
                      
                      return (
                        <div 
                          key={func.name} 
                          className={`p-2 rounded-lg border transition-all ${isRunning ? runningClasses : baseClasses}`}
                        >
                          <div className={`font-medium text-xs flex items-center justify-between ${textColor}`}>
                            <span className="flex items-center gap-1">
                              {func.name}
                              {isRunning && (
                                <span className="relative flex h-2 w-2 ml-1">
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-75`}></span>
                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
                                </span>
                              )}
                            </span>
                            {status && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                isRunning ? 'bg-green-500 text-white' :
                                isComplete ? 'bg-blue-500/20 text-blue-600' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {isRunning ? 'Running' : isComplete ? 'Done' : 'Idle'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center justify-between mt-1">
                            <span>{func.schedule}</span>
                            {status?.total_processed > 0 && (
                              <span className="font-mono text-xs">{status.total_processed} items</span>
                            )}
                          </div>
                          {isRunning && status?.current_offset > 0 && (
                            <div className="mt-1.5">
                              <div className="h-1 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${progressColor}`}
                                  style={{ width: `${Math.min((status.current_offset / 539) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stage 3: Database Tables */}
                <div className="space-y-3">
                  <div className="text-center">
                    <Badge className="mb-3 bg-amber-500/20 text-amber-600 border-amber-500/30 px-4 py-1">
                      <Database className="h-3 w-3 mr-1 inline" />
                      3. Database Tables
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { name: "members", type: "core" },
                      { name: "bills", type: "core" },
                      { name: "votes", type: "core" },
                      { name: "member_votes", type: "core" },
                      { name: "bill_sponsorships", type: "core" },
                      { name: "member_committees", type: "core" },
                      { name: "member_scores", type: "computed" },
                      { name: "state_scores", type: "computed" },
                      { name: "member_contributions", type: "finance" },
                      { name: "funding_metrics", type: "finance" },
                      { name: "issue_signals", type: "ai" },
                      { name: "politician_positions", type: "ai" },
                    ].map((table) => (
                      <div 
                        key={table.name} 
                        className={`p-1.5 rounded text-center border ${
                          table.type === 'core' ? 'bg-amber-500/10 border-amber-500/30' :
                          table.type === 'computed' ? 'bg-green-500/10 border-green-500/30' :
                          table.type === 'finance' ? 'bg-blue-500/10 border-blue-500/30' :
                          'bg-purple-500/10 border-purple-500/30'
                        }`}
                      >
                        <code className="text-xs">{table.name}</code>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center mt-2">
                    <Badge variant="outline" className="text-xs bg-amber-500/5">Core</Badge>
                    <Badge variant="outline" className="text-xs bg-green-500/5">Computed</Badge>
                    <Badge variant="outline" className="text-xs bg-blue-500/5">Finance</Badge>
                    <Badge variant="outline" className="text-xs bg-purple-500/5">AI</Badge>
                  </div>
                </div>

                {/* Stage 4: UI Components */}
                <div className="space-y-3">
                  <div className="text-center">
                    <Badge className="mb-3 bg-purple-500/20 text-purple-600 border-purple-500/30 px-4 py-1">
                      <Layers className="h-3 w-3 mr-1 inline" />
                      4. UI Components
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "MemberPage", desc: "Member profiles", icon: Users },
                      { name: "StatePage", desc: "State overview", icon: Building },
                      { name: "BillsPage", desc: "Legislation browser", icon: FileText },
                      { name: "VotesPage", desc: "Roll call votes", icon: Vote },
                      { name: "USMap", desc: "Interactive map", icon: Globe },
                      { name: "ScoreRing", desc: "Score visualization", icon: Activity },
                      { name: "FundingProfile", desc: "Finance charts", icon: DollarSign },
                      { name: "AlignmentWidget", desc: "User alignment", icon: Users },
                      { name: "MyMatchesPage", desc: "Best matches", icon: Sparkles },
                    ].map((comp) => (
                      <div key={comp.name} className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors">
                        <div className="flex items-center gap-2">
                          <comp.icon className="h-3 w-3 text-purple-600" />
                          <span className="font-medium text-purple-600 text-xs">{comp.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground ml-5">{comp.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Connection Arrows (visible on desktop) */}
              <div className="hidden md:block absolute top-1/2 left-[24%] w-[2%] h-0.5 bg-gradient-to-r from-blue-500 to-green-500">
                <ArrowRight className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              </div>
              <div className="hidden md:block absolute top-1/2 left-[49%] w-[2%] h-0.5 bg-gradient-to-r from-green-500 to-amber-500">
                <ArrowRight className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
              </div>
              <div className="hidden md:block absolute top-1/2 left-[74%] w-[2%] h-0.5 bg-gradient-to-r from-amber-500 to-purple-500">
                <ArrowRight className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Flow Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Congress Data Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10">
                <Badge variant="outline" className="text-xs shrink-0">API</Badge>
                <span>Congress.gov /member, /bill, /vote endpoints</span>
              </div>
              <div className="pl-6 border-l-2 border-blue-500/30 text-muted-foreground text-xs py-1">
                ↓ sync-congress-members processes 539 current members<br/>
                ↓ sync-bills processes HR + S bills with sponsors<br/>
                ↓ sync-votes parses House Clerk + Senate XML
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10">
                <Badge variant="outline" className="text-xs shrink-0">DB</Badge>
                <span>members, bills, votes, member_votes, bill_sponsorships, member_committees</span>
              </div>
              <div className="pl-6 border-l-2 border-amber-500/30 text-muted-foreground text-xs py-1">
                ↓ React Query hooks fetch data for rendering
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-500/10">
                <Badge variant="outline" className="text-xs shrink-0">UI</Badge>
                <span>MemberPage, MemberCard, StatePage, VotesPage, BillsPage</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                FEC Finance Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10">
                <Badge variant="outline" className="text-xs shrink-0">API</Badge>
                <span>FEC /schedules/schedule_a, /candidate/totals</span>
              </div>
              <div className="pl-6 border-l-2 border-green-500/30 text-muted-foreground text-xs py-1">
                ↓ sync-fec-finance matches members by name/state<br/>
                ↓ Processes itemized contributions &gt;$200<br/>
                ↓ sync-fec-funding calculates dependency metrics
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10">
                <Badge variant="outline" className="text-xs shrink-0">DB</Badge>
                <span>member_contributions, member_sponsors, funding_metrics</span>
              </div>
              <div className="pl-6 border-l-2 border-amber-500/30 text-muted-foreground text-xs py-1">
                ↓ useMemberFinance hook fetches for UI
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-500/10">
                <Badge variant="outline" className="text-xs shrink-0">UI</Badge>
                <span>FundingProfile, ContributorsList, SponsorsList, USMap (funding layer)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" />
                Score Calculation Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10">
                <Badge variant="outline" className="text-xs shrink-0">Input</Badge>
                <span>member_votes + bill_sponsorships + funding_metrics</span>
              </div>
              <div className="pl-6 border-l-2 border-amber-500/30 text-muted-foreground text-xs py-1">
                ↓ calculate-member-scores aggregates with recency weighting<br/>
                ↓ Computes productivity, attendance, bipartisanship<br/>
                ↓ recalculate-state-scores averages by state
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10">
                <Badge variant="outline" className="text-xs shrink-0">DB</Badge>
                <span>member_scores, state_scores</span>
              </div>
              <div className="pl-6 border-l-2 border-amber-500/30 text-muted-foreground text-xs py-1">
                ↓ Pre-computed for fast UI rendering
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-500/10">
                <Badge variant="outline" className="text-xs shrink-0">UI</Badge>
                <span>ScoreRing, ScoreBreakdown, USMap coloring, StatePage</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                User Alignment Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex items-center gap-2 p-2 rounded bg-purple-500/10">
                <Badge variant="outline" className="text-xs shrink-0">Input</Badge>
                <span>user_answers + user_issue_priorities (from ProfileWizard)</span>
              </div>
              <div className="pl-6 border-l-2 border-purple-500/30 text-muted-foreground text-xs py-1">
                ↓ classify-issue-signals uses AI to tag bills/votes<br/>
                ↓ compute-politician-positions aggregates stances<br/>
                ↓ useAlignment computes user-politician match
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10">
                <Badge variant="outline" className="text-xs shrink-0">DB</Badge>
                <span>issue_signals, politician_issue_positions, user_politician_alignment</span>
              </div>
              <div className="pl-6 border-l-2 border-purple-500/30 text-muted-foreground text-xs py-1">
                ↓ Cached with profile_version for invalidation
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-500/10">
                <Badge variant="outline" className="text-xs shrink-0">UI</Badge>
                <span>AlignmentWidget, MyMatchesPage, ProfileWizard</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Cron Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Cron Job Schedule
            </CardTitle>
            <CardDescription>Automated sync and computation schedule with descriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cronSchedule.map((job) => (
                <div key={job.job} className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{job.job}</span>
                    <code className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{job.cron}</code>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{job.schedule}</p>
                  <p className="text-xs text-muted-foreground/70">{job.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* UI Section Mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              UI Section → Data Mappings
            </CardTitle>
            <CardDescription>Complete field-level mappings showing exactly where each UI element gets its data</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {uiSectionMappings.map((section, index) => (
                <AccordionItem key={index} value={`section-${index}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <span className="font-medium">{section.section}</span>
                      <div className="flex gap-1 ml-auto mr-4">
                        {section.tables.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2 pl-4 border-l-2 border-primary/20">
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm">
                        {section.component && (
                          <div>
                            <span className="text-muted-foreground">Component: </span>
                            <code className="bg-muted px-2 py-0.5 rounded text-xs">{section.component}</code>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Sync: </span>
                          {section.syncFunctions.map((fn) => (
                            <Badge key={fn} variant="secondary" className="mr-1 text-xs">{fn}</Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-xs">UI Field</th>
                              <th className="px-3 py-2 text-left font-medium text-xs">Database Column</th>
                              <th className="px-3 py-2 text-left font-medium text-xs">Data Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.fields.map((field, fi) => (
                              <tr key={fi} className="border-t hover:bg-muted/30">
                                <td className="px-3 py-2 text-xs font-medium">{field.uiField}</td>
                                <td className="px-3 py-2">
                                  <code className="text-xs bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded">{field.table}.{field.dbField}</code>
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">{field.source}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
