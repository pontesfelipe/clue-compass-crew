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
        <Card>
          <CardHeader>
            <CardTitle>Cron Schedule</CardTitle>
            <CardDescription>Automated sync job schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cronSchedule.map((job) => (
                <div key={job.job} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <span className="font-medium">{job.job}</span>
                    <p className="text-sm text-muted-foreground">{job.schedule}</p>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{job.cron}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UI Section Mappings</CardTitle>
            <CardDescription>How data flows to UI components</CardDescription>
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
                    <div className="space-y-2 pt-2">
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Sync: {section.syncFunctions.join(", ")}
                      </p>
                      <div className="mt-2 space-y-1">
                        {section.fields.slice(0, 4).map((field, fi) => (
                          <div key={fi} className="text-xs grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                            <span className="font-medium">{field.uiField}</span>
                            <span className="font-mono">{field.dbField}</span>
                            <span className="text-muted-foreground truncate">{field.source}</span>
                          </div>
                        ))}
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
