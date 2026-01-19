import { useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { ComparisonProvider } from "@/contexts/ComparisonContext";
import { ComparisonBar } from "@/components/ComparisonBar";
import { BottomNav } from "@/components/BottomNav";

// Lazy load all page components for code splitting
const Index = lazy(() => import("./pages/Index"));
const MapPage = lazy(() => import("./pages/MapPage"));
const StatePage = lazy(() => import("./pages/StatePage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const MemberPage = lazy(() => import("./pages/MemberPage"));
const BillPage = lazy(() => import("./pages/BillPage"));
const BillsPage = lazy(() => import("./pages/BillsPage"));
const VotesPage = lazy(() => import("./pages/VotesPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage"));
const MethodologyPage = lazy(() => import("./pages/MethodologyPage"));
const DataSourcesPage = lazy(() => import("./pages/DataSourcesPage"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminDataInspectorPage = lazy(() => import("./pages/AdminDataInspectorPage"));
const AdminFECCompletenessPage = lazy(() => import("./pages/AdminFECCompletenessPage"));
const MyProfilePage = lazy(() => import("./pages/MyProfilePage"));
const MyMatchesPage = lazy(() => import("./pages/MyMatchesPage"));
const TrackedMembersPage = lazy(() => import("./pages/TrackedMembersPage"));
const TrackedBillsPage = lazy(() => import("./pages/TrackedBillsPage"));
const CongressNewsPage = lazy(() => import("./pages/CongressNewsPage"));
const GovernorsPage = lazy(() => import("./pages/GovernorsPage"));
const GovernorPage = lazy(() => import("./pages/GovernorPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));

const queryClient = new QueryClient();

// Minimal loading fallback that doesn't affect UX
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ComparisonProvider>
          {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <div className="pb-16 lg:pb-0"> {/* Bottom padding for mobile nav */}
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/votes" element={<VotesPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/news" element={<CongressNewsPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/data-sources" element={<DataSourcesPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/data-inspector" element={<AdminDataInspectorPage />} />
            <Route path="/admin/fec-completeness" element={<AdminFECCompletenessPage />} />
            <Route path="/my-profile" element={<MyProfilePage />} />
            <Route path="/my-matches" element={<MyMatchesPage />} />
            <Route path="/tracked-members" element={<TrackedMembersPage />} />
            <Route path="/tracked-bills" element={<TrackedBillsPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/governors" element={<GovernorsPage />} />
            <Route path="/governors/:id" element={<GovernorPage />} />
            <Route path="/state/:stateAbbr" element={<StatePage />} />
            <Route path="/member/:memberId" element={<MemberPage />} />
            <Route path="/bill/:billId" element={<BillPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <ComparisonBar />
          <BottomNav />
          </div>
        </BrowserRouter>
      </ComparisonProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
