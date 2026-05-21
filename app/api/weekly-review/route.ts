// Weekly Review — generates a structured AI review of the past week
// GET  → Vercel cron (CRON_SECRET auth) — runs for all users every Sunday
// POST → Manual trigger (Firebase ID token auth) — single user
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import { format, startOfWeek, subDays } from "date-fns";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isCronAuthed(req: NextRequest): boolean {
  return (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}

async function getUidFromIdToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    if (token === CRON_SECRET) return null;
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ─── Data collection ──────────────────────────────────────────────────────────

async function collectWeekData(uid: string, weekStart: string, weekEnd: string) {
  const db = getAdminDb();

  // Tasks completed this week
  const tasksSnap = await db.collection(`users/${uid}/tasks`).get();
  const allTasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
  const completedTasks = allTasks.filter((t) => t.status === "completed");
  const activeTasks = allTasks.filter((t) => t.status === "active");

  // Habits — completion rate over the week
  const habitsSnap = await db.collection(`users/${uid}/habits`).get();
  const habits = habitsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];

  // Build list of dates in the week (Mon–Sun)
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    weekDates.push(d.toISOString().slice(0, 10));
  }

  const habitSummaries = habits.map((h) => {
    const completions = (h.completions as string[]) ?? [];
    const doneCount = weekDates.filter((d) => completions.includes(d)).length;
    return `${h.name}: ${doneCount}/7 days`;
  });

  // Journal entries this week
  const journalSnap = await db
    .collection(`users/${uid}/journal`)
    .where("created_at", ">=", weekStart)
    .where("created_at", "<=", weekEnd + "T23:59:59Z")
    .orderBy("created_at", "asc")
    .get();
  const journalEntries = journalSnap.docs.map((d) => d.data());
  const avgMood = journalEntries.length
    ? (journalEntries.reduce((s, e) => s + ((e.mood_score as number) ?? 5), 0) / journalEntries.length).toFixed(1)
    : null;
  const journalSummaries = journalEntries.map((e) =>
    `${(e.created_at as string).slice(0, 10)}: mood ${e.mood_score}/10 — ${e.ai_summary ?? e.content?.slice?.(0, 100) ?? ""}`
  );

  // Health logs this week
  const healthSnap = await db
    .collection(`users/${uid}/health`)
    .where("date", ">=", weekStart)
    .where("date", "<=", weekEnd)
    .get();
  const healthLogs = healthSnap.docs.map((d) => d.data());
  const avgSleep = healthLogs.length
    ? (healthLogs.reduce((s, e) => s + ((e.sleep_hours as number) ?? 0), 0) / healthLogs.length).toFixed(1)
    : null;
  const avgEnergy = healthLogs.length
    ? (healthLogs.reduce((s, e) => s + ((e.energy_level as number) ?? 0), 0) / healthLogs.length).toFixed(1)
    : null;
  const exerciseDays = healthLogs.filter((e) => e.exercise_done).length;

  // Nutrition — avg calories this week
  const nutritionSnap = await db
    .collection(`users/${uid}/nutrition`)
    .where("date", ">=", weekStart)
    .where("date", "<=", weekEnd)
    .get();
  const nutritionLogs = nutritionSnap.docs.map((d) => d.data());
  const totalCals = nutritionLogs.reduce((s, e) => s + ((e.calories_estimated as number) ?? 0), 0);
  const nutritionDays = new Set(nutritionLogs.map((e) => e.date as string)).size;
  const avgCals = nutritionDays > 0 ? Math.round(totalCals / nutritionDays) : null;

  // Goals — milestones completed this week
  const goalsSnap = await db.collection(`users/${uid}/goals`).get();
  const goals = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
  const activeGoals = goals.filter((g) => g.status === "active");

  // Memory for personalization
  const memorySnap = await db.collection(`users/${uid}/memory`).get();
  const memoryLines = memorySnap.docs.map((d) => {
    const data = d.data();
    return `${data.key}: ${data.value}`;
  });

  return {
    weekDates,
    completedTasks: completedTasks.slice(0, 20).map((t) => t.title as string),
    activeTasks: activeTasks.slice(0, 10).map((t) => t.title as string),
    habitSummaries,
    journalSummaries,
    avgMood,
    avgSleep,
    avgEnergy,
    exerciseDays,
    avgCals,
    activeGoals: activeGoals.map((g) => {
      const total = (g.milestones as { completed: boolean }[])?.length ?? 0;
      const done = (g.milestones as { completed: boolean }[])?.filter((m) => m.completed).length ?? 0;
      return `${g.title}: ${done}/${total} milestones`;
    }),
    memoryLines,
  };
}

// ─── Review generation ────────────────────────────────────────────────────────

async function generateReview(uid: string, weekStart: string): Promise<string> {
  // Week is Mon–Sun
  const weekEnd = (() => {
    const d = new Date(weekStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  const data = await collectWeekData(uid, weekStart, weekEnd);

  const context = `
WEEK: ${weekStart} to ${weekEnd}

TASKS COMPLETED (${data.completedTasks.length}):
${data.completedTasks.length ? data.completedTasks.map((t) => `- ${t}`).join("\n") : "None"}

ACTIVE TASKS REMAINING (${data.activeTasks.length}):
${data.activeTasks.length ? data.activeTasks.map((t) => `- ${t}`).join("\n") : "None"}

HABITS:
${data.habitSummaries.length ? data.habitSummaries.join("\n") : "No habits tracked"}

JOURNAL (${data.journalSummaries.length} entries${data.avgMood ? `, avg mood ${data.avgMood}/10` : ""}):
${data.journalSummaries.length ? data.journalSummaries.join("\n") : "No entries this week"}

HEALTH:
${data.avgSleep ? `- Avg sleep: ${data.avgSleep}h` : "- Sleep: not logged"}
${data.avgEnergy ? `- Avg energy: ${data.avgEnergy}/10` : "- Energy: not logged"}
${data.exerciseDays > 0 ? `- Exercised ${data.exerciseDays} day${data.exerciseDays !== 1 ? "s" : ""}` : "- No exercise logged"}
${data.avgCals ? `- Avg calories: ${data.avgCals} kcal/day` : "- Nutrition: not logged"}

GOALS PROGRESS:
${data.activeGoals.length ? data.activeGoals.join("\n") : "No active goals"}

ABOUT ME:
${data.memoryLines.slice(0, 15).join("\n")}
`.trim();

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a personal AI coach writing a weekly review for the user. Be warm, direct, and honest. Reference specific data points. Don't be generic or sycophantic. Keep the whole review under 400 words.`,
    messages: [
      {
        role: "user",
        content: `Here's my data for the week. Write my weekly review with these four sections using markdown:

## ✅ Wins
2–4 bullet points of genuine wins — tasks completed, habit streaks, health, anything positive. Be specific.

## ⚠️ Gaps
2–3 bullet points of honest gaps or patterns to watch. Don't soften it, but don't pile on.

## 💡 Insight
1–2 sentences: one meaningful observation about the week — a pattern, connection, or thing worth reflecting on.

## 🎯 Focus for Next Week
3 bullet points: specific, actionable priorities for the coming week based on what's open and what matters.

---
${context}`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

// ─── Per-user runner ──────────────────────────────────────────────────────────

async function runForUser(uid: string): Promise<{ uid: string; status: string }> {
  const db = getAdminDb();
  const reviewRef = db.doc(`users/${uid}/weekly_reviews/latest`);

  try {
    // Derive last completed week start (most recent Monday at or before today)
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diff);
    const weekStart = monday.toISOString().slice(0, 10);

    // Skip if already generated for this week
    const existing = await reviewRef.get();
    if (existing.exists && existing.data()?.week_start === weekStart) {
      return { uid, status: "skipped (already generated)" };
    }

    const content = await generateReview(uid, weekStart);

    await reviewRef.set({
      week_start: weekStart,
      content,
      generated_at: new Date().toISOString(),
    });

    return { uid, status: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await reviewRef.set({ last_error: msg, last_error_at: new Date().toISOString() }, { merge: true });
    return { uid, status: `error: ${msg}` };
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// GET — Vercel cron (Sunday 6 PM UTC)
export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  // Find all users with at least one memory entry (proxy for "active users")
  const usersSnap = await db.collectionGroup("memory").get();
  const uids = [...new Set(usersSnap.docs.map((d) => d.ref.path.split("/")[1]))];

  const results = await Promise.all(uids.map(runForUser));
  return NextResponse.json({ processed: results.length, results });
}

// POST — manual trigger from dashboard
export async function POST(req: NextRequest) {
  const uid = await getUidFromIdToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runForUser(uid);
  return NextResponse.json(result);
}
