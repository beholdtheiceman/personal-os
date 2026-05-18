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
  const todayUTC = now.toISOString().slice(0, 10);

  // Get all users
  const usersSnap = await db.collection("users").get();
  const notified: string[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const habitsSnap = await db.collection(`users/${uid}/habits`).get();

    for (const habitDoc of habitsSnap.docs) {
      const habit = habitDoc.data();
      if (!habit.reminder_enabled || !habit.reminder_time) continue;

      // Check time window (within 30 min of scheduled time)
      const [rh, rm] = (habit.reminder_time as string).split(":").map(Number);
      const reminderMinutes = rh * 60 + rm;
      const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      if (Math.abs(nowMinutes - reminderMinutes) > 30) continue;

      // Check not already completed today
      const completions: string[] = habit.completions ?? [];
      if (completions.includes(todayUTC)) continue;

      // Check target days
      const targetDays: number[] = habit.target_days ?? [0,1,2,3,4,5,6];
      if (!targetDays.includes(now.getUTCDay())) continue;

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
