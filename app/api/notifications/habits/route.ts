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
      if (!habit.reminder_enabled || !habit.reminder_time) continue;

      // Convert current UTC time to the habit's stored timezone
      const tz = (habit.reminder_timezone as string | undefined) ?? "America/New_York";
      const localTimeStr = now.toLocaleTimeString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
      const [localH, localM] = localTimeStr.split(":").map(Number);
      const localMinutes = localH * 60 + localM;

      const [rh, rm] = (habit.reminder_time as string).split(":").map(Number);
      const reminderMinutes = rh * 60 + rm;
      if (Math.abs(localMinutes - reminderMinutes) > 30) continue;

      // Today's date in the user's timezone
      const todayLocal = now.toLocaleDateString("en-CA", { timeZone: tz }); // "YYYY-MM-DD"

      // Check not already completed today
      const completions: string[] = habit.completions ?? [];
      if (completions.includes(todayLocal)) continue;

      // Check target days (use local day-of-week)
      const localDay = new Date(now.toLocaleString("en-US", { timeZone: tz })).getDay();
      const targetDays: number[] = habit.target_days ?? [0,1,2,3,4,5,6];
      if (!targetDays.includes(localDay)) continue;

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
