import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAlignmentProfile } from "@/features/alignment/hooks/useAlignmentProfile";
import { useTopAlignments } from "@/features/alignment/hooks/useTopAlignments";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Settings, MapPin, Building, ArrowRight, UserCircle } from "lucide-react";
import { Helmet } from "react-helmet";
import { cn } from "@/lib/utils";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function getAlignmentColor(score: number) {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getProgressColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

interface MemberCardProps {
  member: {
    id: string;
    full_name: string;
    party: string;
    chamber: string;
    state: string;
    image_url: string | null;
    overall_alignment: number;
  };
  showState?: boolean;
}

function MatchCard({ member, showState = false }: MemberCardProps) {
  const partyColor = {
    D: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    R: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    I: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    L: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  }[member.party] || "bg-muted text-muted-foreground";

  return (
    <Link to={`/member/${member.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.image_url || undefined} alt={member.full_name} />
              <AvatarFallback>
                {member.full_name.split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{member.full_name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className={cn("text-xs", partyColor)}>
                  {member.party === "D" ? "Democrat" : member.party === "R" ? "Republican" : member.party === "I" ? "Independent" : member.party}
                </Badge>
                <span className="capitalize">{member.chamber}</span>
                {showState && (
                  <>
                    <span>•</span>
                    <span>{member.state}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="text-right shrink-0">
              <div className={cn("text-xl font-bold", getAlignmentColor(member.overall_alignment))}>
                {member.overall_alignment}%
              </div>
              <div className="w-16 mt-1">
                <Progress 
                  value={member.overall_alignment} 
                  className="h-1.5"
                  style={{ 
                    ["--progress-background" as string]: getProgressColor(member.overall_alignment) 
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MyMatchesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useAlignmentProfile();
  const { data: alignments, isLoading: alignmentsLoading } = useTopAlignments(5);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth?redirect=/my-matches");
    }
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8 lg:py-12">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-96" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const userState = profile?.state;
  const profileComplete = profile?.profile_complete;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>My Matches | CivicScore</title>
        <meta
          name="description"
          content="See which politicians best align with your views based on your profile answers."
        />
      </Helmet>

      <Header />

      <main className="civic-container py-8 lg:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
                My Matches
              </h1>
              <p className="text-lg text-muted-foreground mt-2">
                Politicians who align with your views
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/my-profile">
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Link>
            </Button>
          </div>

          {!profileComplete ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCircle className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold mb-2">Complete Your Profile</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Answer a few questions about the issues that matter to you, and we'll show you which politicians best align with your views.
                </p>
                <Button variant="civic" asChild>
                  <Link to="/my-profile">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* In-State Matches */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Top Matches in {userState ? STATE_NAMES[userState] || userState : "Your State"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {alignmentsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : alignments?.inState.length ? (
                    <div className="space-y-3">
                      {alignments.inState.map((member) => (
                        <MatchCard key={member.id} member={member} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No alignment data yet. Visit member pages to calculate alignments.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Out-of-State Matches */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Top Matches Nationwide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {alignmentsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : alignments?.outOfState.length ? (
                    <div className="space-y-3">
                      {alignments.outOfState.map((member) => (
                        <MatchCard key={member.id} member={member} showState />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No alignment data yet. Visit member pages to calculate alignments.
                    </p>
                  )}
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground text-center">
                Alignment scores are calculated when you visit a member's page. 
                <Link to="/map" className="text-primary hover:underline ml-1">
                  Explore more representatives
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
