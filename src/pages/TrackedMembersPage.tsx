import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useMemberTracking } from "@/hooks/useMemberTracking";
import { NotificationSettingsDialog } from "@/components/NotificationSettingsDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet";
import { 
  ArrowLeft, 
  Bell, 
  BellOff, 
  Bookmark, 
  Users, 
  ExternalLink,
  Settings,
  Mail,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

type Party = "D" | "R" | "I";

const partyColors: Record<Party, string> = {
  D: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  R: "bg-civic-red/10 text-civic-red border-civic-red/30",
  I: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
};

const partyNames: Record<Party, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

export default function TrackedMembersPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { trackedMembers, isLoading: trackingLoading, untrackMember, isTrackingPending } = useMemberTracking();

  // Fetch sent notifications
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ["sent-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sent_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth?redirect=/tracked-members");
    }
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading || trackingLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="civic-container py-8 lg:py-12">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Tracked Members | CivicScore</title>
        <meta
          name="description"
          content="View and manage the members of Congress you're tracking. Receive notifications about their votes, bills, and score changes."
        />
      </Helmet>

      <Header />

      <main className="civic-container py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
            <Link to="/my-profile">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Profile
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
              Tracked Members
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              {trackedMembers.length === 0
                ? "You're not tracking any members yet."
                : `You're tracking ${trackedMembers.length} member${trackedMembers.length === 1 ? "" : "s"}.`}
            </p>
          </div>

          <NotificationSettingsDialog
            trigger={
              <Button variant="civic-outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Notification Settings
              </Button>
            }
          />
        </div>

        {/* Empty State */}
        {trackedMembers.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Bookmark className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
                No tracked members
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Start tracking members of Congress to receive notifications about their votes, 
                bill sponsorships, and score changes.
              </p>
              <Button variant="civic" asChild>
                <Link to="/map">
                  <Users className="mr-2 h-4 w-4" />
                  Explore Members
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tracked Members Grid */}
        {trackedMembers.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trackedMembers.map((tracking) => {
              const member = tracking.members as any;
              if (!member) return null;

              const party = member.party as Party;

              return (
                <Card key={tracking.id} className="group hover:shadow-civic-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Photo */}
                      <Link to={`/member/${member.id}`} className="flex-shrink-0">
                        {member.image_url ? (
                          <img
                            src={member.image_url}
                            alt={member.full_name}
                            className="h-16 w-16 rounded-xl object-cover border border-border"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted border border-border">
                            <span className="text-lg font-semibold text-muted-foreground font-serif">
                              {member.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </span>
                          </div>
                        )}
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <Link 
                          to={`/member/${member.id}`}
                          className="font-serif font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {member.full_name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", partyColors[party])}
                          >
                            {partyNames[party]}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {member.chamber === "senate" ? "Senate" : "House"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {member.state}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <Link to={`/member/${member.id}`}>
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          View Profile
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => untrackMember(member.id)}
                        disabled={isTrackingPending}
                      >
                        <BellOff className="mr-2 h-3.5 w-3.5" />
                        Untrack
                      </Button>
                    </div>

                    {/* Tracking since */}
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Tracking since {new Date(tracking.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Recent Notifications */}
        {notifications && notifications.length > 0 && (
          <div className="mt-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5 text-primary" />
                  Recent Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          {notif.notification_type === "weekly_digest" ? (
                            <Mail className="h-4 w-4 text-primary" />
                          ) : (
                            <Bell className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {notif.notification_type === "weekly_digest"
                              ? "Weekly Digest"
                              : notif.notification_type === "vote"
                              ? "Vote Notification"
                              : notif.notification_type === "bill"
                              ? "Bill Notification"
                              : "Score Change"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notif.reference_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(notif.sent_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                How notifications work
              </h3>
              <p className="text-sm text-muted-foreground">
                When tracked members cast votes, sponsor bills, or have significant score changes, 
                you'll receive email notifications based on your preferences. Weekly digests are sent 
                every Monday with a summary of your tracked members' activity. Customize what you 
                receive using the Notification Settings button above.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
