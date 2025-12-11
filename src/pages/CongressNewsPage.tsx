import { useState } from "react";
import { Link } from "react-router-dom";
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
  state?: string;
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

// All 50 states election info for 2026 (estimated based on historical patterns)
// Registration deadlines: days before election, "SDR" = Same Day Registration, "None" = No registration required
const STATE_ELECTION_INFO_2026 = [
  { state: "Alabama", abbr: "AL", primaryDate: "2026-05-26", type: "Open", regDeadline: 15, regNote: null },
  { state: "Alaska", abbr: "AK", primaryDate: "2026-08-18", type: "Open", regDeadline: 30, regNote: null },
  { state: "Arizona", abbr: "AZ", primaryDate: "2026-08-04", type: "Closed", regDeadline: 29, regNote: null },
  { state: "Arkansas", abbr: "AR", primaryDate: "2026-05-19", type: "Open", regDeadline: 30, regNote: null },
  { state: "California", abbr: "CA", primaryDate: "2026-03-03", type: "Top-Two", regDeadline: 15, regNote: "SDR available" },
  { state: "Colorado", abbr: "CO", primaryDate: "2026-06-30", type: "Semi-Closed", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Connecticut", abbr: "CT", primaryDate: "2026-08-11", type: "Closed", regDeadline: 7, regNote: "SDR available" },
  { state: "Delaware", abbr: "DE", primaryDate: "2026-09-08", type: "Closed", regDeadline: 24, regNote: null },
  { state: "Florida", abbr: "FL", primaryDate: "2026-08-25", type: "Closed", regDeadline: 29, regNote: null },
  { state: "Georgia", abbr: "GA", primaryDate: "2026-05-19", type: "Open", regDeadline: 29, regNote: null },
  { state: "Hawaii", abbr: "HI", primaryDate: "2026-08-08", type: "Open", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Idaho", abbr: "ID", primaryDate: "2026-05-19", type: "Closed", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Illinois", abbr: "IL", primaryDate: "2026-03-17", type: "Open", regDeadline: 28, regNote: "SDR available" },
  { state: "Indiana", abbr: "IN", primaryDate: "2026-05-05", type: "Open", regDeadline: 29, regNote: null },
  { state: "Iowa", abbr: "IA", primaryDate: "2026-06-02", type: "Semi-Closed", regDeadline: 15, regNote: "SDR available" },
  { state: "Kansas", abbr: "KS", primaryDate: "2026-08-04", type: "Semi-Closed", regDeadline: 21, regNote: null },
  { state: "Kentucky", abbr: "KY", primaryDate: "2026-05-19", type: "Closed", regDeadline: 29, regNote: null },
  { state: "Louisiana", abbr: "LA", primaryDate: "2026-11-03", type: "Jungle", regDeadline: 30, regNote: null },
  { state: "Maine", abbr: "ME", primaryDate: "2026-06-09", type: "Semi-Closed", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Maryland", abbr: "MD", primaryDate: "2026-06-23", type: "Closed", regDeadline: 21, regNote: "SDR available" },
  { state: "Massachusetts", abbr: "MA", primaryDate: "2026-09-01", type: "Semi-Closed", regDeadline: 10, regNote: null },
  { state: "Michigan", abbr: "MI", primaryDate: "2026-08-04", type: "Open", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Minnesota", abbr: "MN", primaryDate: "2026-08-11", type: "Open", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Mississippi", abbr: "MS", primaryDate: "2026-06-02", type: "Open", regDeadline: 30, regNote: null },
  { state: "Missouri", abbr: "MO", primaryDate: "2026-08-04", type: "Open", regDeadline: 27, regNote: null },
  { state: "Montana", abbr: "MT", primaryDate: "2026-06-02", type: "Open", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Nebraska", abbr: "NE", primaryDate: "2026-05-12", type: "Semi-Closed", regDeadline: 18, regNote: null },
  { state: "Nevada", abbr: "NV", primaryDate: "2026-06-09", type: "Closed", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "New Hampshire", abbr: "NH", primaryDate: "2026-09-08", type: "Semi-Closed", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "New Jersey", abbr: "NJ", primaryDate: "2026-06-02", type: "Semi-Closed", regDeadline: 21, regNote: null },
  { state: "New Mexico", abbr: "NM", primaryDate: "2026-06-02", type: "Closed", regDeadline: 28, regNote: "SDR available" },
  { state: "New York", abbr: "NY", primaryDate: "2026-06-23", type: "Closed", regDeadline: 25, regNote: null },
  { state: "North Carolina", abbr: "NC", primaryDate: "2026-03-03", type: "Semi-Closed", regDeadline: 25, regNote: "SDR during early voting" },
  { state: "North Dakota", abbr: "ND", primaryDate: "2026-06-09", type: "Open", regDeadline: -1, regNote: "No registration required" },
  { state: "Ohio", abbr: "OH", primaryDate: "2026-05-05", type: "Semi-Closed", regDeadline: 30, regNote: null },
  { state: "Oklahoma", abbr: "OK", primaryDate: "2026-06-30", type: "Closed", regDeadline: 25, regNote: null },
  { state: "Oregon", abbr: "OR", primaryDate: "2026-05-19", type: "Closed", regDeadline: 21, regNote: null },
  { state: "Pennsylvania", abbr: "PA", primaryDate: "2026-05-19", type: "Closed", regDeadline: 15, regNote: null },
  { state: "Rhode Island", abbr: "RI", primaryDate: "2026-09-08", type: "Semi-Closed", regDeadline: 30, regNote: null },
  { state: "South Carolina", abbr: "SC", primaryDate: "2026-06-09", type: "Open", regDeadline: 30, regNote: null },
  { state: "South Dakota", abbr: "SD", primaryDate: "2026-06-02", type: "Semi-Closed", regDeadline: 15, regNote: null },
  { state: "Tennessee", abbr: "TN", primaryDate: "2026-08-06", type: "Open", regDeadline: 30, regNote: null },
  { state: "Texas", abbr: "TX", primaryDate: "2026-03-03", type: "Open", regDeadline: 30, regNote: null },
  { state: "Utah", abbr: "UT", primaryDate: "2026-06-30", type: "Closed", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Vermont", abbr: "VT", primaryDate: "2026-08-11", type: "Open", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Virginia", abbr: "VA", primaryDate: "2026-06-09", type: "Open", regDeadline: 22, regNote: "SDR available" },
  { state: "Washington", abbr: "WA", primaryDate: "2026-08-04", type: "Top-Two", regDeadline: 8, regNote: "SDR available" },
  { state: "West Virginia", abbr: "WV", primaryDate: "2026-05-12", type: "Semi-Closed", regDeadline: 21, regNote: null },
  { state: "Wisconsin", abbr: "WI", primaryDate: "2026-08-11", type: "Open", regDeadline: 0, regNote: "Same Day Registration" },
  { state: "Wyoming", abbr: "WY", primaryDate: "2026-08-18", type: "Closed", regDeadline: 14, regNote: "SDR available" },
].sort((a, b) => new Date(a.primaryDate).getTime() - new Date(b.primaryDate).getTime());

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

  // Filter states based on search
  const filteredStates = STATE_ELECTION_INFO_2026.filter(
    (state) =>
      state.state.toLowerCase().includes(primarySearch.toLowerCase()) ||
      state.abbr.toLowerCase().includes(primarySearch.toLowerCase())
  );

  // Show limited or all states
  const displayedStates = showAllPrimaries || primarySearch 
    ? filteredStates 
    : filteredStates.slice(0, 10);

  // Helper to format registration deadline
  const formatRegDeadline = (days: number, note: string | null) => {
    if (days === -1) return "None required";
    if (days === 0) return note || "Election Day";
    return `${days} days before`;
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
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">House</Badge>
                                  {item.billNumber && (
                                    <Badge variant="secondary" className="text-xs">{item.billNumber}</Badge>
                                  )}
                                  {item.state && (
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                      {item.state}
                                    </Badge>
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
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">Senate</Badge>
                                  {item.billNumber && (
                                    <Badge variant="secondary" className="text-xs">{item.billNumber}</Badge>
                                  )}
                                  {item.state && (
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                      {item.state}
                                    </Badge>
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

              {/* View All Votes Link */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Vote className="h-6 w-6 text-primary" />
                      <div>
                        <h3 className="font-semibold text-foreground">Congressional Votes</h3>
                        <p className="text-sm text-muted-foreground">
                          Browse all roll call votes with detailed breakdowns
                        </p>
                      </div>
                    </div>
                    <Button variant="civic" asChild>
                      <Link to="/votes">View All Votes</Link>
                    </Button>
                  </div>
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

              {/* 2026 State Election Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">2026 Election Calendar</CardTitle>
                  <CardDescription>
                    Primary dates & voter registration deadlines
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

                  {/* State list */}
                  <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {displayedStates.length > 0 ? (
                      displayedStates.map((state, idx) => (
                        <div 
                          key={idx} 
                          className="rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-muted-foreground w-7">{state.abbr}</span>
                              <span className="font-medium text-sm">{state.state}</span>
                            </div>
                            <Badge className={`${getPrimaryTypeColor(state.type)} text-xs px-1.5 py-0`}>
                              {state.type}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Primary:</span>
                              <span className="ml-1 font-medium">
                                {format(new Date(state.primaryDate), "MMM d, yyyy")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Registration:</span>
                              <span className={`ml-1 font-medium ${state.regDeadline === 0 || state.regDeadline === -1 ? "text-green-600 dark:text-green-400" : ""}`}>
                                {formatRegDeadline(state.regDeadline, state.regNote)}
                              </span>
                            </div>
                          </div>
                          {state.regNote && state.regDeadline !== 0 && state.regDeadline !== -1 && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {state.regNote}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4 text-sm">
                        No states match your search.
                      </p>
                    )}
                  </div>

                  {/* Show more/less button */}
                  {!primarySearch && filteredStates.length > 10 && (
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

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>* Primary dates are estimates. Registration deadlines are days before election.</p>
                    <p>* "SDR" = Same Day Registration option available at polls.</p>
                  </div>
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
