// Per-habit reminder dispatcher — called by Vercel cron (hourly).
// Fires individual habit reminders based on each habit's own reminder_enabled +
// reminder_times fields. This is SEPARATE from /api/notifications/daily, which
// sends category-level summaries (streak alerts, morning briefing, etc.).
// Neither route duplicates the other.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import { getLocalTimeInfo, isHour } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  const cronSecret = getEnv("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const notified: string[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const habitsSnap = await db.collection(`users/${uid}/habits`).get();
    if (habitsSnap.empty) continue;

    // One timezone read per user — reused across all habit checks
    const timeInfo = await getLocalTimeInfo(uid);
    const { localDayOfWeek, localDate } = timeInfo;

    const tokensSnap = await db.collection(`users/${uid}/fcm_tokens`).get();
    if (tokensSnap.empty) continue;

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

    for (const habitDoc of habitsSnap.docs) {
      const habit = habitDoc.data();
      if (!habit.reminder_enabled) continue;

      const reminderTimes: string[] = habit.reminder_times?.length
        ? (habit.reminder_times as string[])
        : habit.reminder_time ? [habit.reminder_time as string] : [];
      if (reminderTimes.length === 0) continue;

      // Check if any reminder time matches the current local hour
      const isDue = reminderTimes.some((t) => isHour(timeInfo, t));
      if (!isDue) continue;

      // Check target days (local day of week)
      const targetDays: number[] = habit.target_days ?? [0, 1, 2, 3, 4, 5, 6];
      if (!targetDays.includes(localDayOfWeek)) continue;

      // Skip if already completed today (in user's local timezone)
      const skipIfDone = habit.skip_if_done !== false;
      const completions: string[] = habit.completions ?? [];
      if (skipIfDone && completions.includes(localDate)) continue;

      await fetch(`${baseUrl}/api/notifications/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          uid,
          title: "⏰ Habit Reminder",
          body: `Don't forget: ${habit.name}`,
          tag: `habit-${habitDoc.id}`,
        }),
      });

      notified.push(`${uid}:${habit.name}`);
    }
  }

  return NextResponse.json({ checked: usersSnap.size, notified });
}
