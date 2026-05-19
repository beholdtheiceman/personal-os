"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types";
import type { NotificationSettings, NotificationCategory } from "@/types";
import {
  RiNotificationLine, RiNotificationOffLine, RiSunLine, RiFireLine,
  RiCheckboxLine, RiFlag2Line, RiBookLine, RiHeartPulseLine, RiBarChartLine,
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
    hasTime: false,
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
];

function fmt12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const { permission, token, enable } = useNotifications();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, `users/${user.uid}/settings/notifications`)).then((snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...(snap.data() as Partial<NotificationSettings>) });
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
      // Store timezone with every enabled category
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const withTz: NotificationSettings = Object.fromEntries(
        Object.entries(settings).map(([k, v]) => [k, v.enabled ? { ...v, timezone: tz } : v])
      ) as NotificationSettings;
      await setDoc(doc(db, `users/${user.uid}/settings/notifications`), withTz);
      toast.success("Notification settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
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
          {permission !== "granted" && permission !== "denied" && permission !== "unsupported" && (
            <button onClick={enable} className="btn-primary text-sm py-1.5 px-4">
              Enable
            </button>
          )}
          {permission === "granted" && (
            <span className="text-xs text-success bg-success/10 px-2 py-1 rounded-lg">Active</span>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="card space-y-1">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Notification Types</p>
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
                      className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${
                        cat.enabled ? "bg-accent" : "bg-bg-border"
                      } ${permission !== "granted" ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        cat.enabled ? "translate-x-5" : "translate-x-0.5"
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
