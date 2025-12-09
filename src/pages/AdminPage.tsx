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
import { Loader2, Users, Database, Bot, RefreshCw, Shield, Trash2 } from "lucide-react";
import { Helmet } from "react-helmet";

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string | null;
}

interface SyncProgress {
  id: string;
  status: string | null;
  last_run_at: string | null;
  total_processed: number | null;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [triggeringSyncId, setTriggeringSyncId] = useState<string | null>(null);

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
      fetchSyncProgress();
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

  const fetchSyncProgress = async () => {
    setIsLoadingSync(true);
    try {
      const { data, error } = await supabase
        .from("sync_progress")
        .select("*")
        .order("id");

      if (error) throw error;
      setSyncProgress(data || []);
    } catch (error) {
      console.error("Error fetching sync progress:", error);
    } finally {
      setIsLoadingSync(false);
    }
  };

  const triggerSync = async (syncType: string) => {
    setTriggeringSyncId(syncType);
    try {
      const functionName = `sync-${syncType}`;
      const { error } = await supabase.functions.invoke(functionName);

      if (error) throw error;

      toast({
        title: "Sync Triggered",
        description: `${syncType} sync has been started.`,
      });

      // Refresh sync progress after triggering
      setTimeout(fetchSyncProgress, 2000);
    } catch (error) {
      console.error("Error triggering sync:", error);
      toast({
        title: "Error",
        description: `Failed to trigger ${syncType} sync`,
        variant: "destructive",
      });
    } finally {
      setTriggeringSyncId(null);
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

          <Tabs defaultValue="users" className="w-full">
            <TabsList className="mb-6">
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
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div>
                            <p className="font-medium">{user.display_name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
                            </p>
                          </div>
                          <Badge variant="secondary">User</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Data Synchronization</span>
                    <Button variant="outline" size="sm" onClick={fetchSyncProgress} disabled={isLoadingSync}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingSync ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </CardTitle>
                  <CardDescription>Manage and trigger data sync operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {["congress-members", "bills", "votes", "fec-finance"].map((syncType) => {
                      const progress = syncProgress.find((s) => s.id === syncType);
                      return (
                        <Card key={syncType} className="border-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg capitalize">
                              {syncType.replace(/-/g, " ")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                              <p>Status: {progress?.status || "Unknown"}</p>
                              <p>
                                Last run:{" "}
                                {progress?.last_run_at
                                  ? new Date(progress.last_run_at).toLocaleString()
                                  : "Never"}
                              </p>
                              <p>Processed: {progress?.total_processed?.toLocaleString() || 0}</p>
                            </div>
                            <Button
                              onClick={() => triggerSync(syncType)}
                              disabled={triggeringSyncId === syncType}
                              className="w-full"
                            >
                              {triggeringSyncId === syncType ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Running...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Trigger Sync
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
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
