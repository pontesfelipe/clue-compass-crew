import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet";

const TermsPage = () => {
  return (
    <>
      <Helmet>
        <title>Terms & Conditions | CivicScore</title>
        <meta name="description" content="Terms and Conditions for using CivicScore - your trusted source for congressional data and member scoring." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-4xl font-display font-bold text-foreground mb-8">Terms & Conditions</h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-sm text-muted-foreground">Last updated: December 9, 2024</p>
            
            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using CivicScore ("the Service"), you accept and agree to be bound by these Terms and Conditions. 
                If you do not agree to these terms, please do not use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Description of Service</h2>
              <p>
                CivicScore provides information about U.S. Congressional members, including voting records, legislative activity, 
                and performance scores based on publicly available data from Congress.gov, the Federal Election Commission, and other 
                official government sources. Our Service aims to promote civic engagement and transparency in government.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. Data Sources and Accuracy</h2>
              <p>
                CivicScore aggregates and presents data from official government sources. While we strive for accuracy, we cannot 
                guarantee that all information is complete, current, or error-free. The scores and analysis presented are based on 
                our proprietary methodology and should be considered as one of many tools for evaluating congressional representatives.
              </p>
              <p className="mt-4">
                Users should verify important information through official government sources before making decisions based on 
                data provided by our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. User Accounts</h2>
              <p>
                To access certain features of the Service, you may be required to create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Provide accurate and complete information when creating your account</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Use the Service for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Scrape, harvest, or collect data from the Service without permission</li>
                <li>Use the Service to spread misinformation or misleading content</li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Intellectual Property</h2>
              <p>
                The Service, including its original content, features, and functionality, is owned by CivicScore and is protected 
                by copyright, trademark, and other intellectual property laws. Our scoring methodology, analysis, and presentation 
                of data are proprietary.
              </p>
              <p className="mt-4">
                Government data sourced from Congress.gov, FEC, and other official sources remains in the public domain as 
                provided by those sources.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Disclaimer of Warranties</h2>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. 
                WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Limitation of Liability</h2>
              <p>
                TO THE FULLEST EXTENT PERMITTED BY LAW, CIVICSCORE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
                CONSEQUENTIAL, OR PUNITIVE DAMAGES RESULTING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Political Neutrality</h2>
              <p>
                CivicScore is committed to providing objective, data-driven information about congressional members regardless 
                of party affiliation. Our scoring methodology is designed to be non-partisan and based solely on measurable 
                legislative activity and voting records.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">10. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of significant changes by posting 
                a notice on our Service or sending an email. Your continued use of the Service after changes constitutes 
                acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">11. Termination</h2>
              <p>
                We may terminate or suspend your account and access to the Service at our sole discretion, without prior notice, 
                for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">12. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard 
                to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">13. Contact Information</h2>
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="mt-4">
                <strong>Email:</strong> legal@civicscore.com
              </p>
            </section>
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default TermsPage;
