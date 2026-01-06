import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, contributorTypeLabels, type Contribution } from "../types";
import { useFeatureToggles } from "@/hooks/useFeatureToggles";
import { DonorDisclaimer } from "@/components/DonorDisclaimer";
import { Eye, EyeOff, Users, Building2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ContributorsListProps {
  contributions: Contribution[];
}

const typeColors: Record<Contribution["contributorType"], string> = {
  individual: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
  pac: "bg-civic-gold/10 text-civic-gold border-civic-gold/30",
  organization: "bg-civic-slate/10 text-civic-slate border-civic-slate/30",
  corporate: "bg-civic-red/10 text-civic-red border-civic-red/30",
  union: "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
};

// Aggregate contributions by type for summary view
function aggregateByType(contributions: Contribution[]) {
  const aggregated: Record<string, { count: number; total: number; industries: Set<string> }> = {};
  
  for (const c of contributions) {
    const key = c.contributorType;
    if (!aggregated[key]) {
      aggregated[key] = { count: 0, total: 0, industries: new Set() };
    }
    aggregated[key].count++;
    aggregated[key].total += c.amount;
    if (c.industry) aggregated[key].industries.add(c.industry);
  }
  
  return Object.entries(aggregated)
    .map(([type, data]) => ({
      type: type as Contribution["contributorType"],
      count: data.count,
      total: data.total,
      topIndustries: Array.from(data.industries).slice(0, 3),
    }))
    .sort((a, b) => b.total - a.total);
}

// Aggregate PAC/organization contributions (safe to show names)
function getOrganizationContributions(contributions: Contribution[]) {
  return contributions.filter(c => 
    c.contributorType === "pac" || 
    c.contributorType === "organization" || 
    c.contributorType === "corporate" || 
    c.contributorType === "union"
  );
}

// Get individual contributions (names hidden by default)
function getIndividualContributions(contributions: Contribution[]) {
  return contributions.filter(c => c.contributorType === "individual");
}

// Anonymize individual contribution for display
function anonymizeContribution(contribution: Contribution): string {
  const parts: string[] = [];
  
  if (contribution.contributorOccupation) {
    parts.push(contribution.contributorOccupation);
  }
  if (contribution.contributorEmployer) {
    parts.push(`at ${contribution.contributorEmployer}`);
  }
  if (contribution.contributorState) {
    parts.push(`(${contribution.contributorState})`);
  }
  
  if (parts.length === 0) {
    return "Individual Donor";
  }
  
  return parts.join(" ");
}

// Mask address to only show city/state
function maskLocation(contribution: Contribution): string | null {
  if (contribution.contributorState) {
    return contribution.contributorState;
  }
  return null;
}

const INITIAL_DISPLAY_COUNT = 10;

export function ContributorsList({ contributions }: ContributorsListProps) {
  const { isFeatureEnabled, isLoading: togglesLoading } = useFeatureToggles();
  const [localShowNames, setLocalShowNames] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showAllOrgs, setShowAllOrgs] = useState(false);
  const [showAllIndividuals, setShowAllIndividuals] = useState(false);
  
  // Feature flag controls global availability; user can opt-in per session
  const showDonorIdentitiesEnabled = !togglesLoading && isFeatureEnabled("show_donor_identities");
  const showIndividualNames = showDonorIdentitiesEnabled && localShowNames;

  if (contributions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No contribution data available.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Data will be synced from public records.
        </p>
      </div>
    );
  }

  const organizationContributions = getOrganizationContributions(contributions);
  const individualContributions = getIndividualContributions(contributions);
  const aggregatedTypes = aggregateByType(contributions);

  const handleToggleNames = () => {
    if (!localShowNames) {
      setShowWarningDialog(true);
    } else {
      setLocalShowNames(false);
    }
  };

  const confirmShowNames = () => {
    setLocalShowNames(true);
    setShowWarningDialog(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary section - always visible */}
      <div className="space-y-2 pb-4 border-b border-border">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          Contribution Summary
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {aggregatedTypes.map((agg) => (
            <div
              key={agg.type}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("text-xs", typeColors[agg.type])}
                >
                  {contributorTypeLabels[agg.type]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ({agg.count})
                </span>
              </div>
              <span className="font-medium text-sm">
                {formatCurrency(agg.total)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PAC/Organization contributions - always show names */}
      {organizationContributions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              PACs & Organizations ({organizationContributions.length})
            </h4>
          </div>
          <div className="space-y-2">
            {(showAllOrgs ? organizationContributions : organizationContributions.slice(0, INITIAL_DISPLAY_COUNT)).map((contribution, index) => (
              <div
                key={contribution.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {contribution.contributorName}
                    </p>
                    {maskLocation(contribution) && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {maskLocation(contribution)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", typeColors[contribution.contributorType])}
                    >
                      {contributorTypeLabels[contribution.contributorType]}
                    </Badge>
                    {contribution.industry && (
                      <Badge variant="outline" className="text-xs">
                        {contribution.industry}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold text-foreground">
                    {formatCurrency(contribution.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{contribution.cycle}</p>
                </div>
              </div>
            ))}
          </div>
          {organizationContributions.length > INITIAL_DISPLAY_COUNT && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllOrgs(!showAllOrgs)}
              className="w-full text-xs"
            >
              {showAllOrgs ? `Show Less` : `Show All ${organizationContributions.length} Organizations`}
            </Button>
          )}
        </div>
      )}

      {/* Individual contributions - names hidden by default */}
      {individualContributions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Individual Donors ({individualContributions.length})
            </h4>
            {showDonorIdentitiesEnabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleNames}
                className="text-xs h-7"
              >
                {showIndividualNames ? (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Hide Names
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Show Names
                  </>
                )}
              </Button>
            )}
          </div>

          {showIndividualNames && <DonorDisclaimer variant="full" />}

          <div className="space-y-2">
            {(showAllIndividuals ? individualContributions : individualContributions.slice(0, INITIAL_DISPLAY_COUNT)).map((contribution, index) => (
              <div
                key={contribution.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
                style={{ animationDelay: `${(index + organizationContributions.length) * 50}ms`, animationFillMode: 'forwards' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {showIndividualNames
                        ? contribution.contributorName
                        : anonymizeContribution(contribution)}
                    </p>
                    {maskLocation(contribution) && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {maskLocation(contribution)}
                      </Badge>
                    )}
                  </div>
                  {showIndividualNames && (contribution.contributorEmployer || contribution.contributorOccupation) && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                      {contribution.contributorOccupation && (
                        <span className="text-sm text-foreground/80">
                          {contribution.contributorOccupation}
                        </span>
                      )}
                      {contribution.contributorOccupation && contribution.contributorEmployer && (
                        <span className="hidden sm:inline text-muted-foreground">•</span>
                      )}
                      {contribution.contributorEmployer && (
                        <span className="text-sm text-muted-foreground truncate">
                          {contribution.contributorEmployer}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", typeColors[contribution.contributorType])}
                    >
                      {contributorTypeLabels[contribution.contributorType]}
                    </Badge>
                    {contribution.industry && (
                      <Badge variant="outline" className="text-xs">
                        {contribution.industry}
                      </Badge>
                    )}
                    {showIndividualNames && <DonorDisclaimer variant="inline" />}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold text-foreground">
                    {formatCurrency(contribution.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{contribution.cycle}</p>
                </div>
              </div>
            ))}
          </div>
          {individualContributions.length > INITIAL_DISPLAY_COUNT && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllIndividuals(!showAllIndividuals)}
              className="w-full text-xs"
            >
              {showAllIndividuals ? `Show Less` : `Show All ${individualContributions.length} Donors`}
            </Button>
          )}

          {!showDonorIdentitiesEnabled && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Individual donor names are hidden for privacy. Contact information and street addresses are never displayed.
            </p>
          )}
        </div>
      )}

      {/* Warning dialog for showing names */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-civic-gold" />
              View Individual Donor Names
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                You are about to view individual donor names from public FEC
                (Federal Election Commission) filings.
              </p>
              <p className="font-medium text-foreground">
                Important reminders:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>This data is from public campaign finance records</li>
                <li>Names and addresses may contain errors in source filings</li>
                <li>Do not use this information to harass or contact individuals</li>
                <li>Contact information and street addresses are never displayed</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarningDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmShowNames}>
              I Understand, Show Names
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
