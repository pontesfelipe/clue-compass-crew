import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { ComparisonProvider } from "@/contexts/ComparisonContext";
import { ComparisonBar } from "@/components/ComparisonBar";
import { BottomNav } from "@/components/BottomNav";
import Index from "./pages/Index";
import MapPage from "./pages/MapPage";
import StatePage from "./pages/StatePage";
import MembersPage from "./pages/MembersPage";
import MemberPage from "./pages/MemberPage";
import BillPage from "./pages/BillPage";
import BillsPage from "./pages/BillsPage";
import VotesPage from "./pages/VotesPage";
import ComparePage from "./pages/ComparePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import MethodologyPage from "./pages/MethodologyPage";
import DataSourcesPage from "./pages/DataSourcesPage";
import FAQPage from "./pages/FAQPage";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import AdminDataInspectorPage from "./pages/AdminDataInspectorPage";
import MyProfilePage from "./pages/MyProfilePage";
import MyMatchesPage from "./pages/MyMatchesPage";
import TrackedMembersPage from "./pages/TrackedMembersPage";
import TrackedBillsPage from "./pages/TrackedBillsPage";
import CongressNewsPage from "./pages/CongressNewsPage";
import GovernorsPage from "./pages/GovernorsPage";
import GovernorPage from "./pages/GovernorPage";
import NotFound from "./pages/NotFound";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";

const queryClient = new QueryClient();

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
