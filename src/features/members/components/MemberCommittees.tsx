import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Crown, Award } from "lucide-react";

interface Committee {
  id: string;
  committeeName: string;
  committeeCode: string;
  chamber: string;
  rank: number;
  isChair: boolean;
  isRankingMember: boolean;
}

interface MemberCommitteesProps {
  memberId: string;
}

export function MemberCommittees({ memberId }: MemberCommitteesProps) {
  const { data: committees, isLoading } = useQuery({
    queryKey: ["member-committees", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_committees")
        .select("*")
        .eq("member_id", memberId)
        .order("rank", { ascending: true });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        id: c.id,
        committeeName: c.committee_name,
        committeeCode: c.committee_code,
        chamber: c.chamber,
        rank: c.rank,
        isChair: c.is_chair,
        isRankingMember: c.is_ranking_member,
      })) as Committee[];
    },
    enabled: !!memberId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Committee Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!committees || committees.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Committee Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No committee data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Committee Assignments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {committees.map((committee, index) => (
            <div
              key={committee.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {committee.committeeName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {committee.chamber === 'house' ? 'House' : 'Senate'} Committee
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {committee.isChair && (
                  <Badge className="bg-civic-gold/10 text-civic-gold border-civic-gold/30">
                    <Crown className="h-3 w-3 mr-1" />
                    Chair
                  </Badge>
                )}
                {committee.isRankingMember && (
                  <Badge className="bg-civic-blue/10 text-civic-blue border-civic-blue/30">
                    <Award className="h-3 w-3 mr-1" />
                    Ranking
                  </Badge>
                )}
                {!committee.isChair && !committee.isRankingMember && (
                  <Badge variant="secondary">Member</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
