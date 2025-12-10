import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProfileWizard } from "@/features/alignment";
import { useAuth } from "@/hooks/useAuth";
import { useMemberTracking } from "@/hooks/useMemberTracking";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet";
import { Bookmark, Heart, ChevronRight } from "lucide-react";

export default function MyProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const { trackedMembers } = useMemberTracking();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth?redirect=/my-profile");
    }
  }, [isAuthenticated, isLoading, navigate]);
  
  if (isLoading) {
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
    return null; // Will redirect
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>My Profile | CivicScore</title>
        <meta 
          name="description" 
          content="Build your profile to see how your views align with members of Congress. Answer questions about issues that matter to you."
        />
      </Helmet>
      
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
              My Profile
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Tell us about your views to see personalized alignment scores.
            </p>
          </div>
          
          {/* Quick Links */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Button variant="civic-outline" size="sm" asChild>
              <Link to="/my-matches">
                <Heart className="mr-2 h-4 w-4" />
                My Matches
              </Link>
            </Button>
            <Button variant="civic-outline" size="sm" asChild>
              <Link to="/tracked-members">
                <Bookmark className="mr-2 h-4 w-4" />
                Tracked Members
                {trackedMembers.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {trackedMembers.length}
                  </span>
                )}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <ProfileWizard />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
