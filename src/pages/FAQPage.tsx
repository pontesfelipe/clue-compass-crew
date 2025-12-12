import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Helmet } from "react-helmet";

export default function FAQPage() {
  const faqs = [
    {
      question: "Is this partisan?",
      answer: "No. The system does not use party affiliation or ideology in scoring. We present official public data on actions — not opinions, labels, or endorsements."
    },
    {
      question: "Does this tell me how to vote?",
      answer: "No. CivicScore shows how actions align with priorities you choose. We don't make recommendations or express opinions on candidates."
    },
    {
      question: "Where does the data come from?",
      answer: "All data comes from official public sources: Congress.gov for legislative activity and voting records, the Federal Election Commission (FEC) for campaign finance data, and the House Clerk and Senate.gov for detailed roll call votes."
    },
    {
      question: "What if data is missing?",
      answer: "Missing data is shown explicitly and does not penalize scores. When data is incomplete, we display this transparently so you know exactly what information is available."
    },
    {
      question: "What is CivicScore?",
      answer: "CivicScore is a neutral civic analytics tool that turns public data on votes, money, and behavior into clear insights. We help you understand what is happening in politics without telling you what to think."
    },
    {
      question: "How are alignment scores calculated?",
      answer: "Alignment scores measure the distance between your selected priorities and a politician's actions (votes, sponsorships, etc.). The system uses normalized, symmetric distance metrics applied equally to all members regardless of party."
    },
    {
      question: "What inputs are used for scoring?",
      answer: "We use: voting records (Yea/Nay/Present/Missed), bill sponsorships and co-sponsorships, committee memberships, campaign finance data from the FEC, and timing of actions. We do NOT use party affiliation, caucus membership, ideological labels, statements, or media classifications."
    },
    {
      question: "How often is the data updated?",
      answer: "We update our data automatically on a scheduled basis: voting records every 2 hours, bills every 6 hours, member information daily, and campaign finance data nightly. Update timestamps are displayed throughout the platform."
    },
    {
      question: "Can I customize my scoring preferences?",
      answer: "Yes. Authenticated users can select priority issues and set importance weights. The system then compares politician actions to your priorities — showing alignment based on what matters to you."
    },
    {
      question: "How do I find my representatives?",
      answer: "Use the interactive map on our homepage to explore representatives by state. You can also browse all members on the Members page or use search to find specific members by name, state, or district."
    },
    {
      question: "Is CivicScore free to use?",
      answer: "Yes. CivicScore is free to use. Creating an account unlocks additional features like priority-based alignment scores and the ability to track representatives over time."
    },
    {
      question: "How do you handle campaign finance data?",
      answer: "We display campaign finance data from the FEC, including individual contributions, PAC donations, and funding sources. This data is presented factually without interpretation or judgment about its meaning."
    },
    {
      question: "Why is a representative's score different from what I expected?",
      answer: "Our scores are based on objective data metrics applied consistently to all members. Scores may differ from public perception or media narratives. We encourage you to explore the detailed breakdown to understand how any score was calculated."
    },
    {
      question: "What language does CivicScore use?",
      answer: "We always use neutral language: 'higher or lower alignment', 'based on selected priorities', 'according to available public data'. We never say 'good/bad politician', 'supports/opposes you', or use ideological labels like 'liberal/conservative'."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>FAQ - CivicScore</title>
        <meta name="description" content="Frequently asked questions about CivicScore, our neutral methodology, data sources, and how to use the platform." />
      </Helmet>
      
      <Header />
      
      <main className="civic-container py-12 lg:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-muted-foreground">
              Find answers to common questions about CivicScore
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border px-6"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground">
              Still have questions?{" "}
              <a href="mailto:support@civicscore.com" className="text-primary hover:underline">
                Contact us
              </a>
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
