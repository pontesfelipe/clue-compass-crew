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
  {
    table: "bill_sponsorships",
    source: "Congress.gov API",
    syncFunction: "sync-bills",
    fields: [
      { name: "bill_id", source: "/bill/{congress}/{type}/{number}", notes: "Foreign key to bills table" },
      { name: "member_id", source: "Mapped from bioguideId", notes: "Foreign key to members table" },
      { name: "is_sponsor", source: "/bill sponsors endpoint", notes: "Primary sponsor = true" },
      { name: "is_original_cosponsor", source: "/bill cosponsors endpoint", notes: "From isOriginalCosponsor" },
      { name: "cosponsored_date", source: "/bill cosponsors endpoint", notes: "From sponsorshipDate" },
    ],
  },
  {
    table: "member_votes",
    source: "Congress.gov API + House Clerk XML",
    syncFunction: "sync-votes",
    fields: [
      { name: "vote_id", source: "/vote endpoint", notes: "Foreign key to votes table" },
      { name: "member_id", source: "Mapped from bioguideId", notes: "Foreign key to members table" },
      { name: "position", source: "Vote roll call data", notes: "yea, nay, present, not_voting" },
      { name: "position_normalized", source: "Parsed from raw", notes: "Standardized position" },
    ],
  },
  {
    table: "member_committees",
    source: "Congress.gov API",
    syncFunction: "sync-member-details",
    fields: [
      { name: "committee_code", source: "/member/{id} committeeAssignments", notes: "Committee systemCode" },
      { name: "committee_name", source: "/member/{id} committeeAssignments", notes: "Committee name" },
      { name: "is_chair", source: "/member/{id} committeeAssignments", notes: "Chair position" },
      { name: "is_ranking_member", source: "/member/{id} committeeAssignments", notes: "Ranking member" },
      { name: "rank", source: "Index position", notes: "Order in list" },
    ],
  },
  {
    table: "member_contributions",
    source: "FEC API (api.open.fec.gov)",
    syncFunction: "sync-fec-finance",
    fields: [
      { name: "contributor_name", source: "/schedules/schedule_a", notes: "From contributor_name field - should be actual donor name" },
      { name: "contributor_type", source: "Inferred from employer/occupation", notes: "individual, pac, corporate, union" },
      { name: "amount", source: "/schedules/schedule_a", notes: "contribution_receipt_amount" },
      { name: "cycle", source: "Request parameter", notes: "Election cycle (e.g., 2024)" },
      { name: "industry", source: "Inferred from employer/occupation", notes: "e.g., Technology, Finance" },
      { name: "contributor_state", source: "/schedules/schedule_a", notes: "contributor_state field" },
    ],
  },
  {
    table: "member_sponsors",
    source: "FEC API (api.open.fec.gov)",
    syncFunction: "sync-fec-finance",
    fields: [
      { name: "sponsor_name", source: "Aggregated from contributions", notes: "Major donors > $5000" },
      { name: "sponsor_type", source: "Inferred from contributor type", notes: "pac, corporate, union, party" },
      { name: "relationship_type", source: "Categorized", notes: "major_donor, contributor, party_support" },
      { name: "total_support", source: "SUM of contributions", notes: "Total from this sponsor" },
    ],
  },
  {
    table: "funding_metrics",
    source: "FEC API (api.open.fec.gov)",
    syncFunction: "sync-fec-funding",
    fields: [
      { name: "total_receipts", source: "/candidate/{id}/totals", notes: "Total campaign receipts" },
      { name: "pct_from_individuals", source: "Calculated", notes: "individual_contributions / total" },
      { name: "pct_from_committees", source: "Calculated", notes: "committee_contributions / total" },
      { name: "pct_from_small_donors", source: "Calculated", notes: "Contributions < $200" },
      { name: "pct_from_in_state", source: "Calculated", notes: "In-state / total contributions" },
      { name: "grassroots_support_score", source: "Calculated", notes: "Based on small donor %" },
      { name: "pac_dependence_score", source: "Calculated", notes: "Based on PAC contribution %" },
      { name: "local_money_score", source: "Calculated", notes: "Based on in-state %" },
    ],
  },
  {
    table: "member_statements",
    source: "Congress.gov API",
    syncFunction: "sync-member-details",
    fields: [
      { name: "title", source: "/member/{id}/sponsored-legislation", notes: "Bill title as activity" },
      { name: "statement_date", source: "introducedDate", notes: "Date bill was introduced" },
      { name: "statement_type", source: "Hardcoded", notes: "'sponsored_bill'" },
      { name: "subjects", source: "policyArea", notes: "Policy area name" },
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
            {dataSources.map((ds) => (
              <Card key={ds.table}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {ds.table}
                  </CardTitle>
                  <CardDescription>
                    Source: {ds.source} | Sync Function: <code className="bg-muted px-1 rounded">{ds.syncFunction}</code>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Field</th>
                          <th className="text-left py-2 px-3 font-medium">Source</th>
                          <th className="text-left py-2 px-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ds.fields.map((f) => (
                          <tr key={f.name} className="border-b">
                            <td className="py-2 px-3 font-mono text-xs">{f.name}</td>
                            <td className="py-2 px-3 text-muted-foreground">{f.source}</td>
                            <td className="py-2 px-3 text-muted-foreground">{f.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}
