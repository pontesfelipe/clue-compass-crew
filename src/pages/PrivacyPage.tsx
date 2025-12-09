import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

const PrivacyPage = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | CivicScore</title>
        <meta name="description" content="Privacy Policy for CivicScore - how we collect, use, and protect your personal information." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-4xl font-display font-bold text-foreground mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-sm text-muted-foreground">Last updated: December 9, 2024</p>
            
            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Introduction</h2>
              <p>
                CivicScore ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how 
                we collect, use, disclose, and safeguard your information when you use our service. Please read this policy 
                carefully to understand our practices regarding your personal data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">2.1 Information You Provide</h3>
              <p>When you create an account or use our services, we may collect:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li><strong>Account Information:</strong> First name, last name, email address, and password</li>
                <li><strong>Profile Information:</strong> Home state and display preferences</li>
                <li><strong>Scoring Preferences:</strong> Custom weights for scoring categories you choose to personalize</li>
              </ul>

              <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">2.2 Information Collected Automatically</h3>
              <p>When you access our service, we automatically collect:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li><strong>Usage Data:</strong> Pages visited, features used, and interaction patterns</li>
                <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Personalize your experience, including custom scoring preferences</li>
                <li>Process your account registration and manage your account</li>
                <li>Send you service-related communications</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Protect against fraud and unauthorized access</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Data Sources</h2>
              <p>
                CivicScore aggregates publicly available data from official government sources including:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li><strong>Congress.gov:</strong> Congressional member information, voting records, and bill data</li>
                <li><strong>Federal Election Commission (FEC):</strong> Campaign finance and contribution data</li>
                <li><strong>Official Government APIs:</strong> Additional public records and legislative information</li>
              </ul>
              <p className="mt-4">
                This government data is publicly available and is not considered personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Information Sharing and Disclosure</h2>
              <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li><strong>Service Providers:</strong> With third-party vendors who assist in operating our service</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your personal information, 
                including:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication mechanisms</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls limiting who can view your data</li>
              </ul>
              <p className="mt-4">
                However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed to provide you services. 
                We may retain certain information as required by law or for legitimate business purposes, such as:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Compliance with legal obligations</li>
                <li>Resolution of disputes</li>
                <li>Enforcement of our agreements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Your Rights and Choices</h2>
              <p>Depending on your location, you may have the following rights:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request a portable copy of your data</li>
                <li><strong>Opt-out:</strong> Opt out of certain data processing activities</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, please contact us at privacy@civicscore.com.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">9. Cookies and Tracking Technologies</h2>
              <p>
                We use cookies and similar tracking technologies to enhance your experience. These include:
              </p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li><strong>Essential Cookies:</strong> Required for basic site functionality</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how you use our service</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              </ul>
              <p className="mt-4">
                You can control cookies through your browser settings, though some features may not function properly without them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">10. Children's Privacy</h2>
              <p>
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal 
                information from children under 13. If you believe we have collected information from a child under 13, 
                please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">11. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate 
                safeguards are in place to protect your information in accordance with this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">12. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
                policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy 
                periodically.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">13. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <p className="mt-4">
                <strong>Email:</strong> privacy@civicscore.com
              </p>
              <p className="mt-4">
                For terms of use, please see our <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link>.
              </p>
            </section>
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default PrivacyPage;
