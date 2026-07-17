import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface Row {
  member_id: string;
  completeness_percentage: number | null;
  missing_fields: string[] | null;
  basic_info_complete: boolean | null;
  contact_info_complete: boolean | null;
  finance_data_complete: boolean | null;
  committee_data_complete: boolean | null;
  vote_data_complete: boolean | null;
  bills_data_complete: boolean | null;
  score_data_valid: boolean | null;
  members: { full_name: string; state: string | null; party: string | null; chamber: string | null } | null;
}

export function MissingDataPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("member_data_completeness")
        .select("member_id,completeness_percentage,missing_fields,basic_info_complete,contact_info_complete,finance_data_complete,committee_data_complete,vote_data_complete,bills_data_complete,score_data_valid,members!inner(full_name,state,party,chamber,in_office)")
        .order("completeness_percentage", { ascending: true })
        .limit(200);
      setRows(((data as any[]) || []).filter((r) => r.members?.full_name));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const critical = rows.filter((r) => (r.completeness_percentage ?? 100) < 50);
  const warning = rows.filter((r) => (r.completeness_percentage ?? 100) >= 50 && (r.completeness_percentage ?? 100) < 80);

  const flagCounts = {
    basic: rows.filter((r) => !r.basic_info_complete).length,
    contact: rows.filter((r) => !r.contact_info_complete).length,
    finance: rows.filter((r) => !r.finance_data_complete).length,
    committee: rows.filter((r) => !r.committee_data_complete).length,
    votes: rows.filter((r) => !r.vote_data_complete).length,
    bills: rows.filter((r) => !r.bills_data_complete).length,
    scores: rows.filter((r) => !r.score_data_valid).length,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Critical (&lt;50%)</CardDescription><CardTitle className="text-2xl text-destructive">{critical.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Warning (50-80%)</CardDescription><CardTitle className="text-2xl text-yellow-600">{warning.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Members Audited</CardDescription><CardTitle className="text-2xl">{rows.length}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Missing by Category</CardTitle><CardDescription>How many members are missing each data type</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(flagCounts).map(([key, val]) => (
              <div key={key} className="border rounded p-3">
                <div className="text-xs text-muted-foreground uppercase">{key}</div>
                <div className="text-xl font-bold">{val}</div>
                <Progress value={100 - (val / Math.max(rows.length, 1)) * 100} className="mt-1 h-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-600" />Members with Missing Data</CardTitle><CardDescription>Lowest completeness first</CardDescription></CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              {rows.map((r) => {
                const pct = Math.round(r.completeness_percentage ?? 0);
                const color = pct < 50 ? "text-destructive" : pct < 80 ? "text-yellow-600" : "text-green-600";
                return (
                  <Link key={r.member_id} to={`/member/${r.member_id}`} className="flex items-center gap-3 border rounded px-3 py-2 hover:bg-muted text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.members?.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.members?.party} · {r.members?.state} · {r.members?.chamber}
                        {r.missing_fields && r.missing_fields.length > 0 && ` · missing: ${r.missing_fields.slice(0, 4).join(", ")}${r.missing_fields.length > 4 ? "…" : ""}`}
                      </div>
                    </div>
                    <div className={`text-right shrink-0 ${color}`}>
                      <div className="font-bold">{pct}%</div>
                      <div className="text-xs">complete</div>
                    </div>
                  </Link>
                );
              })}
              {rows.length === 0 && <p className="text-sm text-muted-foreground">No completeness data yet.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
