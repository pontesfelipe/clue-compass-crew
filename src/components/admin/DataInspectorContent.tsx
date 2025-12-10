import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Database, Users, FileText, Vote, DollarSign, Building, Activity, AlertTriangle, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
      { uiField: "Party Badge", dbField: "party", table: "members", source: "Congress.gov /member → partyName (D/R/I)" },
      { uiField: "Chamber Badge", dbField: "chamber", table: "members", source: "Inferred: has district = house, else senate" },
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
    section: "Committees",
    description: "Committee assignments with roles",
    component: "MemberCommittees",
    tables: ["member_committees"],
    syncFunctions: ["sync-member-details"],
    fields: [
      { uiField: "Committee Name", dbField: "committee_name", table: "member_committees", source: "Congress.gov /member/{id} → committeeAssignments[].name" },
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
    ],
  },
];

const dataSources = [
  {
    table: "members",
    source: "Congress.gov API",
    syncFunction: "sync-congress-members",
  },
  {
    table: "member_scores",
    source: "Calculated from bill_sponsorships + member_votes",
    syncFunction: "calculate-member-scores",
  },
  {
    table: "bills",
    source: "Congress.gov API",
    syncFunction: "sync-bills",
  },
  {
    table: "votes",
    source: "Congress.gov API + House Clerk XML",
    syncFunction: "sync-votes",
  },
  {
    table: "member_contributions",
    source: "FEC API",
    syncFunction: "sync-fec-finance",
  },
  {
    table: "funding_metrics",
    source: "Calculated from FEC data",
    syncFunction: "sync-fec-funding",
  },
];

const cronSchedule = [
  { job: "sync-congress-members", schedule: "Daily at midnight UTC", cron: "0 0 * * *" },
  { job: "sync-bills", schedule: "Every 6 hours", cron: "0 */6 * * *" },
  { job: "sync-votes", schedule: "Every 2 hours", cron: "0 */2 * * *" },
  { job: "sync-member-details", schedule: "Daily at 1 AM UTC", cron: "0 1 * * *" },
  { job: "calculate-member-scores", schedule: "Every 2 hours at :30", cron: "30 */2 * * *" },
  { job: "sync-fec-funding", schedule: "Daily at 2 AM UTC", cron: "0 2 * * *" },
];

export function DataInspectorContent() {
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

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Sponsorships
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.sponsorships.length}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Vote className="h-4 w-4" />
                          Votes
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.votes.length}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Committees
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.committees.length}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Contributions
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.contributions.length}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Funding Metrics
                        </CardDescription>
                        <CardTitle className="text-2xl">{memberData.funding.length}</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      to={`/member/${selectedMemberId}`}
                      className="text-primary underline text-sm"
                      target="_blank"
                    >
                      View Member Page →
                    </Link>
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
            <CardTitle>Database Tables & Sources</CardTitle>
            <CardDescription>Overview of where data comes from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dataSources.map((ds) => (
                <div key={ds.table} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{ds.table}</span>
                    </div>
                    <Badge variant="outline">{ds.syncFunction}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ds.source}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="flow" className="space-y-6">
        {/* Visual Data Pipeline */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Data Pipeline Overview
            </CardTitle>
            <CardDescription>Visual representation of how data flows through CivicScore</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Pipeline Flow */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* External APIs */}
                <div className="space-y-3">
                  <div className="text-center">
                    <Badge variant="outline" className="mb-3 bg-blue-500/10 text-blue-600 border-blue-500/30">
                      1. External APIs
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="font-medium text-blue-600 text-sm">Congress.gov API</div>
                      <div className="text-xs text-muted-foreground mt-1">Members, Bills, Votes</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="font-medium text-blue-600 text-sm">FEC API</div>
                      <div className="text-xs text-muted-foreground mt-1">Campaign Finance</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="font-medium text-blue-600 text-sm">House Clerk XML</div>
                      <div className="text-xs text-muted-foreground mt-1">Vote Roll Calls</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="font-medium text-blue-600 text-sm">Senate.gov XML</div>
                      <div className="text-xs text-muted-foreground mt-1">Senate Votes</div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 to-green-500 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-8 border-l-green-500 border-y-4 border-y-transparent" />
                  </div>
                </div>

                {/* Sync Functions */}
                <div className="space-y-3">
                  <div className="text-center">
                    <Badge variant="outline" className="mb-3 bg-green-500/10 text-green-600 border-green-500/30">
                      2. Edge Functions
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="font-medium text-green-600 text-sm">sync-congress-members</div>
                      <div className="text-xs text-muted-foreground mt-1">Daily @ midnight</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="font-medium text-green-600 text-sm">sync-bills</div>
                      <div className="text-xs text-muted-foreground mt-1">Every 6 hours</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="font-medium text-green-600 text-sm">sync-votes</div>
                      <div className="text-xs text-muted-foreground mt-1">Every 2 hours</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="font-medium text-green-600 text-sm">sync-fec-finance</div>
                      <div className="text-xs text-muted-foreground mt-1">Every 5 min batches</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="font-medium text-green-600 text-sm">calculate-member-scores</div>
                      <div className="text-xs text-muted-foreground mt-1">Every 2 hours @ :30</div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-green-500 to-amber-500 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-8 border-l-amber-500 border-y-4 border-y-transparent" />
                  </div>
                </div>
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
                {/* Database Tables */}
                <div className="space-y-3 md:col-start-1">
                  <div className="text-center">
                    <Badge variant="outline" className="mb-3 bg-amber-500/10 text-amber-600 border-amber-500/30">
                      3. Database Tables
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["members", "bills", "votes", "member_votes", "bill_sponsorships", "member_scores", "member_contributions", "funding_metrics", "state_scores", "member_committees"].map((table) => (
                      <div key={table} className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-center">
                        <code className="text-xs text-amber-600">{table}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-amber-500 to-purple-500 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-8 border-l-purple-500 border-y-4 border-y-transparent" />
                  </div>
                </div>

                {/* UI Components */}
                <div className="space-y-3 md:col-span-2">
                  <div className="text-center">
                    <Badge variant="outline" className="mb-3 bg-purple-500/10 text-purple-600 border-purple-500/30">
                      4. UI Components
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: "MemberPage", desc: "Member profiles" },
                      { name: "StatePage", desc: "State overview" },
                      { name: "BillsPage", desc: "Legislation" },
                      { name: "VotesPage", desc: "Roll call votes" },
                      { name: "USMap", desc: "Map visualization" },
                      { name: "ScoreRing", desc: "Score display" },
                      { name: "FundingProfile", desc: "Finance charts" },
                      { name: "AlignmentWidget", desc: "User alignment" },
                    ].map((comp) => (
                      <div key={comp.name} className="p-2 rounded bg-purple-500/10 border border-purple-500/30">
                        <div className="font-medium text-purple-600 text-xs">{comp.name}</div>
                        <div className="text-xs text-muted-foreground">{comp.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Flow Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Congress Data Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">API</Badge>
                <span>Congress.gov /member endpoint</span>
              </div>
              <div className="pl-4 border-l-2 border-blue-500/30 text-muted-foreground">
                ↓ sync-congress-members processes 539 members
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">DB</Badge>
                <span>members, member_votes, bill_sponsorships</span>
              </div>
              <div className="pl-4 border-l-2 border-blue-500/30 text-muted-foreground">
                ↓ React Query fetches for UI
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">UI</Badge>
                <span>MemberPage, MemberCard, StatePage</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                FEC Finance Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">API</Badge>
                <span>FEC /schedules/schedule_a endpoint</span>
              </div>
              <div className="pl-4 border-l-2 border-green-500/30 text-muted-foreground">
                ↓ sync-fec-finance matches by name/state
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">DB</Badge>
                <span>member_contributions, funding_metrics</span>
              </div>
              <div className="pl-4 border-l-2 border-green-500/30 text-muted-foreground">
                ↓ sync-fec-funding calculates metrics
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">UI</Badge>
                <span>FundingProfile, ContributorsList</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" />
                Score Calculation Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Input</Badge>
                <span>member_votes + bill_sponsorships</span>
              </div>
              <div className="pl-4 border-l-2 border-amber-500/30 text-muted-foreground">
                ↓ calculate-member-scores aggregates
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">DB</Badge>
                <span>member_scores (productivity, attendance, etc)</span>
              </div>
              <div className="pl-4 border-l-2 border-amber-500/30 text-muted-foreground">
                ↓ recalculate-state-scores averages by state
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">UI</Badge>
                <span>ScoreRing, USMap coloring</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                User Alignment Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Input</Badge>
                <span>user_answers + user_issue_priorities</span>
              </div>
              <div className="pl-4 border-l-2 border-purple-500/30 text-muted-foreground">
                ↓ classify-issue-signals (AI classification)
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">DB</Badge>
                <span>issue_signals, politician_issue_positions</span>
              </div>
              <div className="pl-4 border-l-2 border-purple-500/30 text-muted-foreground">
                ↓ compute-politician-positions calculates
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">UI</Badge>
                <span>AlignmentWidget, MyMatchesPage</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cron Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Cron Schedule</CardTitle>
            <CardDescription>Automated sync job schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cronSchedule.map((job) => (
                <div key={job.job} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <span className="font-medium text-sm">{job.job}</span>
                    <p className="text-xs text-muted-foreground">{job.schedule}</p>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{job.cron}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* UI Section Mappings */}
        <Card>
          <CardHeader>
            <CardTitle>UI Section Mappings</CardTitle>
            <CardDescription>Detailed field-level data mappings for each UI component</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {uiSectionMappings.map((section, index) => (
                <AccordionItem key={index} value={`section-${index}`}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span>{section.section}</span>
                      <Badge variant="outline" className="ml-2">{section.tables.join(", ")}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="text-sm text-muted-foreground">{section.description}</div>
                      {section.component && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Component: </span>
                          <code className="bg-muted px-1 rounded">{section.component}</code>
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="text-muted-foreground">Sync Functions: </span>
                        {section.syncFunctions.map((fn) => (
                          <Badge key={fn} variant="secondary" className="mr-1">{fn}</Badge>
                        ))}
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">UI Field</th>
                              <th className="px-3 py-2 text-left font-medium">DB Field</th>
                              <th className="px-3 py-2 text-left font-medium">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.fields.map((field, fi) => (
                              <tr key={fi} className="border-t">
                                <td className="px-3 py-2">{field.uiField}</td>
                                <td className="px-3 py-2">
                                  <code className="text-xs bg-muted px-1 rounded">{field.table}.{field.dbField}</code>
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
