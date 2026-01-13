import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface MemberCompleteness {
  member_id: string;
  full_name: string;
  state: string;
  party: string;
  chamber: string;
  cycle_2026_complete: boolean;
  cycle_2026_count: number;
  cycle_2024_complete: boolean;
  cycle_2024_count: number;
  cycle_2022_complete: boolean;
  cycle_2022_count: number;
  cycle_2020_complete: boolean;
  cycle_2020_count: number;
  cycle_2018_complete: boolean;
  cycle_2018_count: number;
  total_contributions: number;
  completeness_percent: number;
  has_fec_match: boolean;
}

export default function AdminFECCompletenessPage() {
  const { data: completeness, isLoading, refetch } = useQuery({
    queryKey: ['fec-completeness'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fec_sync_completeness')
        .select('*')
        .order('completeness_percent', { ascending: true })
        .limit(100);

      if (error) throw error;
      return data as MemberCompleteness[];
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['fec-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fec_sync_completeness')
        .select('completeness_percent, has_fec_match, total_contributions');

      if (!data) return null;

      const total = data.length;
      const fullyComplete = data.filter(m => m.completeness_percent === 100).length;
      const noMatch = data.filter(m => !m.has_fec_match).length;
      const avgContributions = total > 0 ? Math.round(
        data.reduce((sum, m) => sum + (m.total_contributions || 0), 0) / total
      ) : 0;
      const avgCompleteness = total > 0 ? Math.round(
        data.reduce((sum, m) => sum + (m.completeness_percent || 0), 0) / total
      ) : 0;

      return { total, fullyComplete, noMatch, avgContributions, avgCompleteness };
    }
  });

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
      </div>
      
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">FEC Data Completeness</h1>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Fully Complete</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.fullyComplete}</div>
              <div className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.fullyComplete / stats.total) * 100) : 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">No FEC Match</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.noMatch}</div>
              <div className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.noMatch / stats.total) * 100) : 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Avg Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgContributions.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Avg Completeness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgCompleteness}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members by Completeness (Least Complete First)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {completeness?.map((member) => (
              <div key={member.member_id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/member/${member.member_id}`} className="font-semibold hover:underline">
                      {member.full_name}
                    </Link>
                    <Badge variant="outline">
                      {member.state} - {member.chamber === 'house' ? 'House' : 'Senate'}
                    </Badge>
                    {!member.has_fec_match && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        No FEC Match
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {member.total_contributions.toLocaleString()} total contributions
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Overall Completeness</span>
                    <span className="font-semibold">{member.completeness_percent}%</span>
                  </div>
                  <Progress value={member.completeness_percent} className="h-2" />
                </div>

                <div className="grid grid-cols-5 gap-2 text-sm">
                  {[
                    { year: 2026, complete: member.cycle_2026_complete, count: member.cycle_2026_count },
                    { year: 2024, complete: member.cycle_2024_complete, count: member.cycle_2024_count },
                    { year: 2022, complete: member.cycle_2022_complete, count: member.cycle_2022_count },
                    { year: 2020, complete: member.cycle_2020_complete, count: member.cycle_2020_count },
                    { year: 2018, complete: member.cycle_2018_complete, count: member.cycle_2018_count },
                  ].map(({ year, complete, count }) => (
                    <div key={year} className="flex items-center gap-1">
                      {complete ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      )}
                      <span>{year}: {count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
