"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { requestAndSaveToken, removeToken, registerServiceWorker } from "@/lib/firebase-messaging";

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [token, setToken] = useState<string | null>(null);

  // Register SW on mount (browser only)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    registerServiceWorker();
  }, []);

  // If already granted and user logged in, quietly grab token
  useEffect(() => {
    if (!user || permission !== "granted") return;
    requestAndSaveToken(user.uid).then((t) => { if (t) setToken(t); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, permission]);

  const enable = useCallback(async () => {
    if (!user) return;
    const t = await requestAndSaveToken(user.uid);
    setToken(t);
    setPermission(Notification.permission);
  }, [user]);

  const disable = useCallback(async () => {
    if (!user || !token) return;
    await removeToken(user.uid, token);
    setToken(null);
  }, [user, token]);

  return { permission, token, enable, disable };
}
