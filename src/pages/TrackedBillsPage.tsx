import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useBillTracking } from "@/hooks/useBillTracking";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Helmet } from "react-helmet";
import { 
  ArrowLeft, 
  FileText, 
  Bookmark,
  BookmarkX,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { formatBillNumber } from "@/hooks/useBill";

function getBillStatus(bill: any): { label: string; variant: "success" | "warning" | "default" } {
  if (bill.enacted) return { label: "Enacted", variant: "success" };
  if (bill.latest_action_text?.toLowerCase().includes("passed")) return { label: "Passed", variant: "success" };
  if (bill.latest_action_text?.toLowerCase().includes("committee")) return { label: "In Committee", variant: "warning" };
  return { label: "Introduced", variant: "default" };
}

export default function TrackedBillsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { trackedBills, isLoading: trackingLoading, untrackBill, isTrackingPending } = useBillTracking();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth?redirect=/tracked-bills");
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
        <title>Tracked Bills | CivicScore</title>
        <meta
          name="description"
          content="View and manage the bills you're tracking. Stay updated on legislative progress and votes."
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
              Tracked Bills
            </h1>
            <p className="text-muted-foreground mt-2">
              {trackedBills.length === 0
                ? "Start tracking bills to monitor their progress"
                : `Tracking ${trackedBills.length} bill${trackedBills.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          
          <Button variant="civic" asChild>
            <Link to="/bills">
              <FileText className="mr-2 h-4 w-4" />
              Browse Bills
            </Link>
          </Button>
        </div>

        {/* Bills Grid */}
        {trackedBills.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">No tracked bills yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Browse legislation and click "Track Bill" to stay updated on their progress.
              </p>
              <Button variant="civic" asChild>
                <Link to="/bills">Browse Bills</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trackedBills.map((tracked) => {
              const bill = tracked.bills as any;
              if (!bill) return null;
              
              const status = getBillStatus(bill);
              const billNumber = formatBillNumber(bill);
              
              return (
                <Card key={tracked.id} className="group hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {billNumber}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            status.variant === "success" 
                              ? "bg-score-excellent/10 text-score-excellent border-score-excellent/30"
                              : status.variant === "warning"
                              ? "bg-score-average/10 text-score-average border-score-average/30"
                              : ""
                          }`}
                        >
                          {status.label}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => untrackBill(bill.id)}
                        disabled={isTrackingPending}
                      >
                        <BookmarkX className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Link 
                      to={`/bills/${bill.id}`}
                      className="block group-hover:text-primary transition-colors"
                    >
                      <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
                        {bill.short_title || bill.title}
                      </h3>
                    </Link>
                    
                    {bill.policy_area && (
                      <Badge variant="outline" className="text-xs mb-3">
                        {bill.policy_area}
                      </Badge>
                    )}
                    
                    {bill.latest_action_date && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Last action: {new Date(bill.latest_action_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
