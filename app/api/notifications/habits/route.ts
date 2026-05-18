import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";

export async function GET(req: NextRequest) {
  const cronSecret = getEnv("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const now = new Date();

  // Get all users
  const usersSnap = await db.collection("users").get();
  const notified: string[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const habitsSnap = await db.collection(`users/${uid}/habits`).get();

    for (const habitDoc of habitsSnap.docs) {
      const habit = habitDoc.data();
      if (!habit.reminder_enabled) continue;

      // Support both new reminder_times array and legacy reminder_time string
      const reminderTimes: string[] = habit.reminder_times?.length
        ? (habit.reminder_times as string[])
        : habit.reminder_time ? [habit.reminder_time as string] : [];
      if (reminderTimes.length === 0) continue;

      // Convert current UTC time to the habit's stored timezone
      const tz = (habit.reminder_timezone as string | undefined) ?? "America/New_York";
      const localTimeStr = now.toLocaleTimeString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
      const [localH, localM] = localTimeStr.split(":").map(Number);
      const localMinutes = localH * 60 + localM;

      // Check if any reminder time falls within a 15-min window of now
      const isDue = reminderTimes.some((t) => {
        const [rh, rm] = t.split(":").map(Number);
        return Math.abs(localMinutes - (rh * 60 + rm)) <= 15;
      });
      if (!isDue) continue;

      // Today's date in the user's timezone
      const todayLocal = now.toLocaleDateString("en-CA", { timeZone: tz });

      // Check target days (use local day-of-week)
      const localDay = new Date(now.toLocaleString("en-US", { timeZone: tz })).getDay();
      const targetDays: number[] = habit.target_days ?? [0,1,2,3,4,5,6];
      if (!targetDays.includes(localDay)) continue;

      // For non-completion habits (like water), skip the completion check
      // For regular habits, skip if already done today
      const skipIfDone = habit.skip_if_done !== false; // default true
      const completions: string[] = habit.completions ?? [];
      if (skipIfDone && completions.includes(todayLocal)) continue;

      // Check user has tokens
      const tokensSnap = await db.collection(`users/${uid}/fcm_tokens`).get();
      if (tokensSnap.empty) continue;

      // Send via internal send endpoint
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      await fetch(`${baseUrl}/api/notifications/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          uid,
          title: `⏰ Habit Reminder`,
          body: `Don't forget: ${habit.name}`,
          tag: `habit-${habitDoc.id}`,
        }),
      });

      notified.push(`${uid}:${habit.name}`);
    }
  }

  return NextResponse.json({ checked: usersSnap.size, notified });
}
