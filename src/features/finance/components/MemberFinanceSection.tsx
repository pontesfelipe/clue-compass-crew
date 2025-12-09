import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Building, Building2, Users } from "lucide-react";
import { useMemberFinance } from "../hooks/useMemberFinance";
import { FinanceOverview } from "./FinanceOverview";
import { ContributorsList } from "./ContributorsList";
import { LobbyingList } from "./LobbyingList";
import { SponsorsList } from "./SponsorsList";

interface MemberFinanceSectionProps {
  memberId: string;
}

export function MemberFinanceSection({ memberId }: MemberFinanceSectionProps) {
  const { data: finance, isLoading } = useMemberFinance(memberId);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
        <Skeleton className="h-6 w-48 mb-6" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!finance) {
    return null;
  }

  const hasData = 
    finance.contributions.length > 0 || 
    finance.lobbying.length > 0 || 
    finance.sponsors.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-civic-md">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-serif text-xl font-semibold text-foreground">
          Financial Relationships
        </h2>
      </div>

      {hasData ? (
        <>
          <FinanceOverview finance={finance} />

          <Tabs defaultValue="donors" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="donors" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Donors</span>
              </TabsTrigger>
              <TabsTrigger value="lobbying" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Lobbying</span>
              </TabsTrigger>
              <TabsTrigger value="sponsors" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Sponsors</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="donors" className="mt-4">
              <ContributorsList contributions={finance.contributions} />
            </TabsContent>

            <TabsContent value="lobbying" className="mt-4">
              <LobbyingList lobbying={finance.lobbying} />
            </TabsContent>

            <TabsContent value="sponsors" className="mt-4">
              <SponsorsList sponsors={finance.sponsors} />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">
            Financial data will be available soon.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            We're working on syncing campaign finance and lobbying data from public records.
          </p>
        </div>
      )}
    </div>
  );
}
