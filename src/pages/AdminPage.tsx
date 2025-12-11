import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useFeatureToggles } from "@/hooks/useFeatureToggles";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Database, RefreshCw, Shield, BarChart3, Search, ToggleLeft, FileSearch, Pencil, Trash2, Activity, Brain } from "lucide-react";
import { Helmet } from "react-helmet";
import { SyncStatusCard } from "@/components/admin/SyncStatusCard";
import { DataInspectorContent } from "@/components/admin/DataInspectorContent";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { UserActivityLog } from "@/components/admin/UserActivityLog";
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
  first_name: string | null;
  last_name: string | null;
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
  aiUsageByDate: { date: string; member_summary: number; bill_impact: number; issue_classification: number; admin_chat: number }[];
  aiUsageByType: { name: string; count: number; successRate: number }[];
  totals: {
    members: number;
    bills: number;
    votes: number;
    users: number;
    totalAiCalls: number;
    totalTokens: number;
  };
}

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const { toggles, isLoading: isLoadingToggles, updateToggle, fetchToggles } = useFeatureToggles();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [updatingToggleId, setUpdatingToggleId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

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
      const [profilesRes, membersRes, billsRes, votesRes, aiUsageRes] = await Promise.all([
        supabase.from("profiles").select("created_at"),
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("bills").select("id", { count: "exact", head: true }),
        supabase.from("votes").select("id", { count: "exact", head: true }),
        supabase.from("ai_usage_log").select("*").order("created_at", { ascending: false }),
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

      // Process AI usage by date (last 30 days)
      const aiUsageByDateMap = new Map<string, { member_summary: number; bill_impact: number; issue_classification: number; admin_chat: number }>();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        aiUsageByDateMap.set(date.toISOString().split("T")[0], { member_summary: 0, bill_impact: 0, issue_classification: 0, admin_chat: 0 });
      }

      // Count AI usage by type
      const aiUsageByTypeMap = new Map<string, { count: number; success: number; tokens: number }>();
      
      (aiUsageRes.data || []).forEach((log: any) => {
        const opType = log.operation_type || 'unknown';
        
        // Count by type
        if (!aiUsageByTypeMap.has(opType)) {
          aiUsageByTypeMap.set(opType, { count: 0, success: 0, tokens: 0 });
        }
        const typeStats = aiUsageByTypeMap.get(opType)!;
        typeStats.count++;
        if (log.success) typeStats.success++;
        if (log.tokens_used) typeStats.tokens += log.tokens_used;
        
        // Count by date
        if (log.created_at) {
          const date = log.created_at.split("T")[0];
          if (aiUsageByDateMap.has(date)) {
            const dayStats = aiUsageByDateMap.get(date)!;
            if (opType === 'member_summary') dayStats.member_summary++;
            else if (opType === 'bill_impact') dayStats.bill_impact++;
            else if (opType === 'issue_classification') dayStats.issue_classification++;
            else if (opType === 'admin_chat') dayStats.admin_chat++;
          }
        }
      });

      const aiUsageByDate = Array.from(aiUsageByDateMap.entries()).map(([date, stats]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        ...stats
      }));

      const operationLabels: Record<string, string> = {
        member_summary: "Member Summaries",
        bill_impact: "Bill Impacts",
        issue_classification: "Issue Classification",
        admin_chat: "Admin Chat"
      };

      const aiUsageByType = Array.from(aiUsageByTypeMap.entries()).map(([type, stats]) => ({
        name: operationLabels[type] || type,
        count: stats.count,
        successRate: stats.count > 0 ? Math.round((stats.success / stats.count) * 100) : 0,
      }));

      // Calculate totals
      const totalAiCalls = (aiUsageRes.data || []).length;
      const totalTokens = (aiUsageRes.data || []).reduce((sum: number, log: any) => sum + (log.tokens_used || 0), 0);

      // Data counts for pie chart
      const dataCounts = [
        { name: "Members", count: membersRes.count || 0 },
        { name: "Bills", count: billsRes.count || 0 },
        { name: "Votes", count: votesRes.count || 0 },
      ];

      setAnalytics({
        userSignups,
        dataCounts,
        aiUsageByDate,
        aiUsageByType,
        totals: {
          members: membersRes.count || 0,
          bills: billsRes.count || 0,
          votes: votesRes.count || 0,
          users: profilesRes.data?.length || 0,
          totalAiCalls,
          totalTokens,
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

  const handleRoleChange = async (userId: string, newRole: "admin" | "user" | "none") => {
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

  const handleToggleChange = async (toggleId: string, enabled: boolean) => {
    setUpdatingToggleId(toggleId);
    const success = await updateToggle(toggleId, enabled);
    if (success) {
      toast({
        title: "Feature Updated",
        description: `Feature has been ${enabled ? "enabled" : "disabled"}.`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update feature toggle",
        variant: "destructive",
      });
    }
    setUpdatingToggleId(null);
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
              <TabsTrigger value="features" className="flex items-center gap-2">
                <ToggleLeft className="h-4 w-4" />
                Features
              </TabsTrigger>
              <TabsTrigger value="inspector" className="flex items-center gap-2">
                <FileSearch className="h-4 w-4" />
                Data Inspector
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Log
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
                      <CardDescription>Total AI Calls</CardDescription>
                      <CardTitle className="text-3xl">
                        {isLoadingAnalytics ? <Loader2 className="h-6 w-6 animate-spin" /> : analytics?.totals.totalAiCalls.toLocaleString() || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* AI Usage Summary Cards */}
                {analytics?.aiUsageByType && analytics.aiUsageByType.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        AI Usage by Operation Type
                      </CardTitle>
                      <CardDescription>Breakdown of AI operations across all features</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {analytics.aiUsageByType.map((item) => (
                          <div key={item.name} className="p-4 rounded-lg border bg-card">
                            <div className="text-sm text-muted-foreground">{item.name}</div>
                            <div className="text-2xl font-bold">{item.count.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.successRate}% success rate
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                      <CardTitle>AI Usage (Last 30 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAnalytics ? (
                        <div className="flex justify-center py-16">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={analytics?.aiUsageByDate || []}>
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
                            <Bar dataKey="member_summary" fill="hsl(var(--primary))" name="Member Summaries" stackId="a" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="bill_impact" fill="hsl(var(--chart-2))" name="Bill Impacts" stackId="a" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="issue_classification" fill="hsl(var(--chart-3))" name="Issue Classification" stackId="a" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="admin_chat" fill="hsl(var(--chart-4))" name="Admin Chat" stackId="a" radius={[4, 4, 0, 0]} />
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
                                value={currentRole || "user"}
                                onValueChange={(value) => 
                                  handleRoleChange(user.user_id, value as "admin" | "user" | "none")
                                }
                                disabled={isUpdating}
                              >
                                <SelectTrigger className="w-28">
                                  {isUpdating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <SelectValue placeholder="User" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setEditingUser(user)}
                                title="Edit user"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingUser(user)}
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

            <TabsContent value="features">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ToggleLeft className="h-5 w-5" />
                      Feature Toggles
                    </span>
                    <Button variant="outline" size="sm" onClick={fetchToggles} disabled={isLoadingToggles}>
                      <RefreshCw className={`h-4 w-4 ${isLoadingToggles ? "animate-spin" : ""}`} />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Enable or disable features across the platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingToggles ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : toggles.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No feature toggles found</p>
                  ) : (
                    <div className="space-y-4">
                      {toggles.map((toggle) => (
                        <div
                          key={toggle.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{toggle.label}</p>
                              <Badge variant={toggle.enabled ? "default" : "secondary"}>
                                {toggle.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </div>
                            {toggle.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {toggle.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {updatingToggleId === toggle.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Switch
                                checked={toggle.enabled}
                                onCheckedChange={(checked) => handleToggleChange(toggle.id, checked)}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inspector">
              <DataInspectorContent />
            </TabsContent>

            <TabsContent value="activity">
              <UserActivityLog />
            </TabsContent>
          </Tabs>
        </main>

        <Footer />
      </div>

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSuccess={fetchUsers}
      />

      <DeleteUserDialog
        user={deletingUser}
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        onSuccess={fetchUsers}
      />
    </>
  );
}
