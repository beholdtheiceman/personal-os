import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import type { SeasonMessage } from "@/types";

export const maxDuration = 60;

// ── Data collection ───────────────────────────────────────────────────────────

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function collectRecentPatterns(uid: string): Promise<string> {
  const db = getAdminDb();
  const today = new Date().toISOString().slice(0, 10);
  const fourWeeksAgo = dateNDaysAgo(28);
  const twoWeeksAgo = dateNDaysAgo(14);

  try {
    // ── Health logs ────────────────────────────────────────────────────────
    const healthSnap = await db
      .collection(`users/${uid}/health`)
      .where("date", ">=", fourWeeksAgo)
      .where("date", "<=", today)
      .get();
    const healthLogs = healthSnap.docs.map((d) => d.data());

    const recent = healthLogs.filter((l) => (l.date as string) >= twoWeeksAgo);
    const older  = healthLogs.filter((l) => (l.date as string) <  twoWeeksAgo);

    const avgOf = (arr: Record<string, unknown>[], key: string): number | null =>
      arr.length ? arr.reduce((s, l) => s + ((l[key] as number) ?? 0), 0) / arr.length : null;

    const sleepRecent  = avgOf(recent, "sleep_hours");
    const sleepOlder   = avgOf(older,  "sleep_hours");
    const energyRecent = avgOf(recent, "energy_level");
    const energyOlder  = avgOf(older,  "energy_level");
    const exerciseDays = healthLogs.filter((l) => l.exercise_done).length;
    const exercisePerWeek = (exerciseDays / 4).toFixed(1);

    const trendLabel = (r: number | null, o: number | null, threshold = 0.4): string => {
      if (!r || !o) return "";
      const diff = r - o;
      if (diff > threshold) return " (improving)";
      if (diff < -threshold) return " (declining)";
      return " (stable)";
    };

    // ── Mood: journal entries ──────────────────────────────────────────────
    const journalSnap = await db
      .collection(`users/${uid}/journal`)
      .where("created_at", ">=", fourWeeksAgo)
      .get();
    const journalEntries = journalSnap.docs.map((d) => d.data());
    const withMood = journalEntries.filter((e) => e.mood_score);
    const recentJournalMoods = withMood.filter((e) => (e.created_at as string).slice(0, 10) >= twoWeeksAgo);
    const olderJournalMoods  = withMood.filter((e) => (e.created_at as string).slice(0, 10) <  twoWeeksAgo);
    const avgJournalMoodRecent = recentJournalMoods.length
      ? recentJournalMoods.reduce((s, e) => s + (e.mood_score as number), 0) / recentJournalMoods.length : null;
    const avgJournalMoodOlder = olderJournalMoods.length
      ? olderJournalMoods.reduce((s, e) => s + (e.mood_score as number), 0) / olderJournalMoods.length : null;

    // ── Mood: standalone check-ins ─────────────────────────────────────────
    const moodSnap = await db
      .collection(`users/${uid}/moods`)
      .where("date", ">=", fourWeeksAgo)
      .get();
    const moodEntries = moodSnap.docs.map((d) => d.data());
    const recentMoodCheckins = moodEntries.filter((m) => (m.date as string) >= twoWeeksAgo);
    const olderMoodCheckins  = moodEntries.filter((m) => (m.date as string) <  twoWeeksAgo);
    const avgCheckinMoodRecent = recentMoodCheckins.length
      ? recentMoodCheckins.reduce((s, m) => s + (m.score as number), 0) / recentMoodCheckins.length : null;
    const avgCheckinMoodOlder = olderMoodCheckins.length
      ? olderMoodCheckins.reduce((s, m) => s + (m.score as number), 0) / olderMoodCheckins.length : null;

    // Prefer standalone mood check-ins; fall back to journal mood
    const moodRecentFinal = avgCheckinMoodRecent ?? avgJournalMoodRecent;
    const moodOlderFinal  = avgCheckinMoodOlder  ?? avgJournalMoodOlder;

    // ── Habits ────────────────────────────────────────────────────────────
    const habitsSnap = await db.collection(`users/${uid}/habits`).get();
    const habits = habitsSnap.docs.map((d) => d.data());
    const recentDates = Array.from({ length: 14 }, (_, i) => dateNDaysAgo(i));

    const habitRows = habits.map((h) => {
      const completions = (h.completions as string[]) ?? [];
      const hits = recentDates.filter((d) => completions.includes(d)).length;
      return { name: h.name as string, rate: hits / 14 };
    });
    const overallHabitRate = habitRows.length
      ? habitRows.reduce((s, r) => s + r.rate, 0) / habitRows.length : null;
    const topHabits    = [...habitRows].sort((a, b) => b.rate - a.rate).slice(0, 2);
    const bottomHabits = [...habitRows].sort((a, b) => a.rate - b.rate).slice(0, 2);

    // ── Tasks ─────────────────────────────────────────────────────────────
    const tasksSnap = await db.collection(`users/${uid}/tasks`).get();
    const allTasks = tasksSnap.docs.map((d) => d.data());
    const activeTasks = allTasks.filter((t) => t.status === "active").length;
    const recentlyCompleted = allTasks.filter(
      (t) => t.status === "completed" &&
             typeof t.updated_at === "string" &&
             t.updated_at >= dateNDaysAgo(7)
    ).length;

    // ── Time entries ──────────────────────────────────────────────────────
    const timeSnap = await db
      .collection(`users/${uid}/time_entries`)
      .where("date", ">=", twoWeeksAgo)
      .where("date", "<=", today)
      .get();
    const byCategory: Record<string, number> = {};
    timeSnap.docs.forEach((d) => {
      const cat = (d.data().category as string) || "Uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + ((d.data().duration_min as number) ?? 0);
    });
    const topTimeCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, mins]) => `${cat} (${(mins / 60).toFixed(1)}h)`);

    // ── Assemble summary ──────────────────────────────────────────────────
    const lines: string[] = [];

    if (moodRecentFinal !== null) {
      lines.push(`Mood: avg ${moodRecentFinal.toFixed(1)}/10${trendLabel(moodRecentFinal, moodOlderFinal, 0.5)}`);
    }
    if (energyRecent !== null) {
      lines.push(`Energy: avg ${energyRecent.toFixed(1)}/10${trendLabel(energyRecent, energyOlder)}`);
    }
    if (sleepRecent !== null) {
      lines.push(`Sleep: avg ${sleepRecent.toFixed(1)}h/night${trendLabel(sleepRecent, sleepOlder, 0.3)}`);
    }
    lines.push(`Exercise: ~${exercisePerWeek} days/week (last 4 weeks)`);

    if (overallHabitRate !== null) {
      lines.push(`Habits: ${Math.round(overallHabitRate * 100)}% completion rate (last 2 weeks)`);
      if (topHabits[0]?.rate > 0.7) {
        lines.push(`  Holding strong: ${topHabits.map((h) => h.name).join(", ")}`);
      }
      if (bottomHabits[0]?.rate < 0.4 && habitRows.length > 2) {
        lines.push(`  Slipping: ${bottomHabits.map((h) => h.name).join(", ")}`);
      }
    }

    lines.push(`Tasks: ${recentlyCompleted} completed this week, ${activeTasks} open`);

    if (topTimeCategories.length > 0) {
      lines.push(`Time logged (last 2 weeks): ${topTimeCategories.join(", ")}`);
    }

    if (lines.length === 0) return "";

    return `WHAT I'VE BEEN OBSERVING (your data, last 4 weeks):\n${lines.map((l) => `- ${l}`).join("\n")}`;
  } catch {
    return "";
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(patterns: string): string {
  const dataSection = patterns
    ? `\n\nCONTEXT — WHAT YOU'VE BEEN OBSERVING:\n${patterns}\n\nUse this to ground your reflections naturally — don't recite numbers, weave them in when relevant. "I've noticed your energy has been running lower lately — does that track?" or "Your habits have held steady even with everything going on." If the data suggests a pattern (declining energy, dropping habits, mood shift), you can gently surface it as an observation, not a diagnosis. The user's own words always take precedence over what the data shows.`
    : "";

  return `You are helping someone understand and name the life season they're currently in — the medium-term period they're living through right now, weeks to months in length.

Your goal: help them notice and articulate what's actually true about where they are, so they can be intentional about it rather than reactive.${dataSection}

THE PROCESS (3-5 turns max):
Turn 1: Ask exactly: "How would you describe where you are right now — not where you think you should be, just what's actually true?"

Turns 2-4: Reflect back what you heard in one sentence, then ask ONE deepening question. Good questions:
- "What does this period seem to be asking of you?"
- "If this season had a job to do, what would it be?"
- "What would feel like a win at the end of this period?"
- "What's the thing you're most navigating right now?"

If the data you've observed suggests something relevant, you can reference it once — gently, as an observation, not a diagnosis.

Final turn: When you have enough to name the season (usually after 2-3 exchanges), offer your synthesis:
"Here's how I'd name this season: [short name in their own language]. What it seems to call for: [1-2 sentences]. Does that land, or does something need adjusting?"

If they adjust, update and confirm once. Then output the signal.

OUTPUT SIGNAL: When ready to save, output EXACTLY on their own lines:
SEASON_READY
name: [2-8 words in the user's language, not productivity jargon]
intention: [1-2 sentences on what this season calls for]
framing: [2-3 sentences — Claude's reflection on what this season is and why naming it matters]

RULES:
- ONE question at a time, never two
- Use THEIR words, not labels like "Push season" or "Recovery phase"
- Name the season for what it IS, not what you want it to be
- Keep to 5 turns or fewer total
- After SEASON_READY output nothing else`;
}

// ── Field parser ──────────────────────────────────────────────────────────────

interface SeasonData {
  name: string;
  intention: string;
  claude_framing: string;
}

function parseSeasonFields(text: string): SeasonData {
  const lines = text.split("\n");
  let name = "";
  let intention = "";
  const framingLines: string[] = [];
  let inFraming = false;

  for (const line of lines) {
    if (line.startsWith("name:")) {
      name = line.slice("name:".length).trim();
    } else if (line.startsWith("intention:")) {
      intention = line.slice("intention:".length).trim();
    } else if (line.startsWith("framing:")) {
      inFraming = true;
      const rest = line.slice("framing:".length).trim();
      if (rest) framingLines.push(rest);
    } else if (inFraming && line.trim()) {
      framingLines.push(line.trim());
    }
  }

  return { name, intention, claude_framing: framingLines.join(" ") };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages } = (await req.json()) as { messages: SeasonMessage[] };

    // Always fetch patterns — the system prompt is stateless across calls,
    // so we must include data context on every turn not just the first.
    const patterns = await collectRecentPatterns(uid);
    const systemPrompt = buildSystemPrompt(patterns);

    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role === "guide" ? "assistant" : "user",
      content: m.content,
    }));

    const apiMessages: Anthropic.MessageParam[] =
      anthropicMessages.length === 0
        ? [{ role: "user", content: "Let's begin." }]
        : anthropicMessages;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: systemPrompt,
      messages: apiMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    if (text.includes("SEASON_READY")) {
      const season = parseSeasonFields(text);
      return NextResponse.json({ type: "complete", content: text, season });
    }

    return NextResponse.json({ type: "question", content: text });
  } catch (err) {
    console.error("[/api/season/checkin]", err);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
