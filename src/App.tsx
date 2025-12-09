import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ComparisonProvider } from "@/contexts/ComparisonContext";
import { ComparisonBar } from "@/components/ComparisonBar";
import Index from "./pages/Index";
import MapPage from "./pages/MapPage";
import StatePage from "./pages/StatePage";
import MemberPage from "./pages/MemberPage";
import BillPage from "./pages/BillPage";
import BillsPage from "./pages/BillsPage";
import VotesPage from "./pages/VotesPage";
import ComparePage from "./pages/ComparePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import TermsPage from "./pages/TermsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ComparisonProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/votes" element={<VotesPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/methodology" element={<HowItWorksPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/state/:stateAbbr" element={<StatePage />} />
            <Route path="/member/:memberId" element={<MemberPage />} />
            <Route path="/bill/:billId" element={<BillPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ComparisonBar />
        </BrowserRouter>
      </ComparisonProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
