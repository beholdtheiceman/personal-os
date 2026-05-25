"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { DEFAULT_NOTIFICATION_SETTINGS, mergeNotificationSettings } from "@/types";
import type { NotificationSettings, NotificationCategory } from "@/types";
import {
  RiNotificationLine, RiNotificationOffLine, RiSunLine, RiFireLine,
  RiCheckboxLine, RiFlag2Line, RiBookLine, RiHeartPulseLine, RiBarChartLine,
  RiCake2Line, RiSaveLine, RiTimeLine, RiMoonLine,
  RiBrainLine, RiMoneyDollarCircleLine, RiTimerLine, RiZzzLine, RiRefreshLine,
} from "react-icons/ri";
import toast from "react-hot-toast";

const CATEGORIES: {
  key: keyof NotificationSettings;
  label: string;
  description: string;
  icon: React.ReactNode;
  hasTime: boolean;
  hasDays?: boolean;
}[] = [
  {
    key: "morning_briefing",
    label: "Morning Briefing",
    description: "Daily summary of tasks due, habits to complete, and upcoming events",
    icon: <RiSunLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "streak_alert",
    label: "Streak Alert",
    description: "Notifies you when a habit streak is at risk of breaking",
    icon: <RiFireLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "task_reminder",
    label: "Task Reminder",
    description: "Reminds you of tasks due today and overdue items",
    icon: <RiCheckboxLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "goal_deadline",
    label: "Goal Deadlines",
    description: "Alerts when a goal's target date is approaching",
    icon: <RiFlag2Line className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "journal_reminder",
    label: "Journal Reminder",
    description: "Evening prompt to reflect on your day (skipped if you already journaled)",
    icon: <RiBookLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "health_reminder",
    label: "Health Log Reminder",
    description: "Reminds you to log sleep, energy, and activity (skipped if already logged)",
    icon: <RiHeartPulseLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "weekly_review",
    label: "Weekly Review",
    description: "Sunday summary of your week — habits, tasks, and progress",
    icon: <RiBarChartLine className="w-4 h-4" />,
    hasTime: true,
    hasDays: true,
  },
  {
    key: "birthday_reminder",
    label: "Birthday Reminders",
    description: "Notifies you when a contact's birthday is approaching (based on days_before setting)",
    icon: <RiCake2Line className="w-4 h-4" />,
    hasTime: false,
  },
  {
    key: "savings_milestone",
    label: "Savings Milestones",
    description: "Notifies when a savings goal hits 25%, 50%, 75%, or 100% of its target",
    icon: <RiSaveLine className="w-4 h-4" />,
    hasTime: false,
  },
  {
    key: "progress_midday",
    label: "Mid-Day Progress Check",
    description: "Gentle nudge if you're behind on water, steps, habits, nutrition, or a scheduled workout — silent if you're on track",
    icon: <RiTimeLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "progress_evening",
    label: "Evening Progress Check",
    description: "End-of-day reminder for any targets still unmet — only fires if there's something left to catch up on",
    icon: <RiMoonLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "decision_review",
    label: "Decision Review",
    description: "Notifies you when a decision journal entry is due for review — only fires if reviews are pending",
    icon: <RiBrainLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "networth_reminder",
    label: "Net Worth Check-In",
    description: "Monthly reminder on the 1st to log your net worth snapshot — skipped if you've already logged this month",
    icon: <RiMoneyDollarCircleLine className="w-4 h-4" />,
    hasTime: false,
  },
  {
    key: "time_summary",
    label: "Daily Time Summary",
    description: "End-of-day summary of hours tracked and top categories — only fires if at least 10 minutes were logged",
    icon: <RiTimerLine className="w-4 h-4" />,
    hasTime: true,
  },
  {
    key: "goal_inactivity",
    label: "Goal Inactivity Nudge",
    description: "Weekly reminder when an active goal hasn't had any progress in 14+ days — fires at most once per week",
    icon: <RiZzzLine className="w-4 h-4" />,
    hasTime: false,
  },
];

function fmt12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const { permission, token, enable, disable } = useNotifications();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, `users/${user.uid}/settings/notifications`)).then((snap) => {
      if (snap.exists()) {
        setSettings(mergeNotificationSettings(snap.data()));
      }
      setLoaded(true);
    });
  }, [user]);

  const update = (key: keyof NotificationSettings, patch: Partial<NotificationCategory>) => {
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/notifications`), settings);
      toast.success("Notification settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Register this device for push (also used to re-register / refresh the token).
  const handleEnable = async () => {
    setDeviceBusy(true);
    try {
      await enable();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        toast.success("Notifications enabled on this device");
      } else {
        toast.error("Permission wasn't granted — check your browser settings");
      }
    } catch {
      toast.error("Couldn't enable notifications");
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleReregister = async () => {
    setDeviceBusy(true);
    try {
      await enable(); // re-runs token registration, refreshing this device's fcm_tokens entry
      toast.success("This device was re-registered");
    } catch {
      toast.error("Couldn't re-register this device");
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleDisable = async () => {
    setDeviceBusy(true);
    try {
      await disable();
      toast.success("Notifications disabled on this device");
    } catch {
      toast.error("Couldn't disable notifications");
    } finally {
      setDeviceBusy(false);
    }
  };

  // Fires a real push to this user's devices through the live delivery path.
  const handleTest = async () => {
    if (!user) return;
    setDeviceBusy(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ? `Test failed: ${data.error}` : "Test failed");
      } else if (data.sent > 0) {
        toast.success(`Test notification sent to ${data.sent} device${data.sent > 1 ? "s" : ""}`);
      } else if (data.reason === "No tokens registered") {
        toast.error("No device registered yet — tap Register/Enable first");
      } else {
        toast.error(data.errors?.[0] ? `Send failed: ${data.errors[0]}` : "Send failed — no devices reachable");
      }
    } catch {
      toast.error("Couldn't send test notification");
    } finally {
      setDeviceBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      {/* Permission status */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {permission === "granted"
              ? <RiNotificationLine className="w-5 h-5 text-success" />
              : <RiNotificationOffLine className="w-5 h-5 text-text-muted" />}
            <div>
              <p className="text-sm font-medium text-text-primary">Push Notifications</p>
              <p className="text-xs text-text-muted">
                {permission === "granted" && token ? "Active — device registered" :
                 permission === "granted" ? "Granted — registering device…" :
                 permission === "denied" ? "Blocked in browser settings" :
                 permission === "unsupported" ? "Not supported in this browser" :
                 "Not yet enabled"}
              </p>
            </div>
          </div>
          {/* No token yet (permission default, or granted but not registered) → register */}
          {(permission === "default" || (permission === "granted" && !token)) && (
            <button
              onClick={handleEnable}
              disabled={deviceBusy}
              className="btn-primary text-sm py-1.5 px-4"
            >
              {deviceBusy ? "…" : permission === "granted" ? "Register this device" : "Enable"}
            </button>
          )}
          {/* Active on this device → test, re-register, or disable */}
          {permission === "granted" && token && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleTest}
                disabled={deviceBusy}
                title="Send a test notification to this device"
                className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-50"
              >
                Send test
              </button>
              <button
                onClick={handleReregister}
                disabled={deviceBusy}
                title="Refresh this device's push token"
                className="btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RiRefreshLine className={`w-4 h-4 ${deviceBusy ? "animate-spin" : ""}`} />
                Re-register
              </button>
              <button
                onClick={handleDisable}
                disabled={deviceBusy}
                className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="card space-y-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Notification Types</p>
          <p className="text-xs text-text-muted">
            Times are in{" "}
            <span className="text-text-secondary font-mono">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </p>
        </div>
        {CATEGORIES.map(({ key, label, description, icon, hasTime }) => {
          const cat = settings[key];
          return (
            <div key={key} className="py-3 border-b border-bg-border last:border-0">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${cat.enabled ? "bg-accent/10 text-accent" : "bg-bg-tertiary text-text-muted"}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary">{label}</span>
                    {/* Toggle */}
                    <button
                      onClick={() => update(key, { enabled: !cat.enabled })}
                      disabled={permission !== "granted"}
                      className={`relative inline-flex w-11 h-6 rounded-full transition-colors shrink-0 ${
                        cat.enabled ? "bg-accent" : "bg-gray-300"
                      } ${permission !== "granted" ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        cat.enabled ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{description}</p>

                  {/* Time picker — shown when enabled */}
                  {cat.enabled && hasTime && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-text-secondary">Time:</span>
                      <input
                        type="time"
                        value={cat.time ?? "08:00"}
                        onChange={(e) => update(key, { time: e.target.value })}
                        className="input-base text-xs py-1 px-2"
                      />
                      <span className="text-xs text-text-muted">{fmt12h(cat.time ?? "08:00")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={saving || permission !== "granted"}
        className="btn-primary w-full disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
      {permission !== "granted" && (
        <p className="text-center text-xs text-text-muted">Enable notifications above before saving</p>
      )}
    </div>
  );
}
