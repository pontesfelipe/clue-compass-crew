import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  BarChart3, 
  Target, 
  ArrowRight,
  CheckCircle,
  Shield,
  Clock,
  FileText,
  Scale
} from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";

const steps = [
  {
    number: "01",
    title: "We collect public data",
    icon: Database,
    description: "CivicScore gathers data from official government sources:",
    points: [
      "Votes, bills, and sponsorships from Congress.gov",
      "Campaign finance data from the Federal Election Commission",
      "Roll call votes from the House Clerk and Senate.gov"
    ],
    footnote: "All sources are official, public, and verifiable.",
    color: "civic-blue"
  },
  {
    number: "02", 
    title: "We turn data into signals",
    icon: BarChart3,
    description: "Not raw spreadsheets — structured indicators of behavior over time:",
    points: [
      "Voting patterns (Yea / Nay / Present / Missed)",
      "Legislative activity and sponsorships",
      "Cross-party collaboration patterns",
      "Campaign funding sources and timing"
    ],
    footnote: "Every action is processed consistently without ideological interpretation.",
    color: "civic-gold"
  },
  {
    number: "03",
    title: "You define what matters to you",
    icon: Target,
    description: "We compare actions to your priorities and show alignment — not ideology:",
    points: [
      "Select issues that are important to you",
      "Set your own priority weights",
      "See how actions align with your choices",
      "Explore alignment across any representative"
    ],
    footnote: "Missing data is shown explicitly and does not penalize scores.",
    color: "score-excellent"
  }
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>How It Works - CivicScore</title>
        <meta name="description" content="Learn how CivicScore turns public data into neutral, understandable insights about congressional actions." />
      </Helmet>
      
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ 
            backgroundImage: `radial-gradient(circle at 30% 30%, hsl(var(--civic-gold)) 0%, transparent 50%), 
                              radial-gradient(circle at 70% 70%, hsl(var(--civic-blue)) 0%, transparent 50%)` 
          }} />
        </div>
        
        <div className="civic-container relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Shield className="h-4 w-4" />
              Neutral Methodology
            </div>
            
            <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
              How <span className="civic-gradient-text">CivicScore</span> Works
            </h1>
            
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              From public data to clear insights — here's exactly how we turn official records 
              into neutral, understandable information without adding opinions or ideology.
            </p>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-12 lg:py-20">
        <div className="civic-container">
          <div className="space-y-24">
            {steps.map((step, index) => (
              <div 
                key={step.number}
                className={`grid gap-8 lg:gap-16 items-center ${
                  index % 2 === 1 ? 'lg:grid-cols-[1fr,1.2fr]' : 'lg:grid-cols-[1.2fr,1fr]'
                }`}
              >
                {/* Content */}
                <div className={`space-y-6 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-5xl font-bold text-muted-foreground/20">
                      {step.number}
                    </span>
                    <div className={`p-3 rounded-xl bg-${step.color}/10`}>
                      <step.icon className={`h-6 w-6 text-${step.color}`} />
                    </div>
                  </div>
                  
                  <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
                    {step.title}
                  </h2>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                  
                  {step.points && (
                    <ul className="space-y-3">
                      {step.points.map((point, i) => (
                        <li key={i} className="flex items-center gap-3 text-foreground">
                          <CheckCircle className="h-5 w-5 text-score-excellent shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {step.footnote && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {step.footnote}
                    </p>
                  )}
                </div>
                
                {/* Visual */}
                <div className={`relative ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5 blur-2xl" />
                  <div className="relative aspect-square rounded-2xl border border-border bg-card p-8 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-5">
                      <div 
                        className="absolute inset-0" 
                        style={{ 
                          backgroundImage: `radial-gradient(circle at 50% 50%, hsl(var(--${step.color})) 0%, transparent 70%)` 
                        }} 
                      />
                    </div>
                    <step.icon className="h-32 w-32 text-primary/20" strokeWidth={1} />
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-card to-transparent" />
                    <div className="absolute bottom-8 left-8 right-8">
                      <div className="p-4 rounded-xl bg-background/80 backdrop-blur border border-border">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-primary/10`}>
                            <step.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{step.title}</p>
                            <p className="text-xs text-muted-foreground">Step {step.number}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Neutrality Commitment Section */}
      <section className="py-16 lg:py-20 bg-muted/30">
        <div className="civic-container">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Our Commitment to Neutrality</h2>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                CivicScore exists to give people clarity about what is happening in politics 
                without telling them what to think or how to vote.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-2">This is NOT:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• A partisan product</li>
                    <li>• An opinion engine</li>
                    <li>• A recommendation system</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-2">This IS:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• A neutral civic analytics tool</li>
                    <li>• An action-and-data alignment engine</li>
                    <li>• An explainer for non-experts</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 30% 30%, hsl(var(--civic-gold) / 0.3) 0%, transparent 40%)`
          }} />
        </div>
        
        <div className="civic-container relative">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-serif text-3xl font-bold text-primary-foreground sm:text-4xl lg:text-5xl mb-6">
              Ready to explore?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">
              Start exploring congressional data now. 
              No account required — just data, transparency, and clarity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/map">
                  See How Your State Performs
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="xl" 
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                asChild
              >
                <Link to="/bills">
                  Browse Bills
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
