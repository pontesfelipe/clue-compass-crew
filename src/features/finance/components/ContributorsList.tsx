import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, contributorTypeLabels, type Contribution, type ContributionCompleteness } from "../types";
import { useFeatureToggles } from "@/hooks/useFeatureToggles";
import { DonorDisclaimer } from "@/components/DonorDisclaimer";
import { Eye, EyeOff, Users, Building2, AlertTriangle, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContributorsListProps {
  contributions: Contribution[];
  completeness?: ContributionCompleteness[];
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

// Anonymize individual contribution for display (state shown separately as badge)
function anonymizeContribution(contribution: Contribution): string {
  const parts: string[] = [];
  
  if (contribution.contributorOccupation) {
    parts.push(contribution.contributorOccupation);
  }
  if (contribution.contributorEmployer) {
    parts.push(`at ${contribution.contributorEmployer}`);
  }
  
  // Return "Individual Donor" if no occupation/employer info available
  // State is displayed separately as a badge, so we don't include it here
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

const ITEMS_PER_PAGE = 10;

function PaginationControls({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Pagination className="mt-3">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious 
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
          />
        </PaginationItem>
        {getVisiblePages().map((page, idx) => (
          <PaginationItem key={idx}>
            {page === 'ellipsis' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                onClick={() => onPageChange(page)}
                isActive={currentPage === page}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext 
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function ContributorsList({ contributions, completeness = [] }: ContributorsListProps) {
  const { isFeatureEnabled, isLoading: togglesLoading } = useFeatureToggles();
  const [localShowNames, setLocalShowNames] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [orgsPage, setOrgsPage] = useState(1);
  const [individualsPage, setIndividualsPage] = useState(1);
  
  // Feature flag controls global availability; user can opt-in per session
  const showDonorIdentitiesEnabled = !togglesLoading && isFeatureEnabled("show_donor_identities");
  const showIndividualNames = showDonorIdentitiesEnabled && localShowNames;

  // All hooks must be called before any early returns
  const organizationContributions = useMemo(() => getOrganizationContributions(contributions), [contributions]);
  const individualContributions = useMemo(() => getIndividualContributions(contributions), [contributions]);
  const aggregatedTypes = useMemo(() => aggregateByType(contributions), [contributions]);

  // Calculate overall completeness stats
  const completenessStats = useMemo(() => {
    if (completeness.length === 0) return null;
    
    const totalFetched = completeness.reduce((sum, c) => sum + c.fetched, 0);
    const totalAvailable = completeness.reduce((sum, c) => sum + (c.total || c.fetched), 0);
    const percentage = totalAvailable > 0 ? Math.round((totalFetched / totalAvailable) * 100) : 100;
    const isComplete = totalFetched >= totalAvailable || percentage >= 95;
    
    return {
      fetched: totalFetched,
      total: totalAvailable,
      percentage,
      isComplete,
      byCycle: completeness,
    };
  }, [completeness]);

  const orgsTotalPages = Math.ceil(organizationContributions.length / ITEMS_PER_PAGE);
  const individualsTotalPages = Math.ceil(individualContributions.length / ITEMS_PER_PAGE);

  const paginatedOrgs = useMemo(() => {
    const start = (orgsPage - 1) * ITEMS_PER_PAGE;
    return organizationContributions.slice(start, start + ITEMS_PER_PAGE);
  }, [organizationContributions, orgsPage]);

  const paginatedIndividuals = useMemo(() => {
    const start = (individualsPage - 1) * ITEMS_PER_PAGE;
    return individualContributions.slice(start, start + ITEMS_PER_PAGE);
  }, [individualContributions, individualsPage]);

  // Early return AFTER all hooks
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
      {/* Data Completeness Indicator */}
      {completenessStats && (
        <TooltipProvider>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
            <Database className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">
                  FEC Data Coverage
                </span>
                <div className="flex items-center gap-1.5">
                  {completenessStats.isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span className={cn(
                    "text-xs font-semibold",
                    completenessStats.isComplete ? "text-green-600" : "text-amber-600"
                  )}>
                    {completenessStats.percentage}%
                  </span>
                </div>
              </div>
              <Progress 
                value={completenessStats.percentage} 
                className="h-1.5"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {completenessStats.fetched.toLocaleString()} of {completenessStats.total.toLocaleString()} itemized contributions
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                      Details
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1.5">
                      <p className="font-medium text-xs">Contributions by Cycle</p>
                      {completenessStats.byCycle.map((c) => (
                        <div key={c.cycle} className="flex justify-between text-xs gap-4">
                          <span>{c.cycle}:</span>
                          <span className="font-medium">
                            {c.fetched.toLocaleString()}/{c.total?.toLocaleString() || '?'}
                          </span>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground pt-1 border-t">
                        Only itemized contributions (&gt;$200) are reported to FEC.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </TooltipProvider>
      )}

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
            {paginatedOrgs.map((contribution, index) => (
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
          <PaginationControls 
            currentPage={orgsPage} 
            totalPages={orgsTotalPages} 
            onPageChange={setOrgsPage} 
          />
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
            {paginatedIndividuals.map((contribution, index) => (
              <div
                key={contribution.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
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
          <PaginationControls 
            currentPage={individualsPage} 
            totalPages={individualsTotalPages} 
            onPageChange={setIndividualsPage} 
          />

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
