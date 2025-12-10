import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { RefreshCw, Loader2, User, LogIn, Edit, UserPlus, Search } from "lucide-react";
import { format } from "date-fns";

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  description: string | null;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

export function UserActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<Map<string, UserProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data: logsData, error: logsError } = await supabase
        .from("user_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Get unique user IDs
      const userIds = [...new Set((logsData || []).map(log => log.user_id))];
      
      // Fetch user profiles
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, display_name")
          .in("user_id", userIds);

        const usersMap = new Map<string, UserProfile>();
        (profilesData || []).forEach(profile => {
          usersMap.set(profile.user_id, profile);
        });
        setUsers(usersMap);
      }

      setLogs(logsData || []);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "login":
        return <LogIn className="h-4 w-4" />;
      case "signup":
        return <UserPlus className="h-4 w-4" />;
      case "profile_update":
        return <Edit className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getActivityBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case "login":
        return "default";
      case "signup":
        return "secondary";
      case "profile_update":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatMetadata = (metadata: unknown) => {
    if (!metadata || typeof metadata !== "object") return null;
    const metadataObj = metadata as Record<string, unknown>;
    if (Object.keys(metadataObj).length === 0) return null;
    
    const entries = Object.entries(metadataObj);
    return entries.map(([key, value]) => {
      if (typeof value === "object" && value !== null && "old" in value && "new" in value) {
        const typedValue = value as { old: unknown; new: unknown };
        return (
          <span key={key} className="text-xs text-muted-foreground">
            {key}: {String(typedValue.old || "empty")} → {String(typedValue.new || "empty")}
          </span>
        );
      }
      return (
        <span key={key} className="text-xs text-muted-foreground">
          {key}: {String(value)}
        </span>
      );
    });
  };

  const hasMetadata = (metadata: unknown): boolean => {
    return !!metadata && typeof metadata === "object" && Object.keys(metadata as object).length > 0;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const user = users.get(log.user_id);
    const searchLower = searchTerm.toLowerCase();
    return (
      user?.email?.toLowerCase().includes(searchLower) ||
      user?.display_name?.toLowerCase().includes(searchLower) ||
      log.activity_type.toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>User Activity Log</span>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>Recent logins, signups, and profile changes</CardDescription>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No activity logs found</p>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const user = users.get(log.user_id);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-shrink-0 p-2 rounded-full bg-muted">
                      {getActivityIcon(log.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getActivityBadgeVariant(log.activity_type)}>
                          {log.activity_type.replace("_", " ")}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {user?.display_name || user?.email || "Unknown user"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{log.description}</p>
                      {hasMetadata(log.metadata) && (
                        <div className="flex flex-col gap-0.5">
                          {formatMetadata(log.metadata)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(log.created_at), "MMM d, yyyy h:mm a")}</span>
                        {log.ip_address && (
                          <>
                            <span>•</span>
                            <span>IP: {log.ip_address}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
