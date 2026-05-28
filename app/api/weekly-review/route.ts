// Weekly Review — generates a structured AI review of the past week
// GET  → Vercel cron (CRON_SECRET auth) — runs for all users every Sunday
// POST → Manual trigger (Firebase ID token auth) — single user
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import { format, startOfWeek, subDays } from "date-fns";
import { getLocalTimeInfo, isHour } from "@/lib/timezone";
import { getSeasonContext } from "@/lib/season";
import { updateLifeContext } from "@/lib/life-context";
import type { NotificationSettings } from "@/types";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types";

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

  // Personal Constitution (for alignment analysis)
  let constitutionContent: string | null = null;
  try {
    const constitutionSnap = await db.doc(`users/${uid}/constitution/main`).get();
    if (constitutionSnap.exists && constitutionSnap.data()?.interview_complete) {
      constitutionContent = (constitutionSnap.data()?.content as string) ?? null;
    }
  } catch { /* no constitution yet */ }

  // Time entries this week (by category)
  let timeSummary: string | null = null;
  try {
    const timeSnap = await db
      .collection(`users/${uid}/time_entries`)
      .where("date", ">=", weekStart)
      .where("date", "<=", weekEnd)
      .get();
    if (!timeSnap.empty) {
      const byCategory: Record<string, number> = {};
      timeSnap.docs.forEach((d) => {
        const cat = (d.data().category as string) || "Uncategorized";
        byCategory[cat] = (byCategory[cat] ?? 0) + ((d.data().duration_min as number) ?? 0);
      });
      timeSummary = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, mins]) => `${cat}: ${(mins / 60).toFixed(1)}h`)
        .join(", ");
    }
  } catch { /* time tracker not used */ }

  // Spending this week — merge manual + Plaid transactions
  let spendSummary: string | null = null;
  let totalWeekSpend: number | null = null;
  try {
    const PLAID_LABELS: Record<string, string> = {
      INCOME: "Income", TRANSFER_IN: "Transfer In", TRANSFER_OUT: "Transfer Out",
      LOAN_PAYMENTS: "Loan Payments", BANK_FEES: "Bank Fees", ENTERTAINMENT: "Entertainment",
      FOOD_AND_DRINK: "Food & Drink", GENERAL_MERCHANDISE: "Shopping", HOME_IMPROVEMENT: "Home",
      MEDICAL: "Medical", PERSONAL_CARE: "Personal Care", GENERAL_SERVICES: "Services",
      GOVERNMENT_AND_NON_PROFIT: "Government", TRANSPORTATION: "Transportation",
      TRAVEL: "Travel", RENT_AND_UTILITIES: "Utilities",
    };
    const byCategory: Record<string, number> = {};
    const [txSnap, plaidSnap] = await Promise.all([
      db.collection(`users/${uid}/transactions`)
        .where("date", ">=", weekStart).where("date", "<=", weekEnd).get(),
      db.collection(`users/${uid}/plaid_transactions`)
        .where("date", ">=", weekStart).where("date", "<=", weekEnd).get(),
    ]);
    txSnap.docs.forEach((d) => {
      const tx = d.data();
      if (tx.type === "expense") {
        const cat = (tx.category as string) || "Uncategorized";
        byCategory[cat] = (byCategory[cat] ?? 0) + ((tx.amount as number) ?? 0);
      }
    });
    plaidSnap.docs.forEach((d) => {
      const tx = d.data();
      if ((tx.amount as number) > 0) {
        const cat = PLAID_LABELS[tx.category as string] ?? (tx.category as string) ?? "Uncategorized";
        byCategory[cat] = (byCategory[cat] ?? 0) + (tx.amount as number);
      }
    });
    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (entries.length) {
      totalWeekSpend = entries.reduce((s, [, v]) => s + v, 0);
      spendSummary = entries.map(([cat, amt]) => `${cat}: $${amt.toFixed(0)}`).join(", ");
    }
  } catch { /* no transactions */ }

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
    constitutionContent,
    timeSummary,
    spendSummary,
    totalWeekSpend,
  };
}

// ─── Review generation ────────────────────────────────────────────────────────

async function generateReview(uid: string, weekStart: string): Promise<{ content: string; dataSummary: string }> {
  // Week is Mon–Sun
  const weekEnd = (() => {
    const d = new Date(weekStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  const [data, seasonCtx] = await Promise.all([
    collectWeekData(uid, weekStart, weekEnd),
    getSeasonContext(uid),
  ]);

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
${data.timeSummary ? `\nTIME LOGGED BY CATEGORY:\n${data.timeSummary}` : ""}
${data.spendSummary ? `\nSPENDING THIS WEEK (${data.totalWeekSpend != null ? `$${data.totalWeekSpend.toFixed(0)} total` : ""}):\n${data.spendSummary}` : ""}

ABOUT ME:
${data.memoryLines.slice(0, 15).join("\n")}
${seasonCtx ? `\nCURRENT LIFE SEASON:\n${seasonCtx}` : ""}
`.trim();

  const alignmentInstructions = data.constitutionContent
    ? `
PERSONAL CONSTITUTION (the user's stated values, mission, and non-negotiables):
---
${data.constitutionContent.slice(0, 3000)}
---

ALIGNMENT SECTION INSTRUCTIONS:
Before the other sections, write an alignment analysis. Cross-reference the Personal Constitution above against this week's actual behavioral data (habits, health, time logged, spending, tasks, journal). Ask two questions: (1) How aligned was this week with the stated values? (2) Where was the biggest gap?

Rules for the alignment section:
- Start with an alignment score on its own line: 🟢 Well-aligned, 🟡 Some drift, or 🔴 Significant gap
- Then 1–3 specific, honest observations referencing actual data (e.g. "You listed faith as a top value, but no spiritual habits were logged this week" or "Your mission includes financial health — your spending data shows dining at $X, worth watching")
- Frame as honest observations from someone who wants you to win, not as judgment or a score to optimize
- If the data genuinely supports alignment, say so — don't manufacture criticism
- If insufficient data exists to make a specific observation about a value, skip it
- Keep the whole alignment section to 3–6 lines

`
    : "";

  const sectionFormat = data.constitutionContent
    ? `## ⚖️ Alignment
[alignment score and observations]

## ✅ Wins
2–4 bullet points of genuine wins — tasks completed, habit streaks, health, anything positive. Be specific.

## ⚠️ Gaps
2–3 bullet points of honest gaps or patterns to watch. Don't soften it, but don't pile on.

## 💡 Insight
1–2 sentences: one meaningful observation about the week — a pattern, connection, or thing worth reflecting on.

## 🎯 Focus for Next Week
3 bullet points: specific, actionable priorities for the coming week based on what's open and what matters.`
    : `## ✅ Wins
2–4 bullet points of genuine wins — tasks completed, habit streaks, health, anything positive. Be specific.

## ⚠️ Gaps
2–3 bullet points of honest gaps or patterns to watch. Don't soften it, but don't pile on.

## 💡 Insight
1–2 sentences: one meaningful observation about the week — a pattern, connection, or thing worth reflecting on.

## 🎯 Focus for Next Week
3 bullet points: specific, actionable priorities for the coming week based on what's open and what matters.`;

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: `You are a personal AI coach writing a weekly review for the user. Be warm, direct, and honest. Reference specific data points. Don't be generic or sycophantic. Keep the whole review under 500 words.${seasonCtx ? " The user has named their current life season — let that context shape the framing and tone of the review. What counts as a good week in a recovery season looks nothing like a good week in a focused sprint." : ""}`,
    messages: [
      {
        role: "user",
        content: `Here's my data for the week. Write my weekly review with these sections using markdown:
${alignmentInstructions}
${sectionFormat}

---
${context}`,
      },
    ],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  return { content, dataSummary: context };
}

// ─── Per-user runner ──────────────────────────────────────────────────────────

async function runForUser(uid: string, fromCron = false): Promise<{ uid: string; status: string }> {
  const db = getAdminDb();
  const reviewRef = db.doc(`users/${uid}/weekly_reviews/latest`);

  try {
    // When called from the hourly cron, check that it's Sunday at the right local hour
    if (fromCron) {
      const timeInfo = await getLocalTimeInfo(uid);
      if (timeInfo.localDayOfWeek !== 0) {
        return { uid, status: "skipped (not Sunday)" };
      }
      const settingsDoc = await db.doc(`users/${uid}/settings/notifications`).get();
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(settingsDoc.data() as Partial<NotificationSettings> ?? {}),
      };
      const preferredTime = settings.weekly_review.time ?? "09:00";
      if (!isHour(timeInfo, preferredTime)) {
        return { uid, status: `skipped (not ${preferredTime} local)` };
      }
    }

    // Derive last completed week start (most recent Monday in local time)
    const timeInfo = await getLocalTimeInfo(uid);
    const localDay = timeInfo.localDayOfWeek; // 0=Sun
    const localDate = new Date(timeInfo.localDate + "T12:00:00");
    const diff = localDay === 0 ? -6 : 1 - localDay;
    localDate.setDate(localDate.getDate() + diff);
    const weekStart = localDate.toISOString().slice(0, 10);

    // Skip if already generated for this week
    const existing = await reviewRef.get();
    if (existing.exists && existing.data()?.week_start === weekStart) {
      return { uid, status: "skipped (already generated)" };
    }

    const { content, dataSummary } = await generateReview(uid, weekStart);

    await reviewRef.set({
      week_start: weekStart,
      content,
      generated_at: new Date().toISOString(),
    });

    // Update longitudinal memory in the background — fire-and-forget, never blocks the review
    void updateLifeContext(uid, dataSummary, content);

    return { uid, status: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await reviewRef.set({ last_error: msg, last_error_at: new Date().toISOString() }, { merge: true });
    return { uid, status: `error: ${msg}` };
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// GET — Vercel cron (hourly); handler checks local Sunday + preferred time per user
export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  // Find all users with at least one memory entry (proxy for "active users")
  const usersSnap = await db.collectionGroup("memory").get();
  const uids = [...new Set(usersSnap.docs.map((d) => d.ref.path.split("/")[1]))];

  const results = await Promise.all(uids.map((uid) => runForUser(uid, true)));
  return NextResponse.json({ processed: results.length, results });
}

// POST — manual trigger from dashboard (no day/hour check)
export async function POST(req: NextRequest) {
  const uid = await getUidFromIdToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runForUser(uid, false);
  return NextResponse.json(result);
}
