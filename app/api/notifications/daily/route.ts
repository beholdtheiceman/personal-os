// Daily notification dispatcher — called by Vercel cron (hourly)
// Checks each user's notification_settings and fires enabled categories
// whose configured time matches the user's current local hour.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import {
  morningBriefingHandler, streakAlertHandler, taskReminderHandler,
  goalDeadlineHandler, journalReminderHandler, healthReminderHandler, weeklyReviewHandler,
} from "@/lib/notification-handlers";
import { getLocalTimeInfo, isHour } from "@/lib/timezone";
import type { NotificationSettings } from "@/types";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types";

export async function GET(req: NextRequest) {
  const cronSecret = getEnv("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
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

    // One Firestore read for timezone info; reuse for all category checks
    const timeInfo = await getLocalTimeInfo(uid);
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

    const send = async (title: string, body: string, tag: string) => {
      await fetch(`${baseUrl}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cronSecret}` },
        body: JSON.stringify({ uid, title, body, tag }),
      });
      fired.push(tag);
    };

    if (settings.morning_briefing.enabled && settings.morning_briefing.time && isHour(timeInfo, settings.morning_briefing.time)) {
      const n = await morningBriefingHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "morning-briefing");
    }
    if (settings.streak_alert.enabled && settings.streak_alert.time && isHour(timeInfo, settings.streak_alert.time)) {
      const n = await streakAlertHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "streak-alert");
    }
    if (settings.task_reminder.enabled && settings.task_reminder.time && isHour(timeInfo, settings.task_reminder.time)) {
      const n = await taskReminderHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "task-reminder");
    }
    if (settings.goal_deadline.enabled && settings.goal_deadline.time && isHour(timeInfo, settings.goal_deadline.time)) {
      const n = await goalDeadlineHandler(uid, timeInfo.tz, settings.goal_deadline.days_before ?? 3);
      if (n) await send(n.title, n.body, n.tag ?? "goal-deadline");
    }
    if (settings.journal_reminder.enabled && settings.journal_reminder.time && isHour(timeInfo, settings.journal_reminder.time)) {
      const n = await journalReminderHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "journal-reminder");
    }
    if (settings.health_reminder.enabled && settings.health_reminder.time && isHour(timeInfo, settings.health_reminder.time)) {
      const n = await healthReminderHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "health-reminder");
    }
    if (
      settings.weekly_review.enabled && settings.weekly_review.time &&
      isHour(timeInfo, settings.weekly_review.time) &&
      timeInfo.localDayOfWeek === (settings.weekly_review.day_of_week ?? 0)
    ) {
      const n = await weeklyReviewHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "weekly-review");
    }

    if (fired.length > 0) results[uid] = fired;
  }

  return NextResponse.json({ checked: usersSnap.size, fired: results });
}
