import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MemberCard } from "@/components/MemberCard";
import { ScoreRing } from "@/components/ScoreRing";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  Vote, 
  Scale,
  MapPin
} from "lucide-react";

// Mock data - would be fetched from API
const stateData: { [key: string]: { name: string; score: number } } = {
  CA: { name: "California", score: 74 },
  TX: { name: "Texas", score: 58 },
  NY: { name: "New York", score: 72 },
  FL: { name: "Florida", score: 61 },
  // Add more as needed
};

const mockMembers = [
  { id: "1", name: "John Smith", party: "D" as const, state: "CA", chamber: "Senate" as const, score: 82 },
  { id: "2", name: "Jane Doe", party: "D" as const, state: "CA", chamber: "Senate" as const, score: 78 },
  { id: "3", name: "Robert Johnson", party: "R" as const, state: "CA", chamber: "House" as const, score: 71 },
  { id: "4", name: "Maria Garcia", party: "D" as const, state: "CA", chamber: "House" as const, score: 85 },
  { id: "5", name: "Michael Brown", party: "R" as const, state: "CA", chamber: "House" as const, score: 65 },
  { id: "6", name: "Sarah Wilson", party: "D" as const, state: "CA", chamber: "House" as const, score: 79 },
];

export default function StatePage() {
  const { stateAbbr } = useParams<{ stateAbbr: string }>();
  const state = stateData[stateAbbr?.toUpperCase() || ""] || { name: stateAbbr, score: 65 };

  const senators = mockMembers.filter(m => m.chamber === "Senate");
  const representatives = mockMembers.filter(m => m.chamber === "House");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="civic-container py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
            <Link to="/map">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Map
            </Link>
          </Button>
        </div>

        {/* State Header */}
        <div className="flex flex-col lg:flex-row gap-8 items-start mb-12">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="outline" className="text-sm">
                <MapPin className="mr-1 h-3 w-3" />
                {stateAbbr?.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                118th Congress
              </Badge>
            </div>
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              {state.name}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              View the performance scores for all congressional representatives from {state.name}. 
              Scores are calculated based on productivity, attendance, and bipartisanship.
            </p>
          </div>
          
          <div className="flex flex-col items-center bg-card rounded-2xl border border-border p-8 shadow-civic-md">
            <p className="text-sm font-medium text-muted-foreground mb-2">State Average</p>
            <ScoreRing score={state.score} size="xl" />
            <p className="text-sm text-muted-foreground mt-4">
              Based on {mockMembers.length} members
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          <StatsCard
            icon={Users}
            value={mockMembers.length}
            label="Total Members"
          />
          <StatsCard
            icon={FileText}
            value="287"
            label="Bills Sponsored"
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            icon={Vote}
            value="92.4%"
            label="Avg. Attendance"
          />
          <StatsCard
            icon={Scale}
            value="34%"
            label="Bipartisan Rate"
            trend={{ value: 5.2, isPositive: true }}
          />
        </div>

        {/* Senators Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Senators
            </h2>
            <Badge variant="secondary">{senators.length} members</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {senators.map((member, index) => (
              <div
                key={member.id}
                className="opacity-0 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
              >
                <MemberCard {...member} />
              </div>
            ))}
          </div>
        </section>

        {/* Representatives Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Representatives
            </h2>
            <Badge variant="secondary">{representatives.length} members</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {representatives.map((member, index) => (
              <div
                key={member.id}
                className="opacity-0 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
              >
                <MemberCard {...member} />
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
