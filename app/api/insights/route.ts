// POST /api/insights — generate + persist today's AI insight for one user (ID token auth)
// GET  /api/insights — cron trigger (CRON_SECRET auth) — runs for all users
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import { getUserLocalDate } from "@/lib/timezone";

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function isCronAuthed(req: NextRequest): boolean {
  return (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}

async function getUidFromToken(req: NextRequest): Promise<string | null> {
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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

async function collectData(uid: string, today: string) {
  const db = getAdminDb();
  const cutoff = daysAgo(30);
  const sources: string[] = [];

  // ── Mood ────────────────────────────────────────────────────────────────────
  const moodSnap = await db.collection(`users/${uid}/mood`)
    .where("date", ">=", cutoff).orderBy("date", "asc").get();
  const moodData = moodSnap.docs.map((d) => ({ date: d.data().date as string, score: d.data().score as number }));
  if (moodData.length >= 3) sources.push("mood");

  // ── Health logs (sleep, steps, energy, heart rate) ───────────────────────
  const healthSnap = await db.collection(`users/${uid}/health_logs`)
    .where("date", ">=", cutoff).orderBy("date", "asc").get();
  const healthData = healthSnap.docs.map((d) => {
    const h = d.data();
    return { date: h.date as string, sleep_hours: h.sleep_hours, energy: h.energy_level, steps: h.steps, heart_rate: h.resting_heart_rate };
  });
  if (healthData.length >= 3) sources.push("sleep/health");

  // ── Hydration ────────────────────────────────────────────────────────────
  const hydSnap = await db.collection(`users/${uid}/hydration_logs`)
    .where("date", ">=", cutoff).orderBy("date", "asc").get();
  const hydData = hydSnap.docs.map((d) => ({ date: d.data().date as string, oz: d.data().total_oz as number, goal: d.data().goal_oz as number }));
  if (hydData.length >= 5) sources.push("hydration");

  // ── Habits ───────────────────────────────────────────────────────────────
  const habitsSnap = await db.collection(`users/${uid}/habits`).get();
  interface HabitStats { name: string; streak: number; completionRate30d: number; }
  const habitStats: HabitStats[] = [];
  for (const d of habitsSnap.docs) {
    const h = d.data();
    const completions: string[] = h.completions ?? [];
    const last30 = completions.filter((c) => c >= cutoff);
    if (last30.length > 0) {
      habitStats.push({ name: h.name as string, streak: h.streak ?? 0, completionRate30d: Math.round((last30.length / 30) * 100) });
    }
  }
  if (habitStats.length > 0) sources.push("habits");

  // ── Workouts ─────────────────────────────────────────────────────────────
  const workoutSnap = await db.collection(`users/${uid}/workout_logs`)
    .where("date", ">=", cutoff).orderBy("date", "asc").get();
  const workoutData = workoutSnap.docs.map((d) => ({ date: d.data().date as string, type: d.data().type, duration_min: d.data().duration_min }));
  if (workoutData.length >= 2) sources.push("workouts");

  // ── Nutrition (avg macros over period) ──────────────────────────────────
  const nutritionSnap = await db.collection(`users/${uid}/nutrition_logs`)
    .where("date", ">=", cutoff).orderBy("date", "asc").get();
  const nutritionData = nutritionSnap.docs.map((d) => {
    const n = d.data();
    return { date: n.date as string, calories: n.total_calories, protein_g: n.total_protein_g, carbs_g: n.total_carbs_g, fat_g: n.total_fat_g };
  });
  if (nutritionData.length >= 3) sources.push("nutrition");

  // ── Time logs (by category) ──────────────────────────────────────────────
  const timeSnap = await db.collection(`users/${uid}/time_entries`)
    .where("start_time", ">=", new Date(cutoff).toISOString()).get();
  const timeCats: Record<string, number> = {};
  for (const d of timeSnap.docs) {
    const t = d.data();
    const cat = (t.category as string) || "Other";
    const dur = (t.duration_minutes as number) || 0;
    timeCats[cat] = (timeCats[cat] ?? 0) + dur;
  }
  const timeData = Object.entries(timeCats).map(([cat, mins]) => ({ category: cat, hours: Math.round(mins / 60 * 10) / 10 })).sort((a, b) => b.hours - a.hours);
  if (timeData.length > 0) sources.push("time tracking");

  // ── Body metrics ────────────────────────────────────────────────────────
  const bodySnap = await db.collection(`users/${uid}/body_metrics`)
    .where("date", ">=", cutoff).orderBy("date", "asc").get();
  const bodyData = bodySnap.docs.map((d) => ({ date: d.data().date as string, weight: d.data().weight_lbs, body_fat: d.data().body_fat_pct }));
  if (bodyData.length >= 2) sources.push("body metrics");

  return { moodData, healthData, hydData, habitStats, workoutData, nutritionData, timeData, bodyData, sources };
}

async function generateInsight(uid: string, today: string): Promise<{ content: string; sources: string[] }> {
  const data = await collectData(uid, today);

  if (data.sources.length === 0) {
    return { content: "Not enough data yet to surface insights — keep logging your mood, habits, health, and workouts for at least a few days.", sources: [] };
  }

  const sections: string[] = [];

  if (data.moodData.length > 0) {
    const avg = (data.moodData.reduce((s, m) => s + m.score, 0) / data.moodData.length).toFixed(1);
    sections.push(`**Mood (last 30 days, ${data.moodData.length} entries):** Average ${avg}/10. Recent: ${data.moodData.slice(-7).map((m) => `${m.date}: ${m.score}`).join(", ")}`);
  }
  if (data.healthData.length > 0) {
    const withSleep = data.healthData.filter((h) => h.sleep_hours != null);
    const withEnergy = data.healthData.filter((h) => h.energy != null);
    if (withSleep.length > 0) {
      const avgSleep = (withSleep.reduce((s, h) => s + (h.sleep_hours as number), 0) / withSleep.length).toFixed(1);
      sections.push(`**Sleep (${withSleep.length} entries):** Average ${avgSleep} hrs. Recent: ${withSleep.slice(-5).map((h) => `${h.date}: ${h.sleep_hours}h`).join(", ")}`);
    }
    if (withEnergy.length > 0) {
      const avgEnergy = (withEnergy.reduce((s, h) => s + (h.energy as number), 0) / withEnergy.length).toFixed(1);
      sections.push(`**Energy level (${withEnergy.length} entries):** Average ${avgEnergy}/10`);
    }
  }
  if (data.habitStats.length > 0) {
    sections.push(`**Habits:** ${data.habitStats.map((h) => `${h.name} (${h.completionRate30d}% completion, ${h.streak}-day streak)`).join("; ")}`);
  }
  if (data.workoutData.length > 0) {
    sections.push(`**Workouts (last 30d, ${data.workoutData.length} sessions):** ${data.workoutData.slice(-5).map((w) => `${w.date}: ${w.type ?? "workout"} ${w.duration_min ? `(${w.duration_min}m)` : ""}`).join(", ")}`);
  }
  if (data.nutritionData.length > 0) {
    const avgCal = Math.round(data.nutritionData.filter((n) => n.calories).reduce((s, n) => s + (n.calories as number), 0) / Math.max(data.nutritionData.filter((n) => n.calories).length, 1));
    if (avgCal > 0) sections.push(`**Nutrition (${data.nutritionData.length} days logged):** Average ${avgCal} kcal/day`);
  }
  if (data.hydData.length > 0) {
    const goalsHit = data.hydData.filter((h) => h.oz >= h.goal).length;
    sections.push(`**Hydration:** Goal hit ${goalsHit}/${data.hydData.length} days tracked`);
  }
  if (data.timeData.length > 0) {
    sections.push(`**Time (30d categories):** ${data.timeData.slice(0, 5).map((t) => `${t.category} ${t.hours}h`).join(", ")}`);
  }
  if (data.bodyData.length > 0) {
    const first = data.bodyData[0];
    const last = data.bodyData[data.bodyData.length - 1];
    if (first.weight && last.weight) {
      const delta = (last.weight - first.weight).toFixed(1);
      sections.push(`**Body metrics:** Weight ${first.weight} → ${last.weight} lbs (${delta > "0" ? "+" : ""}${delta} lbs over 30d)`);
    }
  }

  const dataContext = sections.join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 600,
    system: `You are a personal AI coach with access to someone's life data. Analyze the data below and surface 3–5 specific, actionable insights about correlations, trends, or patterns.

Be concrete — reference actual numbers. Look for: how sleep affects mood/energy, workout frequency and energy levels, habit consistency and mood, nutrition patterns and energy, hydration and performance.

Format as a tight bullet list. Each insight should start with a bold **keyword** and be 1-2 sentences max. Be encouraging but honest. Today is ${today}.`,
    messages: [{ role: "user", content: `Here is my last 30 days of data:\n\n${dataContext}\n\nWhat are the most important patterns and correlations you see?` }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";
  return { content, sources: data.sources };
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const today = await getUserLocalDate(uid);

  try {
    const { content, sources } = await generateInsight(uid, today);
    const insight = { id: today, date: today, content, data_sources: sources, generated_at: new Date().toISOString() };
    await db.doc(`users/${uid}/ai_insights/${today}`).set(insight);
    return NextResponse.json({ success: true, insight });
  } catch (err) {
    console.error("[insights] error:", err);
    return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();

  // Find all users
  const usersSnap = await db.collection("users").get();
  const results: { uid: string; status: string }[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    try {
      const today = await getUserLocalDate(uid);

      // Only generate once per day
      const existing = await db.doc(`users/${uid}/ai_insights/${today}`).get();
      if (existing.exists) {
        results.push({ uid, status: "skipped (already generated)" });
        continue;
      }

      const { content, sources } = await generateInsight(uid, today);
      if (content) {
        const insight = { id: today, date: today, content, data_sources: sources, generated_at: new Date().toISOString() };
        await db.doc(`users/${uid}/ai_insights/${today}`).set(insight);
        results.push({ uid, status: "generated" });
      } else {
        results.push({ uid, status: "skipped (no data)" });
      }
    } catch (err) {
      console.error(`[insights] error for ${uid}:`, err);
      results.push({ uid, status: `error: ${String(err)}` });
    }
  }

  return NextResponse.json({ ok: true, results });
}
