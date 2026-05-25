// Daily notification dispatcher — called by Vercel cron (hourly)
// Checks each user's notification_settings and fires enabled categories
// whose configured time matches the user's current local hour.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import {
  morningBriefingHandler, streakAlertHandler, taskReminderHandler,
  goalDeadlineHandler, journalReminderHandler, healthReminderHandler, weeklyReviewHandler,
  birthdayReminderHandler, savingsMilestoneHandler, progressReminderHandler,
  decisionReviewHandler, netWorthReminderHandler, timeSummaryHandler,
} from "@/lib/notification-handlers";
import { getLocalTimeInfo, isHour } from "@/lib/timezone";
import { sendPushToUser } from "@/lib/send-push";
import { mergeNotificationSettings } from "@/types";

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
    const settings = mergeNotificationSettings(settingsDoc.data());

    const tokensSnap = await db.collection(`users/${uid}/fcm_tokens`).get();
    if (tokensSnap.empty) continue;

    // One Firestore read for timezone info; reuse for all category checks
    const timeInfo = await getLocalTimeInfo(uid);

    const send = async (title: string, body: string, tag: string) => {
      await sendPushToUser(uid, { title, body, tag });
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

    // Birthday reminder — fires once per day at morning hour
    if (settings.birthday_reminder.enabled && isHour(timeInfo, settings.morning_briefing.time ?? "07:00")) {
      const n = await birthdayReminderHandler(uid, timeInfo.tz, settings.birthday_reminder.days_before ?? 7);
      if (n) await send(n.title, n.body, n.tag ?? "birthday-reminder");
    }

    // Savings milestone — fires whenever a goal crosses 25/50/75/100%
    if (settings.savings_milestone.enabled) {
      const n = await savingsMilestoneHandler(uid);
      if (n) await send(n.title, n.body, n.tag ?? "savings-milestone");
    }

    // Progress reminders — mid-day and evening checks against daily targets
    // Only fires if actually behind; silently skips if targets are already met
    if (settings.progress_midday.enabled && settings.progress_midday.time && isHour(timeInfo, settings.progress_midday.time)) {
      const n = await progressReminderHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "progress-reminder");
    }
    if (settings.progress_evening.enabled && settings.progress_evening.time && isHour(timeInfo, settings.progress_evening.time)) {
      const n = await progressReminderHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "progress-reminder");
    }

    // Decision review — fires at configured time when pending reviews are due
    if (settings.decision_review.enabled && settings.decision_review.time && isHour(timeInfo, settings.decision_review.time)) {
      const n = await decisionReviewHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "decision-review");
    }

    // Net worth reminder — fires on 1st of month (handler guards the date)
    if (settings.networth_reminder.enabled) {
      const n = await netWorthReminderHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "networth-reminder");
    }

    // End-of-day time summary
    if (settings.time_summary.enabled && settings.time_summary.time && isHour(timeInfo, settings.time_summary.time)) {
      const n = await timeSummaryHandler(uid, timeInfo.tz);
      if (n) await send(n.title, n.body, n.tag ?? "time-summary");
    }

    results[uid] = fired;
  }

  return NextResponse.json({ ok: true, results });
}
