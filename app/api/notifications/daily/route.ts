// Daily notification dispatcher — called by Vercel cron
// Checks each user's notification_settings and fires enabled categories
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import {
  morningBriefingHandler, streakAlertHandler, taskReminderHandler,
  goalDeadlineHandler, journalReminderHandler, healthReminderHandler, weeklyReviewHandler,
} from "@/lib/notification-handlers";
import type { NotificationSettings, NotificationCategory } from "@/types";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types";

export async function GET(req: NextRequest) {
  const cronSecret = getEnv("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const now = new Date();
  const results: Record<string, string[]> = {};
  const usersSnap = await db.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const fired: string[] = [];

    const settingsDoc = await db.doc(`users/${uid}/settings/notifications`).get();
    const settings: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(settingsDoc.data() as Partial<NotificationSettings> ?? {}),
    };

    const tokensSnap = await db.collection(`users/${uid}/fcm_tokens`).get();
    if (tokensSnap.empty) continue;

    const tz = getTimezone(settings);
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

    const send = async (title: string, body: string, tag: string) => {
      await fetch(`${baseUrl}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cronSecret}` },
        body: JSON.stringify({ uid, title, body, tag }),
      });
      fired.push(tag);
    };

    if (isDue(settings.morning_briefing, now, tz)) {
      const n = await morningBriefingHandler(uid, tz);
      if (n) await send(n.title, n.body, n.tag ?? "morning-briefing");
    }
    if (isDue(settings.streak_alert, now, tz)) {
      const n = await streakAlertHandler(uid, tz);
      if (n) await send(n.title, n.body, n.tag ?? "streak-alert");
    }
    if (isDue(settings.task_reminder, now, tz)) {
      const n = await taskReminderHandler(uid, tz);
      if (n) await send(n.title, n.body, n.tag ?? "task-reminder");
    }
    if (isDue(settings.goal_deadline, now, tz)) {
      const n = await goalDeadlineHandler(uid, tz, settings.goal_deadline.days_before ?? 3);
      if (n) await send(n.title, n.body, n.tag ?? "goal-deadline");
    }
    if (isDue(settings.journal_reminder, now, tz)) {
      const n = await journalReminderHandler(uid, tz);
      if (n) await send(n.title, n.body, n.tag ?? "journal-reminder");
    }
    if (isDue(settings.health_reminder, now, tz)) {
      const n = await healthReminderHandler(uid, tz);
      if (n) await send(n.title, n.body, n.tag ?? "health-reminder");
    }
    if (isDue(settings.weekly_review, now, tz)) {
      const localDay = new Date(now.toLocaleString("en-US", { timeZone: tz })).getDay();
      if (localDay === (settings.weekly_review.day_of_week ?? 0)) {
        const n = await weeklyReviewHandler(uid, tz);
        if (n) await send(n.title, n.body, n.tag ?? "weekly-review");
      }
    }

    if (fired.length > 0) results[uid] = fired;
  }

  return NextResponse.json({ checked: usersSnap.size, fired: results });
}

function isDue(cat: NotificationCategory, now: Date, tz: string): boolean {
  if (!cat.enabled || !cat.time) return false;
  const localStr = now.toLocaleTimeString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
  const [lh, lm] = localStr.split(":").map(Number);
  const [rh, rm] = cat.time.split(":").map(Number);
  return Math.abs(lh * 60 + lm - (rh * 60 + rm)) <= 15;
}

function getTimezone(settings: NotificationSettings): string {
  return (Object.values(settings) as NotificationCategory[]).find((c) => c.timezone)?.timezone ?? "America/New_York";
}