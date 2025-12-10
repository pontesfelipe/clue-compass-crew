import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProfileWizard } from "@/features/alignment";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Helmet } from "react-helmet";

export default function MyProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  
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
          
          <ProfileWizard />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
