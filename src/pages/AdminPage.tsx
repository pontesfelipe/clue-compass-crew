import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Database, Bot, RefreshCw, Shield, Trash2, BarChart3 } from "lucide-react";
import { Helmet } from "react-helmet";
import { SyncStatusCard } from "@/components/admin/SyncStatusCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "moderator" | "user";
  created_at: string | null;
}


interface AnalyticsData {
  userSignups: { date: string; count: number }[];
  dataCounts: { name: string; count: number }[];
  aiSummaries: { date: string; count: number }[];
  totals: {
    members: number;
    bills: number;
    votes: number;
    users: number;
    aiSummaries: number;
  };
}

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);

  // AI Chat state
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && !authLoading) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access this page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, adminLoading, authLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchUserRoles();
      fetchAnalytics();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");

      if (error) throw error;
      setUserRoles((data || []) as UserRole[]);
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      // Fetch all data in parallel
      const [profilesRes, membersRes, billsRes, votesRes, summariesRes] = await Promise.all([
        supabase.from("profiles").select("created_at"),
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("bills").select("id", { count: "exact", head: true }),
        supabase.from("votes").select("id", { count: "exact", head: true }),
        supabase.from("member_summaries").select("generated_at"),
      ]);

      // Process user signups by date (last 30 days)
      const signupsByDate = new Map<string, number>();
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        signupsByDate.set(date.toISOString().split("T")[0], 0);
      }

      (profilesRes.data || []).forEach((profile) => {
        if (profile.created_at) {
          const date = profile.created_at.split("T")[0];
          if (signupsByDate.has(date)) {
            signupsByDate.set(date, (signupsByDate.get(date) || 0) + 1);
          }
        }
      });

      const userSignups = Array.from(signupsByDate.entries()).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      }));

      // Process AI summaries by date (last 30 days)
      const summariesByDate = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        summariesByDate.set(date.toISOString().split("T")[0], 0);
      }

      (summariesRes.data || []).forEach((summary) => {
        if (summary.generated_at) {
          const date = summary.generated_at.split("T")[0];
          if (summariesByDate.has(date)) {
            summariesByDate.set(date, (summariesByDate.get(date) || 0) + 1);
          }
        }
      });

      const aiSummaries = Array.from(summariesByDate.entries()).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      }));

      // Data counts for pie chart
      const dataCounts = [
        { name: "Members", count: membersRes.count || 0 },
        { name: "Bills", count: billsRes.count || 0 },
        { name: "Votes", count: votesRes.count || 0 },
        { name: "AI Summaries", count: summariesRes.data?.length || 0 },
      ];

      setAnalytics({
        userSignups,
        dataCounts,
        aiSummaries,
        totals: {
          members: membersRes.count || 0,
          bills: billsRes.count || 0,
          votes: votesRes.count || 0,
          users: profilesRes.data?.length || 0,
          aiSummaries: summariesRes.data?.length || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const getUserRole = (userId: string): "admin" | "moderator" | "user" | null => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || null;
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "moderator" | "user" | "none") => {
    setUpdatingRoleUserId(userId);
    try {
      const existingRole = userRoles.find((r) => r.user_id === userId);

      if (newRole === "none") {
        // Remove the role
        if (existingRole) {
          const { error } = await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", userId);

          if (error) throw error;
        }
      } else if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      toast({
        title: "Role Updated",
        description: `User role has been ${newRole === "none" ? "removed" : `set to ${newRole}`}.`,
      });

      fetchUserRoles();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const handleAiSubmit = async () => {
    if (!aiInput.trim() || isAiLoading) return;

    const userMessage = { role: "user" as const, content: aiInput };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput("");
    setIsAiLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: [...aiMessages, userMessage] }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "AI request failed");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        let textBuffer = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setAiMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: assistantContent } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: assistantContent }];
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error("AI chat error:", error);
      toast({
        title: "AI Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | CivicScore</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container mx-auto py-8 px-4">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="font-serif text-3xl font-bold">Admin Dashboard</h1>
          </div>

          <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="sync" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Sync
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI Assistant
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analytics">
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Users</CardDescription>
                      <CardTitle className="text-3xl">
                        {isLoadingAnalytics ? <Loader2 className="h-6 w-6 animate-spin" /> : analytics?.totals.users || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Congress Members</CardDescription>
                      <CardTitle className="text-3xl">
                        {isLoadingAnalytics ? <Loader2 className="h-6 w-6 animate-spin" /> : analytics?.totals.members.toLocaleString() || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Bills Tracked</CardDescription>
                      <CardTitle className="text-3xl">
                        {isLoadingAnalytics ? <Loader2 className="h-6 w-6 animate-spin" /> : analytics?.totals.bills.toLocaleString() || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Votes Recorded</CardDescription>
                      <CardTitle className="text-3xl">
                        {isLoadingAnalytics ? <Loader2 className="h-6 w-6 animate-spin" /> : analytics?.totals.votes.toLocaleString() || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>AI Summaries</CardDescription>
                      <CardTitle className="text-3xl">
                        {isLoadingAnalytics ? <Loader2 className="h-6 w-6 animate-spin" /> : analytics?.totals.aiSummaries || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>User Signups (Last 30 Days)</span>
                        <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoadingAnalytics}>
                          <RefreshCw className={`h-4 w-4 ${isLoadingAnalytics ? "animate-spin" : ""}`} />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAnalytics ? (
                        <div className="flex justify-center py-16">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={analytics?.userSignups || []}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))", 
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px"
                              }} 
                            />
                            <Area 
                              type="monotone" 
                              dataKey="count" 
                              stroke="hsl(var(--primary))" 
                              fill="hsl(var(--primary) / 0.2)" 
                              name="Signups"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>AI Summaries Generated (Last 30 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAnalytics ? (
                        <div className="flex justify-center py-16">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={analytics?.aiSummaries || []}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))", 
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px"
                              }} 
                            />
                            <Bar dataKey="count" fill="hsl(var(--chart-2))" name="Summaries" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Data Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Distribution</CardTitle>
                    <CardDescription>Overview of tracked congressional data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingAnalytics ? (
                      <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                        <ResponsiveContainer width={300} height={250}>
                          <PieChart>
                            <Pie
                              data={analytics?.dataCounts || []}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="count"
                              nameKey="name"
                            >
                              {(analytics?.dataCounts || []).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))", 
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px"
                              }}
                              formatter={(value: number) => value.toLocaleString()}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="grid gap-2">
                          {(analytics?.dataCounts || []).map((item, index) => (
                            <div key={item.name} className="flex items-center gap-3">
                              <div 
                                className="w-4 h-4 rounded" 
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} 
                              />
                              <span className="text-sm font-medium">{item.name}</span>
                              <span className="text-sm text-muted-foreground ml-auto">
                                {item.count.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>User Management</span>
                    <Button variant="outline" size="sm" onClick={fetchUsers} disabled={isLoadingUsers}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingUsers ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </CardTitle>
                  <CardDescription>View and manage registered users</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingUsers ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No users found</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map((user) => {
                        const currentRole = getUserRole(user.user_id);
                        const isUpdating = updatingRoleUserId === user.user_id;
                        
                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{user.display_name || "No name"}</p>
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              <p className="text-xs text-muted-foreground">
                                Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={currentRole || "none"}
                                onValueChange={(value) => 
                                  handleRoleChange(user.user_id, value as "admin" | "moderator" | "user" | "none")
                                }
                                disabled={isUpdating}
                              >
                                <SelectTrigger className="w-32">
                                  {isUpdating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <SelectValue placeholder="No role" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No role</SelectItem>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="moderator">Moderator</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              {currentRole && (
                                <Badge 
                                  variant={
                                    currentRole === "admin" 
                                      ? "default" 
                                      : currentRole === "moderator" 
                                        ? "secondary" 
                                        : "outline"
                                  }
                                >
                                  {currentRole}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync">
              <SyncStatusCard />
            </TabsContent>

            <TabsContent value="ai">
              <Card className="h-[600px] flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    AI Assistant (Unlimited)
                  </CardTitle>
                  <CardDescription>
                    Ask questions about CivicScore data, get insights, or get help with admin tasks
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-auto space-y-4 mb-4 p-4 rounded-lg bg-muted/50">
                    {aiMessages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation with the AI assistant</p>
                        <p className="text-sm mt-2">
                          Ask about member scores, voting patterns, or data analysis
                        </p>
                      </div>
                    ) : (
                      aiMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-card border"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {isAiLoading && aiMessages[aiMessages.length - 1]?.role === "user" && (
                      <div className="flex justify-start">
                        <div className="bg-card border p-3 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAiSubmit()}
                      placeholder="Ask the AI assistant..."
                      className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isAiLoading}
                    />
                    <Button onClick={handleAiSubmit} disabled={isAiLoading || !aiInput.trim()}>
                      {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                    </Button>
                    {aiMessages.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setAiMessages([])}
                        disabled={isAiLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        <Footer />
      </div>
    </>
  );
}
