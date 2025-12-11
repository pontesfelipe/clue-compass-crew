import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Users, FileText, ExternalLink, Gavel, CheckCircle2, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface BillDetailDialogProps {
  billId: string | null;
  onClose: () => void;
}

const billTypeMap: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
};

function formatBillNumber(bill: { bill_type: string; bill_number: number }): string {
  const prefix = billTypeMap[bill.bill_type] || bill.bill_type?.toUpperCase() || "";
  return `${prefix}${bill.bill_number}`;
}

function getBillStatus(bill: any): { label: string; color: string } {
  if (bill.enacted) return { label: "Enacted", color: "bg-score-excellent/10 text-score-excellent border-score-excellent/30" };
  if (bill.latest_action_text?.toLowerCase().includes("passed")) return { label: "Passed", color: "bg-score-good/10 text-score-good border-score-good/30" };
  if (bill.latest_action_text?.toLowerCase().includes("committee")) return { label: "In Committee", color: "bg-score-average/10 text-score-average border-score-average/30" };
  return { label: "Introduced", color: "bg-muted text-muted-foreground border-muted-foreground/30" };
}

export function BillDetailDialog({ billId, onClose }: BillDetailDialogProps) {
  const { data: bill, isLoading } = useQuery({
    queryKey: ["bill-detail-dialog", billId],
    queryFn: async () => {
      if (!billId) return null;
      
      // Fetch bill with sponsor info
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select("*")
        .eq("id", billId)
        .maybeSingle();

      if (billError) throw billError;
      if (!billData) return null;

      // Fetch primary sponsor
      const { data: sponsorData } = await supabase
        .from("bill_sponsorships")
        .select(`
          is_sponsor,
          members (
            id,
            full_name,
            party,
            state,
            chamber
          )
        `)
        .eq("bill_id", billId)
        .eq("is_sponsor", true)
        .maybeSingle();

      // Fetch cosponsor count
      const { count: cosponsorCount } = await supabase
        .from("bill_sponsorships")
        .select("*", { count: "exact", head: true })
        .eq("bill_id", billId)
        .eq("is_sponsor", false);

      return {
        ...billData,
        sponsor: sponsorData?.members,
        cosponsorCount: cosponsorCount || 0,
      };
    },
    enabled: !!billId,
  });

  const status = bill ? getBillStatus(bill) : null;

  return (
    <Dialog open={!!billId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Bill Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : bill ? (
          <div className="space-y-6">
            {/* Bill Number and Status */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-sm font-mono">
                {formatBillNumber(bill)}
              </Badge>
              {status && (
                <Badge variant="outline" className={cn("text-sm", status.color)}>
                  {status.label}
                </Badge>
              )}
              {bill.policy_area && (
                <Badge variant="outline" className="text-sm">
                  {bill.policy_area}
                </Badge>
              )}
            </div>

            {/* Title */}
            <div>
              <h3 className="font-semibold text-lg text-foreground">
                {bill.short_title || bill.title}
              </h3>
              {bill.short_title && bill.title !== bill.short_title && (
                <p className="text-sm text-muted-foreground mt-1">
                  {bill.title}
                </p>
              )}
            </div>

            {/* AI Impact Assessment */}
            {bill.bill_impact && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Impact Assessment
                </h4>
                <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none">
                  {bill.bill_impact.split('\n').map((line: string, i: number) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <h5 key={i} className="font-semibold text-foreground mt-3 mb-1">{line.replace(/\*\*/g, '')}</h5>;
                    }
                    if (line.startsWith('- ')) {
                      return <p key={i} className="ml-2 my-0.5">• {line.slice(2)}</p>;
                    }
                    return line.trim() ? <p key={i} className="my-1">{line}</p> : null;
                  })}
                </div>
              </div>
            )}

            {/* Summary or Description */}
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {bill.bill_impact ? 'Official Summary' : 'About this Bill'}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {bill.summary || (
                  <>
                    This {bill.bill_type === 's' ? 'Senate' : 'House'} bill 
                    {bill.policy_area ? ` addresses ${bill.policy_area.toLowerCase()}` : ' was introduced'} 
                    {bill.introduced_date ? ` on ${format(new Date(bill.introduced_date), 'MMMM d, yyyy')}` : ''}
                    . {bill.enacted 
                      ? `It was signed into law${bill.enacted_date ? ` on ${format(new Date(bill.enacted_date), 'MMMM d, yyyy')}` : ''}.` 
                      : bill.latest_action_text 
                        ? `Most recent action: ${bill.latest_action_text}` 
                        : 'It is currently under consideration.'}
                  </>
                )}
              </p>
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Introduced</p>
                  <p className="text-sm font-medium">
                    {bill.introduced_date 
                      ? format(new Date(bill.introduced_date), 'MMM d, yyyy')
                      : 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Congress</p>
                  <p className="text-sm font-medium">{bill.congress}th Congress</p>
                </div>
              </div>
              {bill.enacted_date && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-score-excellent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Enacted</p>
                    <p className="text-sm font-medium text-score-excellent">
                      {format(new Date(bill.enacted_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Cosponsors</p>
                  <p className="text-sm font-medium">{bill.cosponsorCount}</p>
                </div>
              </div>
            </div>

            {/* Sponsor */}
            {bill.sponsor && (
              <div className="p-4 rounded-lg border border-border">
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Primary Sponsor
                </h4>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {bill.sponsor.full_name}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      bill.sponsor.party === "D" && "bg-civic-blue/10 text-civic-blue border-civic-blue/30",
                      bill.sponsor.party === "R" && "bg-civic-red/10 text-civic-red border-civic-red/30"
                    )}
                  >
                    {bill.sponsor.party}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {bill.sponsor.state}
                  </span>
                </div>
                <Button variant="civic-ghost" size="sm" className="mt-2" asChild>
                  <Link to={`/member/${bill.sponsor.id}`}>
                    View Member Profile
                  </Link>
                </Button>
              </div>
            )}

            {/* Latest Action */}
            {bill.latest_action_text && (
              <div className="p-4 rounded-lg border border-border">
                <h4 className="font-medium text-foreground mb-1">Latest Action</h4>
                {bill.latest_action_date && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {format(new Date(bill.latest_action_date), 'MMM d, yyyy')}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {bill.latest_action_text}
                </p>
              </div>
            )}

            {/* Subjects */}
            {bill.subjects && bill.subjects.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">Subjects</h4>
                <div className="flex flex-wrap gap-2">
                  {bill.subjects.slice(0, 8).map((subject: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {subject}
                    </Badge>
                  ))}
                  {bill.subjects.length > 8 && (
                    <Badge variant="outline" className="text-xs">
                      +{bill.subjects.length - 8} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-border flex gap-2">
              <Button variant="civic" size="sm" asChild className="flex-1">
                <Link to={`/bill/${bill.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Full Details
                </Link>
              </Button>
              {bill.url && (
                <Button variant="civic-outline" size="sm" asChild>
                  <a href={bill.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Congress.gov
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Bill details not found.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
