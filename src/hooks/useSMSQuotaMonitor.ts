import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LOW_QUOTA_THRESHOLD = 100;
const CRITICAL_QUOTA_THRESHOLD = 50;
const NOTIFICATION_COOLDOWN = 3600000; // 1 hour in milliseconds

export const useSMSQuotaMonitor = () => {
  const { userRole } = useAuth();
  const [permissionGranted, setPermissionGranted] = useState(false);
  // Use refs to avoid stale closure issues
  const lastNotificationTimeRef = useRef<number>(0);
  const permissionGrantedRef = useRef<boolean>(false);

  // Keep refs in sync with state
  useEffect(() => {
    permissionGrantedRef.current = permissionGranted;
  }, [permissionGranted]);

  const showNotification = useCallback((
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
  }, []);

  const checkQuota = useCallback(async () => {
    if (!permissionGrantedRef.current) return;

    // Check if we're in cooldown period
    const now = Date.now();
    if (now - lastNotificationTimeRef.current < NOTIFICATION_COOLDOWN) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("get-textbelt-quota");

      if (error) {
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
          lastNotificationTimeRef.current = now;
        } else if (quotaRemaining <= LOW_QUOTA_THRESHOLD) {
          showNotification(
            "⚠️ Warning: Low SMS Credits",
            `${quotaRemaining} SMS credits remaining. Consider topping up soon.`,
            "warning"
          );
          lastNotificationTimeRef.current = now;
        }
      }
    } catch {
      // Quota check errors are non-critical
    }
  }, [showNotification]);

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

    // Initial quota check (with small delay to ensure permission state is set)
    const initialCheckTimeout = setTimeout(() => checkQuota(), 100);

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
      clearTimeout(initialCheckTimeout);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userRole, checkQuota]);

  return { permissionGranted };
};
