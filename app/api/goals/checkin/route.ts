// POST /api/goals/checkin — Claude gives a motivating check-in for a single goal (UI-triggered)
// GET  /api/goals/checkin — Vercel cron (0 9 * * *): nudges users about stale active goals
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, getEnv } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase-admin";
import { getLocalTimeInfo } from "@/lib/timezone";
import { sendPushToUser } from "@/lib/send-push";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types";
import type { NotificationSettings } from "@/types";

// ── Cron: inactive goal nudge ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cronSecret = getEnv("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const notified: string[] = [];
  const INACTIVE_DAYS = 14;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    // Compute week key in user's local timezone — server runs UTC on Vercel.
    const timeInfo = await getLocalTimeInfo(uid);
    const daysToMonday = timeInfo.localDayOfWeek === 0 ? -6 : 1 - timeInfo.localDayOfWeek;
    const monday = new Date(timeInfo.localDate + "T12:00:00Z");
    monday.setUTCDate(monday.getUTCDate() + daysToMonday);
    const weekKey = monday.toISOString().slice(0, 10);

    // Skip users with no push tokens
    const tokensSnap = await db.collection(`users/${uid}/fcm_tokens`).get();
    if (tokensSnap.empty) continue;

    // Respect user notification preference
    const settingsDoc = await db.doc(`users/${uid}/settings/notifications`).get();
    const settings: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(settingsDoc.data() as Partial<NotificationSettings> ?? {}),
    };
    if (!settings.goal_inactivity.enabled) continue;

    // Find active goals that haven't been touched in INACTIVE_DAYS
    const goalsSnap = await db.collection(`users/${uid}/goals`)
      .where("status", "==", "active")
      .get();
    if (goalsSnap.empty) continue;

    const stale: string[] = [];
    for (const goalDoc of goalsSnap.docs) {
      // updateTime is Firestore's native last-write timestamp
      const lastWrite = goalDoc.updateTime?.toDate()
        ?? new Date((goalDoc.data().created_at as string));
      const daysSince = Math.floor((Date.now() - lastWrite.getTime()) / 86_400_000);
      if (daysSince >= INACTIVE_DAYS) {
        stale.push(goalDoc.data().title as string);
      }
    }
    if (stale.length === 0) continue;

    // Dedup: one nudge per user per week
    const dedupRef = db.doc(`users/${uid}/notification_sent/goal_inactivity_${weekKey}`);
    if ((await dedupRef.get()).exists) continue;
    await dedupRef.set({ sent_at: new Date().toISOString(), goals: stale });

    const title = "🎯 Goal check-in";
    const body = stale.length === 1
      ? `"${stale[0]}" hasn't had any progress in ${INACTIVE_DAYS}+ days`
      : `${stale.length} goals need attention — "${stale[0]}" and ${stale.length - 1} more`;

    await sendPushToUser(uid, { title, body, tag: "goal-inactivity" });
    notified.push(uid);
  }

  return NextResponse.json({ checked: usersSnap.size, notified });
}

// ── On-demand: AI motivating message for a single goal (called from GoalCard) ─
export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { title, description, milestones, target_date } = await req.json();

    const completed = milestones?.filter((m: { completed: boolean }) => m.completed).length ?? 0;
    const total = milestones?.length ?? 0;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Give a brief, motivating check-in for this goal. Be direct and specific.

Goal: ${title}
Description: ${description || "none"}
Progress: ${completed}/${total} milestones completed
Target date: ${target_date || "not set"}

Reply in 2-3 sentences. Acknowledge progress, give one concrete next action. No fluff.`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ message: text });
  } catch (err) {
    console.error("Goal check-in error:", err);
    return NextResponse.json({ error: "Failed to get check-in" }, { status: 500 });
  }
}
