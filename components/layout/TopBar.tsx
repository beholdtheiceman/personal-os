"use client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { RiBellLine, RiBellFill } from "react-icons/ri";
import toast from "react-hot-toast";

function getGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const first = name?.split(" ")[0] ?? "there";
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export default function TopBar() {
  const { user } = useAuth();
  const today = new Date();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // Check if notifications already registered
  useEffect(() => {
    if (typeof window === "undefined") return;
    setNotifEnabled(Notification.permission === "granted");
  }, []);

  const toggleNotifications = async () => {
    if (!user) return;
    setNotifLoading(true);
    try {
      if (notifEnabled) {
        await fetch("/api/notifications/register", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid }),
        });
        setNotifEnabled(false);
        toast.success("Notifications disabled");
      } else {
        const { registerForPushNotifications } = await import("@/lib/fcm");
        const token = await registerForPushNotifications();
        if (!token) {
          toast.error("Notification permission denied");
          return;
        }
        await fetch("/api/notifications/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid, token }),
        });
        setNotifEnabled(true);
        toast.success("Notifications enabled!");
      }
    } catch (err) {
      console.error("Notification toggle error:", err);
      toast.error("Failed to update notifications");
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-bg-border bg-bg-secondary shrink-0">
      <div>
        <p className="text-sm font-medium text-text-primary">
          {getGreeting(user?.displayName ?? null)}
        </p>
        <p className="text-xs text-text-secondary">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleNotifications}
          disabled={notifLoading}
          title={notifEnabled ? "Disable notifications" : "Enable notifications"}
          className={`p-1.5 rounded-lg transition-colors ${
            notifEnabled
              ? "text-accent hover:bg-accent/10"
              : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
          }`}
        >
          {notifEnabled
            ? <RiBellFill className="w-5 h-5" />
            : <RiBellLine className="w-5 h-5" />
          }
        </button>
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Connected" />
        <span className="text-xs text-text-muted hidden sm:block">Live</span>
      </div>
    </header>
  );
}
