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
import { Loader2, Users, Database, RefreshCw, Shield, BarChart3, Search, ToggleLeft } from "lucide-react";
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
  const { toggles, isLoading: isLoadingToggles, updateToggle, fetchToggles } = useFeatureToggles();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [updatingToggleId, setUpdatingToggleId] = useState<string | null>(null);

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
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="font-serif text-3xl font-bold">Admin Dashboard</h1>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/data-inspector">
                <Search className="h-4 w-4 mr-2" />
                Data Inspector
              </Link>
            </Button>
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
          </Tabs>
        </main>

        <Footer />
      </div>
    </>
  );
}
