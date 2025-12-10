import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Vote, FileText, Clock, TrendingUp } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface TrackedMemberActivityProps {
  trackedMemberIds: string[];
}

export function TrackedMemberActivity({ trackedMemberIds }: TrackedMemberActivityProps) {
  // Fetch recent votes for tracked members
  const { data: recentVotes, isLoading: votesLoading } = useQuery({
    queryKey: ["tracked-member-votes", trackedMemberIds],
    queryFn: async () => {
      if (trackedMemberIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("member_votes")
        .select(`
          id,
          position,
          created_at,
          member_id,
          members (
            id,
            full_name,
            party,
            image_url
          ),
          votes (
            id,
            question,
            description,
            vote_date,
            result,
            chamber
          )
        `)
        .in("member_id", trackedMemberIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: trackedMemberIds.length > 0,
  });

  // Fetch recent bill sponsorships for tracked members
  const { data: recentBills, isLoading: billsLoading } = useQuery({
    queryKey: ["tracked-member-bills", trackedMemberIds],
    queryFn: async () => {
      if (trackedMemberIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("bill_sponsorships")
        .select(`
          id,
          is_sponsor,
          created_at,
          cosponsored_date,
          member_id,
          members (
            id,
            full_name,
            party,
            image_url
          ),
          bills (
            id,
            title,
            short_title,
            bill_type,
            bill_number,
            congress,
            introduced_date,
            policy_area
          )
        `)
        .in("member_id", trackedMemberIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: trackedMemberIds.length > 0,
  });

  const isLoading = votesLoading || billsLoading;

  if (trackedMemberIds.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Combine and sort activities by date
  const activities = [
    ...(recentVotes || []).map((vote: any) => ({
      type: "vote" as const,
      date: vote.votes?.vote_date || vote.created_at,
      data: vote,
    })),
    ...(recentBills || []).map((bill: any) => ({
      type: "bill" as const,
      date: bill.cosponsored_date || bill.bills?.introduced_date || bill.created_at,
      data: bill,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);

  if (activities.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity from your tracked members.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <ActivityItem key={`${activity.type}-${index}`} activity={activity} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ activity }: { activity: { type: "vote" | "bill"; date: string; data: any } }) {
  const { type, date, data } = activity;

  if (type === "vote") {
    const member = data.members;
    const vote = data.votes;
    if (!member || !vote) return null;

    const positionColors: Record<string, string> = {
      yea: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      nay: "bg-red-500/10 text-red-600 border-red-500/30",
      present: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      not_voting: "bg-muted text-muted-foreground border-border",
    };

    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
        <div className="rounded-full bg-civic-blue/10 p-2 flex-shrink-0">
          <Vote className="h-4 w-4 text-civic-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link 
              to={`/member/${member.id}`}
              className="font-medium text-sm hover:text-primary transition-colors"
            >
              {member.full_name}
            </Link>
            <span className="text-sm text-muted-foreground">voted</span>
            <Badge variant="outline" className={positionColors[data.position] || ""}>
              {data.position?.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {vote.question || vote.description || "Vote"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {vote.chamber === "senate" ? "Senate" : "House"}
            </Badge>
            {vote.result && (
              <Badge 
                variant="outline" 
                className={vote.result.toLowerCase().includes("passed") 
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                  : "bg-red-500/10 text-red-600 border-red-500/30"}
              >
                {vote.result}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(date), { addSuffix: true })}
        </div>
      </div>
    );
  }

  if (type === "bill") {
    const member = data.members;
    const bill = data.bills;
    if (!member || !bill) return null;

    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
        <div className="rounded-full bg-civic-gold/10 p-2 flex-shrink-0">
          <FileText className="h-4 w-4 text-civic-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link 
              to={`/member/${member.id}`}
              className="font-medium text-sm hover:text-primary transition-colors"
            >
              {member.full_name}
            </Link>
            <span className="text-sm text-muted-foreground">
              {data.is_sponsor ? "sponsored" : "cosponsored"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {bill.short_title || bill.title}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="text-xs uppercase">
              {bill.bill_type}{bill.bill_number}
            </Badge>
            {bill.policy_area && (
              <Badge variant="outline" className="text-xs">
                {bill.policy_area}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(date), { addSuffix: true })}
        </div>
      </div>
    );
  }

  return null;
}
