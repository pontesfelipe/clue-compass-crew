import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Vote, Clock, FileText, ExternalLink, AlertCircle } from "lucide-react";
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

// Primary dates for 2026 (approximate - vary by state)
const PRIMARY_DATES_2026 = [
  { state: "Texas", date: "2026-03-03" },
  { state: "California", date: "2026-03-03" },
  { state: "Ohio", date: "2026-05-05" },
  { state: "Pennsylvania", date: "2026-05-19" },
  { state: "Georgia", date: "2026-05-19" },
];

export default function CongressNewsPage() {
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
                    Key state primary elections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {PRIMARY_DATES_2026.map((primary, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{primary.state}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(primary.date), "MMM d, yyyy")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    * Dates are approximate and subject to change. Check your state's election website for official dates.
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
