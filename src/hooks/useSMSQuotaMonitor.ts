import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LOW_QUOTA_THRESHOLD = 100;
const CRITICAL_QUOTA_THRESHOLD = 50;
const NOTIFICATION_COOLDOWN = 3600000; // 1 hour in milliseconds

export const useSMSQuotaMonitor = () => {
  const { userRole } = useAuth();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);

  useEffect(() => {
    // Only run for admins
    if (userRole !== "admin") return;

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        setPermissionGranted(permission === "granted");
      });
    } else if (Notification.permission === "granted") {
      setPermissionGranted(true);
    }

    // Initial quota check
    checkQuota();

    // Set up realtime subscription to sms_logs to trigger quota checks
    const channel = supabase
      .channel("sms_logs_monitor")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sms_logs",
        },
        () => {
          // Wait a moment for Textbelt to update
          setTimeout(() => checkQuota(), 2000);
        }
      )
      .subscribe();

    // Periodic check every 5 minutes
    const interval = setInterval(checkQuota, 300000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userRole]);

  const checkQuota = async () => {
    if (!permissionGranted) return;

    // Check if we're in cooldown period
    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("get-textbelt-quota");

      if (error) {
        console.error("Error fetching quota:", error);
        return;
      }

      const quotaRemaining = data?.quotaRemaining;

      if (typeof quotaRemaining === "number") {
        if (quotaRemaining <= CRITICAL_QUOTA_THRESHOLD) {
          showNotification(
            "🚨 Critical: SMS Credits Depleted",
            `Only ${quotaRemaining} SMS credits remaining! Service interruption imminent.`,
            "critical"
          );
          setLastNotificationTime(now);
        } else if (quotaRemaining <= LOW_QUOTA_THRESHOLD) {
          showNotification(
            "⚠️ Warning: Low SMS Credits",
            `${quotaRemaining} SMS credits remaining. Consider topping up soon.`,
            "warning"
          );
          setLastNotificationTime(now);
        }
      }
    } catch (error) {
      console.error("Error checking SMS quota:", error);
    }
  };

  const showNotification = (
    title: string,
    body: string,
    type: "warning" | "critical"
  ) => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const notification = new Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: "sms-quota-" + type,
      requireInteraction: type === "critical",
    });

    notification.onclick = () => {
      window.focus();
      // Navigate to notifications page with SMS quota tab
      window.location.hash = "#/notifications";
      notification.close();
    };

    // Auto-close after 10 seconds for warnings
    if (type === "warning") {
      setTimeout(() => notification.close(), 10000);
    }
  };

  return { permissionGranted };
};
