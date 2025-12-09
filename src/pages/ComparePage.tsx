import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { 
  ArrowLeft, 
  Scale,
  User,
  CheckCircle,
  XCircle,
  MinusCircle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useComparison } from "@/contexts/ComparisonContext";
import { supabase } from "@/integrations/supabase/client";

type Party = "D" | "R" | "I" | "L";

const partyColors: Record<Party, string> = {
  D: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  R: "bg-civic-red/10 text-civic-red border-civic-red/30",
  I: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
  L: "bg-civic-gold/10 text-civic-gold border-civic-gold/30",
};

const partyBgColors: Record<Party, string> = {
  D: "bg-civic-blue",
  R: "bg-civic-red",
  I: "bg-civic-slate",
  L: "bg-civic-gold",
};

interface MemberWithScores {
  id: string;
  full_name: string;
  party: Party;
  state: string;
  chamber: string;
  image_url: string | null;
  scores: {
    overall_score: number;
    productivity_score: number;
    attendance_score: number;
    bipartisanship_score: number;
    votes_cast: number;
    votes_missed: number;
    bills_sponsored: number;
    bills_cosponsored: number;
    bills_enacted: number;
  } | null;
}

function ScoreComparisonRow({ 
  label, 
  members, 
  scoreKey,
  format = "score"
}: { 
  label: string; 
  members: MemberWithScores[];
  scoreKey: keyof NonNullable<MemberWithScores["scores"]>;
  format?: "score" | "number" | "percent";
}) {
  const values = members.map((m) => m.scores?.[scoreKey] ?? 0);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  const formatValue = (val: number) => {
    if (format === "percent") return `${Math.round(val)}%`;
    if (format === "number") return val.toLocaleString();
    return Math.round(val);
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${members.length}, 1fr)` }}>
      <div className="text-sm font-medium text-muted-foreground py-3">
        {label}
      </div>
      {members.map((member, i) => {
        const value = values[i];
        const isHighest = value === maxValue && maxValue !== minValue;
        const isLowest = value === minValue && maxValue !== minValue;
        
        return (
          <div 
            key={member.id} 
            className={cn(
              "text-center py-3 rounded-lg transition-colors",
              isHighest && "bg-score-excellent/10",
              isLowest && members.length > 2 && "bg-score-bad/10"
            )}
          >
            <span className={cn(
              "text-lg font-semibold",
              isHighest && "text-score-excellent",
              isLowest && members.length > 2 && "text-score-bad"
            )}>
              {formatValue(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ComparePage() {
  const { members: selectedMembers, removeMember } = useComparison();
  const navigate = useNavigate();

  const { data: membersData, isLoading } = useQuery({
    queryKey: ["compare-members", selectedMembers.map((m) => m.id)],
    queryFn: async () => {
      if (selectedMembers.length === 0) return [];

      const { data, error } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          party,
          state,
          chamber,
          image_url,
          member_scores!inner (
            overall_score,
            productivity_score,
            attendance_score,
            bipartisanship_score,
            votes_cast,
            votes_missed,
            bills_sponsored,
            bills_cosponsored,
            bills_enacted
          )
        `)
        .in("id", selectedMembers.map((m) => m.id))
        .is("member_scores.user_id", null);

      if (error) throw error;

      return (data || []).map((m: any) => ({
        ...m,
        scores: m.member_scores?.[0] ?? null,
      })) as MemberWithScores[];
    },
    enabled: selectedMembers.length > 0,
  });

  if (selectedMembers.length < 2) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8 lg:py-12">
          <div className="flex flex-col items-center justify-center py-20">
            <Scale className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">
              Compare Members
            </h1>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Select at least 2 members to compare. You can add members from any state page or member page.
            </p>
            <Button variant="civic" asChild>
              <Link to="/map">Browse States</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground">
                Member Comparison
              </h1>
              <p className="text-muted-foreground">
                Comparing {selectedMembers.length} members side by side
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : membersData && membersData.length > 0 ? (
          <div className="space-y-8">
            {/* Member Headers */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md overflow-x-auto">
              <div 
                className="grid gap-4 min-w-max"
                style={{ gridTemplateColumns: `200px repeat(${membersData.length}, 1fr)` }}
              >
                <div className="text-sm font-medium text-muted-foreground">
                  Member
                </div>
                {membersData.map((member) => (
                  <div key={member.id} className="text-center">
                    <Link 
                      to={`/member/${member.id}`}
                      className="inline-block hover:opacity-80 transition-opacity"
                    >
                      <div className="relative mx-auto h-20 w-20 rounded-full overflow-hidden mb-3 ring-2 ring-border">
                        {member.image_url ? (
                          <img
                            src={member.image_url}
                            alt={member.full_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className={cn("h-full w-full flex items-center justify-center", partyBgColors[member.party])}>
                            <User className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-foreground text-sm">
                        {member.full_name}
                      </p>
                    </Link>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", partyColors[member.party])}
                      >
                        {member.party}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {member.state}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs mt-2">
                      {member.chamber === "senate" ? "Senate" : "House"}
                    </Badge>
                    <button
                      onClick={() => removeMember(member.id)}
                      className="block mx-auto mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Scores */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md overflow-x-auto">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
                Overall Scores
              </h2>
              <div 
                className="grid gap-4 min-w-max"
                style={{ gridTemplateColumns: `200px repeat(${membersData.length}, 1fr)` }}
              >
                <div />
                {membersData.map((member) => (
                  <div key={member.id} className="flex justify-center">
                    <ScoreRing score={member.scores?.overall_score ?? 0} size="lg" />
                  </div>
                ))}
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md overflow-x-auto">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
                Score Breakdown
              </h2>
              <div className="space-y-1 min-w-max divide-y divide-border">
                <ScoreComparisonRow 
                  label="Productivity Score" 
                  members={membersData} 
                  scoreKey="productivity_score" 
                />
                <ScoreComparisonRow 
                  label="Attendance Score" 
                  members={membersData} 
                  scoreKey="attendance_score"
                  format="percent"
                />
                <ScoreComparisonRow 
                  label="Bipartisanship Score" 
                  members={membersData} 
                  scoreKey="bipartisanship_score"
                  format="percent"
                />
              </div>
            </div>

            {/* Activity Stats */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md overflow-x-auto">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
                Legislative Activity
              </h2>
              <div className="space-y-1 min-w-max divide-y divide-border">
                <ScoreComparisonRow 
                  label="Bills Sponsored" 
                  members={membersData} 
                  scoreKey="bills_sponsored"
                  format="number"
                />
                <ScoreComparisonRow 
                  label="Bills Cosponsored" 
                  members={membersData} 
                  scoreKey="bills_cosponsored"
                  format="number"
                />
                <ScoreComparisonRow 
                  label="Bills Enacted" 
                  members={membersData} 
                  scoreKey="bills_enacted"
                  format="number"
                />
              </div>
            </div>

            {/* Voting Record */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md overflow-x-auto">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6">
                Voting Record
              </h2>
              <div className="space-y-1 min-w-max divide-y divide-border">
                <ScoreComparisonRow 
                  label="Votes Cast" 
                  members={membersData} 
                  scoreKey="votes_cast"
                  format="number"
                />
                <ScoreComparisonRow 
                  label="Votes Missed" 
                  members={membersData} 
                  scoreKey="votes_missed"
                  format="number"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Could not load member data</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
