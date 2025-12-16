import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { GitCompare, Users, Building } from "lucide-react";

interface MemberVotingComparisonProps {
  memberId: string;
  party: "D" | "R" | "I" | "L";
  state: string;
}

export function MemberVotingComparison({ memberId, party, state }: MemberVotingComparisonProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["voting-comparison", memberId],
    queryFn: async () => {
      // Get this member's votes - sample 100 most recent for performance
      const { data: memberVotes, error: memberError, count: totalVoteCount } = await supabase
        .from("member_votes")
        .select("vote_id, position", { count: "exact" })
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (memberError) throw memberError;

      if (!memberVotes || memberVotes.length === 0) {
        return {
          partyAlignment: null,
          stateAlignment: null,
          totalVotes: 0,
          sampledVotes: 0,
        };
      }

      const voteIds = memberVotes.map(v => v.vote_id);
      const memberVoteMap = new Map(memberVotes.map(v => [v.vote_id, v.position]));

      // Get party members for comparison (limit to 30 for reasonable query size)
      const { data: partyMembers, error: partyError } = await supabase
        .from("members")
        .select("id")
        .eq("party", party)
        .eq("in_office", true)
        .neq("id", memberId)
        .limit(30);

      if (partyError) throw partyError;

      // Get state members for comparison
      const { data: stateMembers, error: stateError } = await supabase
        .from("members")
        .select("id")
        .eq("state", state)
        .eq("in_office", true)
        .neq("id", memberId);

      if (stateError) throw stateError;

      // Calculate party alignment - batch vote IDs to avoid large IN clause issues
      let partyMatches = 0;
      let partyTotal = 0;

      if (partyMembers && partyMembers.length > 0) {
        const partyMemberIds = partyMembers.map(m => m.id);
        
        // Process in batches of 25 vote IDs to stay well under limits
        const batchSize = 25;
        for (let i = 0; i < voteIds.length; i += batchSize) {
          const batchVoteIds = voteIds.slice(i, i + batchSize);
          
          const { data: partyVotes, error: pvError } = await supabase
            .from("member_votes")
            .select("member_id, vote_id, position")
            .in("vote_id", batchVoteIds)
            .in("member_id", partyMemberIds);

          if (pvError) {
            console.error("Party votes query error:", pvError);
            continue;
          }

          if (partyVotes) {
            // Group by vote_id to find majority party position
            const votePositions = new Map<string, Map<string, number>>();
            
            for (const vote of partyVotes) {
              if (!votePositions.has(vote.vote_id)) {
                votePositions.set(vote.vote_id, new Map());
              }
              const positionCounts = votePositions.get(vote.vote_id)!;
              positionCounts.set(vote.position, (positionCounts.get(vote.position) || 0) + 1);
            }

            // Compare member's votes to party majority
            for (const [voteId, positions] of votePositions) {
              const memberPosition = memberVoteMap.get(voteId);
              if (!memberPosition || memberPosition === "not_voting") continue;

              let majorityPosition = '';
              let maxCount = 0;
              for (const [pos, count] of positions) {
                if (pos !== "not_voting" && count > maxCount) {
                  maxCount = count;
                  majorityPosition = pos;
                }
              }

              if (majorityPosition) {
                partyTotal++;
                if (memberPosition === majorityPosition) {
                  partyMatches++;
                }
              }
            }
          }
        }
      }

      // Calculate state alignment similarly - batch processing
      let stateMatches = 0;
      let stateTotal = 0;

      if (stateMembers && stateMembers.length > 0) {
        const stateMemberIds = stateMembers.map(m => m.id);
        
        const batchSize = 25;
        for (let i = 0; i < voteIds.length; i += batchSize) {
          const batchVoteIds = voteIds.slice(i, i + batchSize);
          
          const { data: stateVotes, error: svError } = await supabase
            .from("member_votes")
            .select("member_id, vote_id, position")
            .in("vote_id", batchVoteIds)
            .in("member_id", stateMemberIds);

          if (svError) {
            console.error("State votes query error:", svError);
            continue;
          }

          if (stateVotes) {
            const votePositions = new Map<string, Map<string, number>>();
            
            for (const vote of stateVotes) {
              if (!votePositions.has(vote.vote_id)) {
                votePositions.set(vote.vote_id, new Map());
              }
              const positionCounts = votePositions.get(vote.vote_id)!;
              positionCounts.set(vote.position, (positionCounts.get(vote.position) || 0) + 1);
            }

            for (const [voteId, positions] of votePositions) {
              const memberPosition = memberVoteMap.get(voteId);
              if (!memberPosition || memberPosition === "not_voting") continue;

              let majorityPosition = '';
              let maxCount = 0;
              for (const [pos, count] of positions) {
                if (pos !== "not_voting" && count > maxCount) {
                  maxCount = count;
                  majorityPosition = pos;
                }
              }

              if (majorityPosition) {
                stateTotal++;
                if (memberPosition === majorityPosition) {
                  stateMatches++;
                }
              }
            }
          }
        }
      }

      return {
        partyAlignment: partyTotal > 0 ? Math.round((partyMatches / partyTotal) * 100) : null,
        stateAlignment: stateTotal > 0 ? Math.round((stateMatches / stateTotal) * 100) : null,
        totalVotes: totalVoteCount || memberVotes.length,
        sampledVotes: memberVotes.length,
      };
    },
    enabled: !!memberId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Voting Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalVotes === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Voting Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Not enough voting data for comparison.
          </p>
        </CardContent>
      </Card>
    );
  }

  const partyName = party === 'D' ? 'Democratic' : party === 'R' ? 'Republican' : 'Independent';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          Voting Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.partyAlignment !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Party Alignment</span>
              </div>
              <span className="text-sm font-bold">{data.partyAlignment}%</span>
            </div>
            <Progress value={data.partyAlignment} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Votes with {partyName} Party majority
            </p>
          </div>
        )}

        {data.stateAlignment !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">State Delegation Alignment</span>
              </div>
              <span className="text-sm font-bold">{data.stateAlignment}%</span>
            </div>
            <Progress value={data.stateAlignment} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Votes with state delegation majority
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center pt-2">
          Based on {data.sampledVotes === data.totalVotes 
            ? `${data.totalVotes} recorded votes` 
            : `${data.sampledVotes} of ${data.totalVotes} recent votes`}
        </p>
      </CardContent>
    </Card>
  );
}
