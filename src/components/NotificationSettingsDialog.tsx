import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Settings, AlertCircle } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NotificationSettingsDialogProps {
  trigger?: React.ReactNode;
}

export function NotificationSettingsDialog({ trigger }: NotificationSettingsDialogProps) {
  const { user } = useAuth();
  const { preferences, isLoading, updatePreferences, isUpdating } = useNotificationPreferences();

  if (!user) {
    return null;
  }

  const defaultPrefs = {
    vote_notifications: preferences?.vote_notifications ?? true,
    bill_notifications: preferences?.bill_notifications ?? true,
    score_change_notifications: preferences?.score_change_notifications ?? true,
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="civic-outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Notification Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </DialogTitle>
          <DialogDescription>
            Choose which updates you want to receive about tracked members.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            Email notifications are coming soon. For now, check your tracked members page for updates.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <p className="text-sm font-medium text-muted-foreground">Track These Activities</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="vote_notifications">Vote Activity</Label>
                  <p className="text-xs text-muted-foreground">When tracked members cast votes</p>
                </div>
                <Switch
                  id="vote_notifications"
                  checked={defaultPrefs.vote_notifications}
                  onCheckedChange={(checked) => updatePreferences({ vote_notifications: checked })}
                  disabled={isUpdating}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="bill_notifications">Bill Sponsorships</Label>
                  <p className="text-xs text-muted-foreground">When they sponsor or co-sponsor bills</p>
                </div>
                <Switch
                  id="bill_notifications"
                  checked={defaultPrefs.bill_notifications}
                  onCheckedChange={(checked) => updatePreferences({ bill_notifications: checked })}
                  disabled={isUpdating}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="score_change_notifications">Score Changes</Label>
                  <p className="text-xs text-muted-foreground">When their CivicScore changes significantly</p>
                </div>
                <Switch
                  id="score_change_notifications"
                  checked={defaultPrefs.score_change_notifications}
                  onCheckedChange={(checked) => updatePreferences({ score_change_notifications: checked })}
                  disabled={isUpdating}
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
