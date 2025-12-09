import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PartyVoteBreakdown } from "@/components/PartyVoteBreakdown";
import { cn } from "@/lib/utils";
import { Calendar, Users, Vote, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface VoteDetailDialogProps {
  voteId: string | null;
  memberPosition?: string;
  onClose: () => void;
}

const positionColors: Record<string, string> = {
  yea: "bg-score-excellent/10 text-score-excellent border-score-excellent/30",
  nay: "bg-score-bad/10 text-score-bad border-score-bad/30",
  present: "bg-score-average/10 text-score-average border-score-average/30",
  not_voting: "bg-muted text-muted-foreground border-muted-foreground/30",
};

const positionLabels: Record<string, string> = {
  yea: "Yea",
  nay: "Nay",
  present: "Present",
  not_voting: "Not Voting",
};

export function VoteDetailDialog({ voteId, memberPosition, onClose }: VoteDetailDialogProps) {
  const { data: vote, isLoading } = useQuery({
    queryKey: ["vote-detail", voteId],
    queryFn: async () => {
      if (!voteId) return null;
      
      const { data, error } = await supabase
        .from("votes")
        .select(`
          *,
          bills (
            id,
            title,
            short_title,
            bill_type,
            bill_number,
            policy_area,
            summary
          )
        `)
        .eq("id", voteId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!voteId,
  });

  const formatBillNumber = (bill: any): string => {
    const typeMap: Record<string, string> = {
      hr: "H.R.",
      s: "S.",
      hjres: "H.J.Res.",
      sjres: "S.J.Res.",
      hconres: "H.Con.Res.",
      sconres: "S.Con.Res.",
      hres: "H.Res.",
      sres: "S.Res.",
    };
    const prefix = typeMap[bill.bill_type] || bill.bill_type?.toUpperCase() || "";
    return `${prefix}${bill.bill_number}`;
  };

  const totalVotes = (vote?.total_yea || 0) + (vote?.total_nay || 0) + (vote?.total_present || 0) + (vote?.total_not_voting || 0);
  const yeaPercent = totalVotes > 0 ? ((vote?.total_yea || 0) / totalVotes) * 100 : 0;
  const nayPercent = totalVotes > 0 ? ((vote?.total_nay || 0) / totalVotes) * 100 : 0;

  return (
    <Dialog open={!!voteId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Vote Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : vote ? (
          <div className="space-y-6">
            {/* Vote Question/Description */}
            <div>
              <h3 className="font-semibold text-lg text-foreground mb-2">
                {vote.question || `Roll Call #${vote.roll_number}`}
              </h3>
              {vote.description && (
                <p className="text-muted-foreground">
                  {vote.description}
                </p>
              )}
            </div>

            {/* Member's Position */}
            {memberPosition && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Member voted:</span>
                <Badge 
                  variant="outline" 
                  className={cn("capitalize", positionColors[memberPosition])}
                >
                  {positionLabels[memberPosition] || memberPosition}
                </Badge>
              </div>
            )}

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">
                    {vote.vote_date ? new Date(vote.vote_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Vote className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Chamber</p>
                  <p className="text-sm font-medium capitalize">{vote.chamber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Congress</p>
                  <p className="text-sm font-medium">{vote.congress}th Congress, Session {vote.session}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Roll Call</p>
                  <p className="text-sm font-medium">#{vote.roll_number}</p>
                </div>
              </div>
            </div>

            {/* Result */}
            {vote.result && (
              <div className="p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-1">Result</p>
                <p className="font-semibold text-foreground">{vote.result}</p>
              </div>
            )}

            {/* Vote Totals with Pie Chart */}
            <div>
              <h4 className="font-medium text-foreground mb-3">Vote Breakdown</h4>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Pie Chart */}
                <div className="w-40 h-40 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Yea', value: vote.total_yea || 0, color: 'hsl(var(--score-excellent))' },
                          { name: 'Nay', value: vote.total_nay || 0, color: 'hsl(var(--score-bad))' },
                          { name: 'Present', value: vote.total_present || 0, color: 'hsl(var(--score-average))' },
                          { name: 'Not Voting', value: vote.total_not_voting || 0, color: 'hsl(var(--muted-foreground))' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {[
                          { name: 'Yea', value: vote.total_yea || 0, color: 'hsl(var(--score-excellent))' },
                          { name: 'Nay', value: vote.total_nay || 0, color: 'hsl(var(--score-bad))' },
                          { name: 'Present', value: vote.total_present || 0, color: 'hsl(var(--score-average))' },
                          { name: 'Not Voting', value: vote.total_not_voting || 0, color: 'hsl(var(--muted-foreground))' },
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const percent = totalVotes > 0 ? ((data.value / totalVotes) * 100).toFixed(1) : 0;
                            return (
                              <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                                <p className="font-medium text-foreground">{data.name}</p>
                                <p className="text-sm text-muted-foreground">{data.value} votes ({percent}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Numbers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full">
                  <div className="p-3 rounded-lg bg-score-excellent/10 text-center">
                    <p className="text-xl font-bold text-score-excellent">{vote.total_yea || 0}</p>
                    <p className="text-xs text-muted-foreground">Yea</p>
                    <p className="text-xs font-medium text-score-excellent">{yeaPercent.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-score-bad/10 text-center">
                    <p className="text-xl font-bold text-score-bad">{vote.total_nay || 0}</p>
                    <p className="text-xs text-muted-foreground">Nay</p>
                    <p className="text-xs font-medium text-score-bad">{nayPercent.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-score-average/10 text-center">
                    <p className="text-xl font-bold text-score-average">{vote.total_present || 0}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                    <p className="text-xs font-medium text-score-average">{totalVotes > 0 ? (((vote.total_present || 0) / totalVotes) * 100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <p className="text-xl font-bold text-muted-foreground">{vote.total_not_voting || 0}</p>
                    <p className="text-xs text-muted-foreground">Not Voting</p>
                    <p className="text-xs font-medium text-muted-foreground">{totalVotes > 0 ? (((vote.total_not_voting || 0) / totalVotes) * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Party Breakdown */}
            <PartyVoteBreakdown voteId={vote.id} />

            {/* Related Bill */}
            {vote.bills && (
              <div className="p-4 rounded-lg border border-border">
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Related Bill
                </h4>
                <p className="font-medium text-foreground">
                  {formatBillNumber(vote.bills)} - {vote.bills.short_title || vote.bills.title}
                </p>
                {vote.bills.policy_area && (
                  <Badge variant="secondary" className="mt-2">
                    {vote.bills.policy_area}
                  </Badge>
                )}
                {vote.bills.summary && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                    {vote.bills.summary}
                  </p>
                )}
                <Button variant="civic-ghost" size="sm" className="mt-3" asChild>
                  <Link to={`/bill/${vote.bills.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Bill Details
                  </Link>
                </Button>
              </div>
            )}

            {/* External Link */}
            <div className="pt-2 border-t border-border">
              <Button variant="civic-outline" size="sm" asChild className="w-full">
                <a 
                  href={`https://clerk.house.gov/Votes/${vote.congress}${vote.session}${String(vote.roll_number).padStart(3, '0')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on House Clerk Website
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Vote details not found.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
