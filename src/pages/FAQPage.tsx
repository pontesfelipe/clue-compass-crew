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
      question: "What is CivicScore?",
      answer: "CivicScore is a non-partisan platform that provides data-driven performance scores for every member of Congress. We use official government data to help citizens make informed decisions about their representatives."
    },
    {
      question: "Where does the data come from?",
      answer: "All our data comes from official government sources: Congress.gov for legislative activity and voting records, the Federal Election Commission (FEC) for campaign finance data, and the House Clerk and Senate.gov for detailed roll call votes."
    },
    {
      question: "How often is the data updated?",
      answer: "We update our data on a regular schedule: voting records every 2 hours, bills every 6 hours, member information daily, and campaign finance data nightly. This 'near real-time' approach ensures you have access to recent data."
    },
    {
      question: "How are the scores calculated?",
      answer: "Scores are calculated using a weighted average of four components: Productivity (bills sponsored and enacted), Attendance (vote participation), Bipartisanship (cross-party collaboration), and Issue Alignment (matching with your priorities). Authenticated users can customize these weights."
    },
    {
      question: "Is CivicScore partisan?",
      answer: "No. CivicScore is strictly non-partisan. We present objective data without editorial commentary or political bias. Our methodology is transparent and applied equally to all members regardless of party affiliation."
    },
    {
      question: "Can I customize my scoring preferences?",
      answer: "Yes! Authenticated users can adjust the weights for each scoring component to prioritize what matters most to them. You can also select priority issues to see how representatives align with your values."
    },
    {
      question: "What is the alignment score?",
      answer: "The alignment score shows how closely a representative's voting record and legislative activity match your personal positions on key issues. Complete your profile to see personalized alignment scores for all representatives."
    },
    {
      question: "Why is a representative's score different from what I expected?",
      answer: "Our scores are based on objective data metrics, which may differ from public perception or media narratives. We encourage you to explore the detailed breakdown for each representative to understand how their score was calculated."
    },
    {
      question: "How can I find my representatives?",
      answer: "Use the interactive map on our homepage to explore representatives by state. You can also use the search feature to find specific members by name, state, or district."
    },
    {
      question: "Is CivicScore free to use?",
      answer: "Yes! CivicScore is free to use. Creating an account unlocks additional features like customizable scoring weights, personalized alignment scores, and the ability to track your representatives over time."
    },
    {
      question: "How do you handle campaign finance data?",
      answer: "We display campaign finance data from the FEC, including individual contributions, PAC donations, and funding sources. This helps you understand potential influences on your representatives' decision-making."
    },
    {
      question: "Can I compare multiple representatives?",
      answer: "Yes! Use our Compare feature to see side-by-side comparisons of multiple representatives, including their scores, voting records, and policy area focus."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>FAQ - CivicScore</title>
        <meta name="description" content="Frequently asked questions about CivicScore, our methodology, data sources, and how to use the platform." />
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
