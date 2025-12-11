import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Vote, Clock, FileText, ExternalLink, AlertCircle, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Helmet } from "react-helmet";

interface FloorItem {
  date: string;
  chamber: string;
  description: string;
  billNumber?: string;
  actionType?: string;
}

interface UpcomingElection {
  date: string;
  name: string;
  description: string;
  type: "primary" | "general" | "special";
}

// Static election dates - these are known future dates
const UPCOMING_ELECTIONS: UpcomingElection[] = [
  {
    date: "2026-11-03",
    name: "2026 Midterm Elections",
    description: "All 435 House seats and 33 Senate seats up for election",
    type: "general",
  },
  {
    date: "2028-11-07",
    name: "2028 Presidential Election",
    description: "Presidential election plus all 435 House seats and 33 Senate seats",
    type: "general",
  },
];

// All 50 states primary dates for 2026 (estimated based on historical patterns)
const PRIMARY_DATES_2026 = [
  { state: "Alabama", abbr: "AL", date: "2026-05-26", type: "Open" },
  { state: "Alaska", abbr: "AK", date: "2026-08-18", type: "Open" },
  { state: "Arizona", abbr: "AZ", date: "2026-08-04", type: "Closed" },
  { state: "Arkansas", abbr: "AR", date: "2026-05-19", type: "Open" },
  { state: "California", abbr: "CA", date: "2026-03-03", type: "Top-Two" },
  { state: "Colorado", abbr: "CO", date: "2026-06-30", type: "Semi-Closed" },
  { state: "Connecticut", abbr: "CT", date: "2026-08-11", type: "Closed" },
  { state: "Delaware", abbr: "DE", date: "2026-09-08", type: "Closed" },
  { state: "Florida", abbr: "FL", date: "2026-08-25", type: "Closed" },
  { state: "Georgia", abbr: "GA", date: "2026-05-19", type: "Open" },
  { state: "Hawaii", abbr: "HI", date: "2026-08-08", type: "Open" },
  { state: "Idaho", abbr: "ID", date: "2026-05-19", type: "Closed" },
  { state: "Illinois", abbr: "IL", date: "2026-03-17", type: "Open" },
  { state: "Indiana", abbr: "IN", date: "2026-05-05", type: "Open" },
  { state: "Iowa", abbr: "IA", date: "2026-06-02", type: "Semi-Closed" },
  { state: "Kansas", abbr: "KS", date: "2026-08-04", type: "Semi-Closed" },
  { state: "Kentucky", abbr: "KY", date: "2026-05-19", type: "Closed" },
  { state: "Louisiana", abbr: "LA", date: "2026-11-03", type: "Jungle" },
  { state: "Maine", abbr: "ME", date: "2026-06-09", type: "Semi-Closed" },
  { state: "Maryland", abbr: "MD", date: "2026-06-23", type: "Closed" },
  { state: "Massachusetts", abbr: "MA", date: "2026-09-01", type: "Semi-Closed" },
  { state: "Michigan", abbr: "MI", date: "2026-08-04", type: "Open" },
  { state: "Minnesota", abbr: "MN", date: "2026-08-11", type: "Open" },
  { state: "Mississippi", abbr: "MS", date: "2026-06-02", type: "Open" },
  { state: "Missouri", abbr: "MO", date: "2026-08-04", type: "Open" },
  { state: "Montana", abbr: "MT", date: "2026-06-02", type: "Open" },
  { state: "Nebraska", abbr: "NE", date: "2026-05-12", type: "Semi-Closed" },
  { state: "Nevada", abbr: "NV", date: "2026-06-09", type: "Closed" },
  { state: "New Hampshire", abbr: "NH", date: "2026-09-08", type: "Semi-Closed" },
  { state: "New Jersey", abbr: "NJ", date: "2026-06-02", type: "Semi-Closed" },
  { state: "New Mexico", abbr: "NM", date: "2026-06-02", type: "Closed" },
  { state: "New York", abbr: "NY", date: "2026-06-23", type: "Closed" },
  { state: "North Carolina", abbr: "NC", date: "2026-03-03", type: "Semi-Closed" },
  { state: "North Dakota", abbr: "ND", date: "2026-06-09", type: "Open" },
  { state: "Ohio", abbr: "OH", date: "2026-05-05", type: "Semi-Closed" },
  { state: "Oklahoma", abbr: "OK", date: "2026-06-30", type: "Closed" },
  { state: "Oregon", abbr: "OR", date: "2026-05-19", type: "Closed" },
  { state: "Pennsylvania", abbr: "PA", date: "2026-05-19", type: "Closed" },
  { state: "Rhode Island", abbr: "RI", date: "2026-09-08", type: "Semi-Closed" },
  { state: "South Carolina", abbr: "SC", date: "2026-06-09", type: "Open" },
  { state: "South Dakota", abbr: "SD", date: "2026-06-02", type: "Semi-Closed" },
  { state: "Tennessee", abbr: "TN", date: "2026-08-06", type: "Open" },
  { state: "Texas", abbr: "TX", date: "2026-03-03", type: "Open" },
  { state: "Utah", abbr: "UT", date: "2026-06-30", type: "Closed" },
  { state: "Vermont", abbr: "VT", date: "2026-08-11", type: "Open" },
  { state: "Virginia", abbr: "VA", date: "2026-06-09", type: "Open" },
  { state: "Washington", abbr: "WA", date: "2026-08-04", type: "Top-Two" },
  { state: "West Virginia", abbr: "WV", date: "2026-05-12", type: "Semi-Closed" },
  { state: "Wisconsin", abbr: "WI", date: "2026-08-11", type: "Open" },
  { state: "Wyoming", abbr: "WY", date: "2026-08-18", type: "Closed" },
].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export default function CongressNewsPage() {
  const [primarySearch, setPrimarySearch] = useState("");
  const [showAllPrimaries, setShowAllPrimaries] = useState(false);

  // Fetch recent bills as "news"
  const { data: recentBills, isLoading: billsLoading } = useQuery({
    queryKey: ["recent-bills-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("id, congress, bill_type, bill_number, title, short_title, latest_action_date, latest_action_text, policy_area, enacted")
        .order("latest_action_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent votes
  const { data: recentVotes, isLoading: votesLoading } = useQuery({
    queryKey: ["recent-votes-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("votes")
        .select("id, chamber, congress, roll_number, vote_date, question, description, result, total_yea, total_nay")
        .order("vote_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  // Fetch upcoming floor schedule from edge function
  const { data: floorSchedule, isLoading: scheduleLoading, error: scheduleError } = useQuery({
    queryKey: ["floor-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-floor-schedule");
      if (error) throw error;
      return data as { house: FloorItem[]; senate: FloorItem[] };
    },
    retry: 1,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const formatBillNumber = (type: string, number: number) => {
    return `${type.toUpperCase()} ${number}`;
  };

  const getElectionTypeColor = (type: string) => {
    switch (type) {
      case "general":
        return "bg-primary text-primary-foreground";
      case "primary":
        return "bg-secondary text-secondary-foreground";
      case "special":
        return "bg-accent text-accent-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPrimaryTypeColor = (type: string) => {
    switch (type) {
      case "Open":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Closed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Semi-Closed":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "Top-Two":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Jungle":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Filter primaries based on search
  const filteredPrimaries = PRIMARY_DATES_2026.filter(
    (primary) =>
      primary.state.toLowerCase().includes(primarySearch.toLowerCase()) ||
      primary.abbr.toLowerCase().includes(primarySearch.toLowerCase())
  );

  // Show limited or all primaries
  const displayedPrimaries = showAllPrimaries || primarySearch 
    ? filteredPrimaries 
    : filteredPrimaries.slice(0, 10);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Congress News & Updates | CivicScore</title>
        <meta
          name="description"
          content="Stay informed with the latest congressional news, upcoming votes, floor schedule, and election dates."
        />
      </Helmet>
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-12">
          <div className="civic-container">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="font-serif text-4xl font-bold text-foreground mb-4">
                Congress News & Updates
              </h1>
              <p className="text-lg text-muted-foreground">
                Stay informed with the latest congressional activity, upcoming votes, and important election dates.
              </p>
            </div>
          </div>
        </section>

        <div className="civic-container py-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Content - Recent Activity */}
            <div className="lg:col-span-2 space-y-8">
              {/* Floor Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Upcoming Floor Schedule
                  </CardTitle>
                  <CardDescription>
                    What's coming up for debate and votes in Congress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scheduleLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : scheduleError ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                      <AlertCircle className="h-5 w-5" />
                      <span>Floor schedule data temporarily unavailable</span>
                    </div>
                  ) : floorSchedule && (floorSchedule.house.length > 0 || floorSchedule.senate.length > 0) ? (
                    <div className="space-y-6">
                      {floorSchedule.house.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-3">House Floor</h4>
                          <div className="space-y-3">
                            {floorSchedule.house.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="border-l-2 border-primary/30 pl-4 py-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">House</Badge>
                                  {item.billNumber && (
                                    <Badge variant="secondary" className="text-xs">{item.billNumber}</Badge>
                                  )}
                                </div>
                                <p className="text-sm">{item.description}</p>
                                {item.date && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(item.date), "MMMM d, yyyy")}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {floorSchedule.senate.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-3">Senate Floor</h4>
                          <div className="space-y-3">
                            {floorSchedule.senate.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="border-l-2 border-accent/30 pl-4 py-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">Senate</Badge>
                                  {item.billNumber && (
                                    <Badge variant="secondary" className="text-xs">{item.billNumber}</Badge>
                                  )}
                                </div>
                                <p className="text-sm">{item.description}</p>
                                {item.date && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(item.date), "MMMM d, yyyy")}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No upcoming floor items scheduled at this time.</p>
                      <p className="text-sm mt-2">Check back later for updates.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Votes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Vote className="h-5 w-5 text-primary" />
                    Recent Votes
                  </CardTitle>
                  <CardDescription>
                    Latest roll call votes from both chambers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {votesLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : recentVotes && recentVotes.length > 0 ? (
                    <div className="space-y-4">
                      {recentVotes.map((vote) => (
                        <div
                          key={vote.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={vote.chamber === "house" ? "default" : "secondary"}>
                                  {vote.chamber === "house" ? "House" : "Senate"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Roll #{vote.roll_number}
                                </span>
                              </div>
                              <p className="text-sm font-medium line-clamp-2">
                                {vote.question || vote.description || "Vote"}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>{format(new Date(vote.vote_date), "MMM d, yyyy")}</span>
                                <span className={vote.result?.toLowerCase().includes("passed") ? "text-green-600" : "text-red-600"}>
                                  {vote.result}
                                </span>
                                <span>Yea: {vote.total_yea} / Nay: {vote.total_nay}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No recent votes found.</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Bills */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Recent Legislative Activity
                  </CardTitle>
                  <CardDescription>
                    Latest bill actions and updates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {billsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : recentBills && recentBills.length > 0 ? (
                    <div className="space-y-4">
                      {recentBills.map((bill) => (
                        <div
                          key={bill.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">
                                  {formatBillNumber(bill.bill_type, bill.bill_number)}
                                </Badge>
                                {bill.enacted && (
                                  <Badge className="bg-green-600">Enacted</Badge>
                                )}
                                {bill.policy_area && (
                                  <Badge variant="secondary" className="text-xs">
                                    {bill.policy_area}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium line-clamp-2">
                                {bill.short_title || bill.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {bill.latest_action_text}
                              </p>
                              {bill.latest_action_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(bill.latest_action_date), { addSuffix: true })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No recent bills found.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Elections */}
            <div className="space-y-6">
              {/* Upcoming Elections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Elections
                  </CardTitle>
                  <CardDescription>
                    Important dates to mark on your calendar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {UPCOMING_ELECTIONS.map((election, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <Badge className={getElectionTypeColor(election.type)}>
                        {election.type.charAt(0).toUpperCase() + election.type.slice(1)}
                      </Badge>
                      <h4 className="font-medium mt-2">{election.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {election.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(election.date), "MMMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(election.date), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 2026 Primary Dates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">2026 Primary Dates</CardTitle>
                  <CardDescription>
                    All 50 states primary elections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search states..."
                      value={primarySearch}
                      onChange={(e) => setPrimarySearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>

                  {/* Primary type legend */}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge className={getPrimaryTypeColor("Open")}>Open</Badge>
                    <Badge className={getPrimaryTypeColor("Closed")}>Closed</Badge>
                    <Badge className={getPrimaryTypeColor("Semi-Closed")}>Semi</Badge>
                    <Badge className={getPrimaryTypeColor("Top-Two")}>Top-Two</Badge>
                  </div>

                  {/* Primary list */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {displayedPrimaries.length > 0 ? (
                      displayedPrimaries.map((primary, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium w-8 text-muted-foreground">{primary.abbr}</span>
                            <span className="font-medium">{primary.state}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getPrimaryTypeColor(primary.type)} text-xs px-1.5 py-0`}>
                              {primary.type}
                            </Badge>
                            <span className="text-muted-foreground text-xs w-20 text-right">
                              {format(new Date(primary.date), "MMM d")}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4 text-sm">
                        No states match your search.
                      </p>
                    )}
                  </div>

                  {/* Show more/less button */}
                  {!primarySearch && filteredPrimaries.length > 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllPrimaries(!showAllPrimaries)}
                      className="w-full text-xs"
                    >
                      {showAllPrimaries ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Show All 50 States
                        </>
                      )}
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground">
                    * Dates are estimates based on historical patterns. Check your state's election website for official dates.
                  </p>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Official Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <a
                    href="https://www.congress.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Congress.gov
                  </a>
                  <a
                    href="https://clerk.house.gov/Votes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    House Clerk - Votes
                  </a>
                  <a
                    href="https://www.senate.gov/legislative/votes.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Senate - Roll Call Votes
                  </a>
                  <a
                    href="https://www.usa.gov/election-day"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    USA.gov - Election Information
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
