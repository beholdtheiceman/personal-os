"use client";
import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export const DASHBOARD_WIDGETS: { id: string; label: string }[] = [
  { id: "xp",                   label: "XP / Level" },
  { id: "quick_links",          label: "Quick Links" },
  { id: "daily_briefing",       label: "AI Briefing" },
  { id: "insights",             label: "AI Insights" },
  { id: "decision_review",      label: "Decision Reviews" },
  { id: "birthday",             label: "Upcoming Birthdays" },
  { id: "verse",                label: "Verse of the Day" },
  { id: "tasks_habits",         label: "Tasks & Habits" },
  { id: "hydration_mood",       label: "Hydration & Mood" },
  { id: "calendar_nutrition",   label: "Calendar & Nutrition" },
  { id: "health_journal",       label: "Health & Journal" },
  { id: "goals_projects",       label: "Goals & Projects" },
  { id: "finance",              label: "Finance Summary" },
  { id: "budget_savings",       label: "Budget & Savings" },
  { id: "weekly_review",        label: "Weekly Review" },
  { id: "api_usage",            label: "API Usage" },
  { id: "email_agent",          label: "Email Agent" },
  { id: "unsubscribe",          label: "Unsubscribe Manager" },
  { id: "gmail",                label: "Gmail Inbox" },
  { id: "achievements",         label: "Achievements" },
];

export const DEFAULT_WIDGET_ORDER = DASHBOARD_WIDGETS.map((w) => w.id);

export interface DashboardSettings {
  widgetOrder: string[];
  hiddenWidgets: string[];
}

export function useDashboardSettings() {
  const { user } = useAuth();
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, `users/${user.uid}/settings/dashboard`), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<DashboardSettings>;
        if (data.widgetOrder?.length) {
          // Keep saved order, append any new widgets not yet in the saved list
          const saved = data.widgetOrder;
          const newWidgets = DEFAULT_WIDGET_ORDER.filter((id) => !saved.includes(id));
          setWidgetOrder([...saved, ...newWidgets]);
        }
        if (data.hiddenWidgets) {
          setHiddenWidgets(new Set(data.hiddenWidgets));
        }
      }
      setLoaded(true);
    });
  }, [user]);

  const save = useCallback(
    async (order: string[], hidden: Set<string>) => {
      if (!user) return;
      await setDoc(doc(db, `users/${user.uid}/settings/dashboard`), {
        widgetOrder: order,
        hiddenWidgets: [...hidden],
      });
    },
    [user]
  );

  return { widgetOrder, hiddenWidgets, save, loaded };
}
