import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  ExternalLink, 
  MapPin,
  Twitter,
  Facebook,
  Instagram
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useGovernor } from "@/features/governors";

const partyColors: Record<string, string> = {
  D: "bg-democrat text-democrat-foreground",
  R: "bg-republican text-republican-foreground",
  I: "bg-independent text-independent-foreground",
};

const partyNames: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

export default function GovernorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: governor, isLoading, error } = useGovernor(id || "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !governor) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Link to="/governors">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Governors
            </Button>
          </Link>
          <div className="text-center py-12">
            <p className="text-destructive">Governor not found</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const initials = governor.firstName && governor.lastName
    ? `${governor.firstName[0]}${governor.lastName[0]}`
    : governor.name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <>
      <Helmet>
        <title>{governor.name} - Governor of {governor.state} | CivicScore</title>
        <meta
          name="description"
          content={`${governor.name} is the Governor of ${governor.state}. View contact information and details.`}
        />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Back button */}
            <Link to="/governors">
              <Button variant="ghost" className="mb-6">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Governors
              </Button>
            </Link>

            {/* Profile header */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <Avatar className="h-32 w-32 ring-4 ring-border">
                    <AvatarImage src={governor.imageUrl || undefined} alt={governor.name} />
                    <AvatarFallback className="text-3xl font-semibold bg-muted">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-foreground">
                        {governor.name}
                      </h1>
                      <Badge className={partyColors[governor.party]} variant="secondary">
                        {partyNames[governor.party]}
                      </Badge>
                    </div>

                    <p className="text-xl text-muted-foreground mb-4">
                      Governor of {governor.state}
                    </p>

                    {/* Social links */}
                    <div className="flex flex-wrap gap-2">
                      {governor.twitterHandle && (
                        <a
                          href={`https://twitter.com/${governor.twitterHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <Twitter className="h-4 w-4 mr-2" />
                            @{governor.twitterHandle}
                          </Button>
                        </a>
                      )}
                      {governor.facebookUrl && (
                        <a
                          href={governor.facebookUrl.startsWith("http") ? governor.facebookUrl : `https://facebook.com/${governor.facebookUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <Facebook className="h-4 w-4 mr-2" />
                            Facebook
                          </Button>
                        </a>
                      )}
                      {governor.instagramUrl && (
                        <a
                          href={governor.instagramUrl.startsWith("http") ? governor.instagramUrl : `https://instagram.com/${governor.instagramUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <Instagram className="h-4 w-4 mr-2" />
                            Instagram
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {governor.email && (
                    <a
                      href={`mailto:${governor.email}`}
                      className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="h-5 w-5 text-primary" />
                      <span>{governor.email}</span>
                    </a>
                  )}
                  {governor.capitolPhone && (
                    <a
                      href={`tel:${governor.capitolPhone}`}
                      className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Phone className="h-5 w-5 text-primary" />
                      <span>{governor.capitolPhone}</span>
                    </a>
                  )}
                  {governor.websiteUrl && (
                    <a
                      href={governor.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-5 w-5 text-primary" />
                      <span>Official Website</span>
                    </a>
                  )}
                  {governor.capitolAddress && (
                    <div className="flex items-start gap-3 text-muted-foreground">
                      <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="whitespace-pre-line">{governor.capitolAddress}</span>
                    </div>
                  )}
                  {!governor.email && !governor.capitolPhone && !governor.websiteUrl && !governor.capitolAddress && (
                    <p className="text-muted-foreground text-sm">
                      No contact information available
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">State</p>
                    <p className="font-medium">{governor.state}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Party</p>
                    <p className="font-medium">{partyNames[governor.party]}</p>
                  </div>
                  {governor.termStart && (
                    <div>
                      <p className="text-sm text-muted-foreground">Term Started</p>
                      <p className="font-medium">
                        {new Date(governor.termStart).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                  {governor.termEnd && (
                    <div>
                      <p className="text-sm text-muted-foreground">Term Ends</p>
                      <p className="font-medium">
                        {new Date(governor.termEnd).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Note about limited data */}
            <Card className="mt-6 bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground text-center">
                  Governor data is sourced from Open States API. Unlike Congress members, 
                  governors don't have voting records or bill sponsorships that can be tracked 
                  in the same way.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
