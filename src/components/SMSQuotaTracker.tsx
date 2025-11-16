import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, MessageSquare, TrendingUp, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuotaData {
  quotaRemaining: number;
  success: boolean;
}

interface UsageStats {
  totalSent: number;
  sentToday: number;
  sentThisWeek: number;
  sentThisMonth: number;
  failedCount: number;
}

export const SMSQuotaTracker = () => {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const { toast } = useToast();

  useEffect(() => {
    fetchQuotaAndUsage();
    
    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const fetchQuotaAndUsage = async () => {
    try {
      setLoading(true);

      // Fetch Textbelt quota
      const { data: quotaData, error: quotaError } = await supabase.functions.invoke(
        "get-textbelt-quota"
      );

      if (quotaError) throw quotaError;
      setQuota(quotaData);

      // Fetch usage statistics from sms_logs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const { data: allLogs, error: logsError } = await supabase
        .from("sms_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (logsError) throw logsError;

      const stats: UsageStats = {
        totalSent: allLogs?.filter(log => log.status === "sent").length || 0,
        sentToday: allLogs?.filter(log => 
          log.status === "sent" && new Date(log.created_at) >= today
        ).length || 0,
        sentThisWeek: allLogs?.filter(log => 
          log.status === "sent" && new Date(log.created_at) >= weekAgo
        ).length || 0,
        sentThisMonth: allLogs?.filter(log => 
          log.status === "sent" && new Date(log.created_at) >= monthAgo
        ).length || 0,
        failedCount: allLogs?.filter(log => log.status === "failed").length || 0,
      };

      setUsage(stats);

      // Show alert if quota is low
      if (quotaData.quotaRemaining < 100) {
        toast({
          title: "Low SMS Credits",
          description: `Only ${quotaData.quotaRemaining} credits remaining. Please top up your Textbelt account.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching quota and usage:", error);
      toast({
        title: "Error",
        description: "Failed to fetch SMS quota and usage data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isLowBalance = quota && quota.quotaRemaining < 100;
  const isCriticalBalance = quota && quota.quotaRemaining < 50;

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === "granted") {
        toast({
          title: "Notifications Enabled",
          description: "You'll receive browser notifications when SMS quota is low.",
        });
      } else {
        toast({
          title: "Notifications Blocked",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Quota & Usage
          </CardTitle>
          <CardDescription>
            Monitor your Textbelt API usage and remaining credits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* Notification Permission Banner */}
              {notificationPermission === "default" && (
                <Alert>
                  <Bell className="h-4 w-4" />
                  <AlertTitle>Enable Low Quota Alerts</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>Get browser notifications when SMS credits run low</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={requestNotificationPermission}
                    >
                      Enable Notifications
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {notificationPermission === "denied" && (
                <Alert variant="destructive">
                  <BellOff className="h-4 w-4" />
                  <AlertTitle>Notifications Blocked</AlertTitle>
                  <AlertDescription>
                    Browser notifications are blocked. Enable them in your browser settings to receive low quota alerts.
                  </AlertDescription>
                </Alert>
              )}

              {notificationPermission === "granted" && (
                <Alert>
                  <Bell className="h-4 w-4" />
                  <AlertTitle>Real-time Alerts Enabled</AlertTitle>
                  <AlertDescription>
                    You'll receive browser notifications when quota drops below 100 credits (warning) or 50 credits (critical).
                  </AlertDescription>
                </Alert>
              )}

              {/* Quota Alert */}
              {isCriticalBalance && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Critical: Very Low Credits</AlertTitle>
                  <AlertDescription>
                    Only {quota.quotaRemaining} SMS credits remaining. Please top up immediately to avoid service interruption.
                  </AlertDescription>
                </Alert>
              )}
              
              {isLowBalance && !isCriticalBalance && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning: Low Credits</AlertTitle>
                  <AlertDescription>
                    {quota.quotaRemaining} SMS credits remaining. Consider topping up your Textbelt account soon.
                  </AlertDescription>
                </Alert>
              )}

              {/* Remaining Credits */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Remaining Credits</span>
                  <span className="text-2xl font-bold">
                    {quota?.quotaRemaining || 0}
                  </span>
                </div>
                <Progress 
                  value={quota?.quotaRemaining ? Math.min((quota.quotaRemaining / 3000) * 100, 100) : 0} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  Showing credits out of standard 3,000 quota
                </p>
              </div>

              {/* Usage Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="text-xs">Today</CardDescription>
                    <CardTitle className="text-2xl">{usage?.sentToday || 0}</CardTitle>
                  </CardHeader>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="text-xs">This Week</CardDescription>
                    <CardTitle className="text-2xl">{usage?.sentThisWeek || 0}</CardTitle>
                  </CardHeader>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="text-xs">This Month</CardDescription>
                    <CardTitle className="text-2xl">{usage?.sentThisMonth || 0}</CardTitle>
                  </CardHeader>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription className="text-xs">Total Sent</CardDescription>
                    <CardTitle className="text-2xl">{usage?.totalSent || 0}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Failed Messages */}
              {usage && usage.failedCount > 0 && (
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertTitle>Failed Messages</AlertTitle>
                  <AlertDescription>
                    {usage.failedCount} SMS messages failed to send. Check logs for details.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
