import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Statement {
  id: string;
  title: string;
  statementDate: string;
  url: string | null;
  statementType: string | null;
  subjects: string[] | null;
}

interface MemberActivityProps {
  memberId: string;
}

export function MemberActivity({ memberId }: MemberActivityProps) {
  const { data: statements, isLoading } = useQuery({
    queryKey: ["member-activity", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_statements")
        .select("*")
        .eq("member_id", memberId)
        .order("statement_date", { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        statementDate: s.statement_date,
        url: s.url,
        statementType: s.statement_type,
        subjects: s.subjects,
      })) as Statement[];
    },
    enabled: !!memberId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statements || statements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No recent activity recorded.
          </p>
        </CardContent>
      </Card>
    );
  }

  const typeLabels: Record<string, string> = {
    sponsored_bill: "Sponsored Bill",
    press_release: "Press Release",
    statement: "Statement",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {statements.map((statement, index) => (
            <div
              key={statement.id}
              className="p-3 rounded-lg bg-muted/50 opacity-0 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm line-clamp-2">
                    {statement.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(statement.statementDate), 'MMM d, yyyy')}
                    </span>
                    {statement.statementType && (
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[statement.statementType] || statement.statementType}
                      </Badge>
                    )}
                    {statement.subjects && statement.subjects.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {statement.subjects[0]}
                      </Badge>
                    )}
                  </div>
                </div>
                {statement.url && (
                  <a
                    href={statement.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
