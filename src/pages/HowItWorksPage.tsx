import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  BarChart3, 
  Calculator, 
  LineChart, 
  Eye,
  ArrowRight,
  CheckCircle,
  Vote,
  Clock,
  Users,
  Target,
  Sparkles,
  Map,
  User,
  TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    number: "01",
    title: "We gather the data",
    icon: Database,
    description: "CivicScore automatically pulls public data from Congress.gov, including:",
    points: [
      "Member profiles",
      "Sponsored bills", 
      "Voting records",
      "Committee assignments",
      "State-level representation"
    ],
    footnote: "This information updates regularly so scores remain fresh.",
    color: "civic-blue"
  },
  {
    number: "02", 
    title: "We analyze every vote",
    icon: Vote,
    description: "Each vote is categorized as Yea, Nay, Present, or Not Voting, and is weighted based on:",
    points: [
      "Recent activity",
      "How often the member participates",
      "Voting consistency",
      "Bipartisan alignment",
      "Issue alignment (economy, health, education, security, etc.)"
    ],
    footnote: "Every action a lawmaker takes contributes to their performance model.",
    color: "civic-gold"
  },
  {
    number: "03",
    title: "We compute the CivicScore",
    icon: Calculator,
    description: "Each member receives a score from 0 to 100, based on three pillars:",
    pillars: [
      { name: "Transparency", desc: "Do they show up and vote?", icon: Eye },
      { name: "Consistency", desc: "Do their actions match their stated positions?", icon: Target },
      { name: "Effectiveness", desc: "Are they sponsoring meaningful legislation that moves?", icon: TrendingUp }
    ],
    footnote: "Scores update automatically as new votes and bills appear.",
    color: "score-excellent"
  },
  {
    number: "04",
    title: "We visualize performance", 
    icon: LineChart,
    description: "CivicScore transforms raw congressional activity into a clear picture you can understand at a glance:",
    visuals: [
      { name: "US Map", desc: "highlighting average score per state", icon: Map },
      { name: "State view", desc: "showing all senators and representatives", icon: Users },
      { name: "Member page", desc: "with detailed breakdowns, trends, and recent activity", icon: User }
    ],
    footnote: "Everything is interactive, clean, and easy to explore.",
    color: "civic-blue"
  },
  {
    number: "05",
    title: "You get clarity, not noise",
    icon: Sparkles,
    description: "The goal isn't to push an agenda — it's to give citizens a transparent, data-driven way to understand how their elected officials are performing.",
    highlight: "No opinions. No commentary. Just structured public data presented clearly.",
    color: "civic-gold"
  }
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
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
              <BarChart3 className="h-4 w-4" />
              Our Methodology
            </div>
            
            <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
              How <span className="civic-gradient-text">CivicScore</span> Works
            </h1>
            
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              From raw congressional data to actionable insights — here's exactly how we 
              calculate transparent, unbiased scores for every member of Congress.
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
                  
                  {step.pillars && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      {step.pillars.map((pillar, i) => (
                        <div key={i} className="p-4 rounded-xl border border-border bg-card">
                          <pillar.icon className="h-5 w-5 text-primary mb-2" />
                          <h4 className="font-semibold text-foreground mb-1">{pillar.name}</h4>
                          <p className="text-sm text-muted-foreground">{pillar.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {step.visuals && (
                    <div className="space-y-3">
                      {step.visuals.map((visual, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <visual.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">{visual.name}</span>
                            <span className="text-muted-foreground"> — {visual.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {step.highlight && (
                    <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-lg font-medium text-foreground italic">
                        "{step.highlight}"
                      </p>
                    </div>
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
              Start exploring congressional performance data now. 
              No account required — just data, transparency, and clarity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/map">
                  Explore the Map
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
