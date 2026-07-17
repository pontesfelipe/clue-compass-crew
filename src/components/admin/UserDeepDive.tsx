import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, User as UserIcon, Bookmark, FileText, MessageSquare, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string | null;
}

interface DeepDiveData {
  trackedMembers: Array<{ id: string; full_name: string; state: string | null; party: string | null; created_at: string }>;
  trackedBills: Array<{ id: string; title: string | null; bill_number: string | null; created_at: string }>;
  answers: Array<{ question_text: string; issue_name: string; answer_value: number; updated_at: string }>;
  priorities: Array<{ issue_name: string; priority_level: number }>;
  alignments: Array<{ politician_id: string; full_name: string; state: string | null; party: string | null; overall_alignment: number; last_computed_at: string }>;
  activity: Array<{ activity_type: string; description: string | null; created_at: string }>;
}

export function UserDeepDive() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [data, setData] = useState<DeepDiveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,email,display_name,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setUsers((data as UserRow[]) || []);
      setLoadingUsers(false);
    })();
  }, []);

  const load = async (u: UserRow) => {
    setSelectedUser(u);
    setLoading(true);
    setData(null);
    const uid = u.user_id;

    const [tm, tb, ans, pri, ali, act] = await Promise.all([
      supabase.from("member_tracking").select("created_at,members(id,full_name,state,party)").eq("user_id", uid),
      supabase.from("bill_tracking").select("created_at,bills(id,title,bill_number)").eq("user_id", uid),
      supabase.from("user_answers").select("answer_value,updated_at,issue_questions(question_text,issues(name))").eq("user_id", uid),
      supabase.from("user_issue_priorities").select("priority_level,issues(name)").eq("user_id", uid),
      supabase.from("user_politician_alignment").select("politician_id,overall_alignment,last_computed_at,members!user_politician_alignment_politician_id_fkey(full_name,state,party)").eq("user_id", uid).order("overall_alignment", { ascending: false }).limit(50),
      supabase.from("user_activity_log").select("activity_type,description,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
    ]);

    setData({
      trackedMembers: (tm.data || []).map((r: any) => ({ ...r.members, created_at: r.created_at })).filter((r: any) => r.id),
      trackedBills: (tb.data || []).map((r: any) => ({ ...r.bills, created_at: r.created_at })).filter((r: any) => r.id),
      answers: (ans.data || []).map((r: any) => ({
        question_text: r.issue_questions?.question_text || "—",
        issue_name: r.issue_questions?.issues?.name || "—",
        answer_value: r.answer_value,
        updated_at: r.updated_at,
      })),
      priorities: (pri.data || []).map((r: any) => ({ issue_name: r.issues?.name || "—", priority_level: r.priority_level })),
      alignments: (ali.data || []).map((r: any) => ({
        politician_id: r.politician_id,
        full_name: r.members?.full_name || "—",
        state: r.members?.state || null,
        party: r.members?.party || null,
        overall_alignment: Number(r.overall_alignment),
        last_computed_at: r.last_computed_at,
      })),
      activity: act.data || [],
    });
    setLoading(false);
  };

  const filtered = users.filter((u) =>
    !search
      ? true
      : (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.display_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const answerLabel = (v: number) =>
    ({ "-2": "Strongly Oppose", "-1": "Oppose", "0": "Neutral", "1": "Support", "2": "Strongly Support" } as Record<string, string>)[String(v)] || String(v);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Users</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search email/name" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {loadingUsers ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="divide-y">
                {filtered.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => load(u)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition ${selectedUser?.user_id === u.user_id ? "bg-primary/10" : ""}`}
                  >
                    <div className="text-sm font-medium truncate">{u.display_name || u.email || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </button>
                ))}
                {filtered.length === 0 && <div className="p-4 text-sm text-muted-foreground">No users</div>}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="min-h-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            {selectedUser ? selectedUser.display_name || selectedUser.email : "Select a user"}
          </CardTitle>
          {selectedUser && <CardDescription>{selectedUser.email} · Joined {selectedUser.created_at?.slice(0, 10)}</CardDescription>}
        </CardHeader>
        <CardContent>
          {!selectedUser ? (
            <p className="text-sm text-muted-foreground">Pick a user on the left to see their tracked politicians, quiz answers, priorities, computed alignments, and activity.</p>
          ) : loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : data ? (
            <Tabs defaultValue="tracked" className="w-full">
              <TabsList className="mb-4 flex-wrap h-auto">
                <TabsTrigger value="tracked"><Bookmark className="h-4 w-4 mr-1" />Tracked ({data.trackedMembers.length + data.trackedBills.length})</TabsTrigger>
                <TabsTrigger value="answers"><MessageSquare className="h-4 w-4 mr-1" />Answers ({data.answers.length})</TabsTrigger>
                <TabsTrigger value="priorities"><Target className="h-4 w-4 mr-1" />Priorities ({data.priorities.length})</TabsTrigger>
                <TabsTrigger value="alignment"><TrendingUp className="h-4 w-4 mr-1" />Alignment ({data.alignments.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity ({data.activity.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="tracked" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Tracked Members</h4>
                  {data.trackedMembers.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                    <div className="space-y-1">
                      {data.trackedMembers.map((m) => (
                        <Link key={m.id} to={`/member/${m.id}`} className="flex justify-between text-sm px-3 py-2 rounded border hover:bg-muted">
                          <span>{m.full_name}</span>
                          <span className="text-xs text-muted-foreground">{m.party} · {m.state}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Tracked Bills</h4>
                  {data.trackedBills.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                    <div className="space-y-1">
                      {data.trackedBills.map((b) => (
                        <Link key={b.id} to={`/bill/${b.id}`} className="flex justify-between gap-3 text-sm px-3 py-2 rounded border hover:bg-muted">
                          <span className="truncate">{b.title || b.bill_number}</span>
                          <Badge variant="outline" className="shrink-0">{b.bill_number}</Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="answers">
                {data.answers.length === 0 ? <p className="text-xs text-muted-foreground">No quiz answers yet.</p> : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {data.answers.map((a, i) => (
                        <div key={i} className="border rounded p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">{a.issue_name}</Badge>
                            <Badge className={a.answer_value > 0 ? "bg-green-500/20 text-green-700" : a.answer_value < 0 ? "bg-red-500/20 text-red-700" : ""}>
                              {answerLabel(a.answer_value)}
                            </Badge>
                          </div>
                          <p className="text-sm">{a.question_text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="priorities">
                {data.priorities.length === 0 ? <p className="text-xs text-muted-foreground">No priorities set.</p> : (
                  <div className="space-y-1">
                    {data.priorities.sort((a, b) => b.priority_level - a.priority_level).map((p, i) => (
                      <div key={i} className="flex justify-between border rounded px-3 py-2 text-sm">
                        <span>{p.issue_name}</span>
                        <Badge>Priority {p.priority_level}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="alignment">
                {data.alignments.length === 0 ? <p className="text-xs text-muted-foreground">No alignments computed. User may not have completed the quiz.</p> : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-1">
                      {data.alignments.map((a) => (
                        <Link key={a.politician_id} to={`/member/${a.politician_id}`} className="flex justify-between text-sm px-3 py-2 rounded border hover:bg-muted">
                          <span>{a.full_name} <span className="text-xs text-muted-foreground">({a.party} · {a.state})</span></span>
                          <Badge>{Math.round(a.overall_alignment)}%</Badge>
                        </Link>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="activity">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {data.activity.map((a, i) => (
                      <div key={i} className="border rounded px-3 py-2 text-sm flex justify-between gap-2">
                        <div>
                          <Badge variant="outline" className="mr-2">{a.activity_type}</Badge>
                          {a.description}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
