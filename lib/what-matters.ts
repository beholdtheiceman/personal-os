/**
 * "What Actually Matters" Signal — server-side helpers.
 *
 * Generates and reads a daily 1-2 sentence synthesis from Claude,
 * grounded in Constitution + Season + Life Memory + cross-system urgency.
 * Stored at users/{uid}/what_matters/today.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import { getConstitutionContext } from "@/lib/constitution";
import { getSeasonContext } from "@/lib/season";
import { getLifeContextForChat } from "@/lib/life-context";

interface WhatMattersDoc {
  content: string;
  generated_at: string;
  date: string;
}

/** Read the stored signal for today (or null if not yet generated). */
export async function getWhatMatters(uid: string): Promise<WhatMattersDoc | null> {
  try {
    const snap = await getAdminDb().doc(`users/${uid}/what_matters/today`).get();
    if (!snap.exists) return null;
    return snap.data() as WhatMattersDoc;
  } catch {
    return null;
  }
}

/** Read the signal formatted for injection into the chat system prompt or briefing. */
export async function getWhatMattersForContext(uid: string): Promise<string | null> {
  const doc = await getWhatMatters(uid);
  if (!doc?.content) return null;
  return `## What Actually Matters Today\n\n${doc.content}\n\n*Generated: ${doc.date}*`;
}

/** Collect cross-system urgency snapshot for a user. */
async function collectCrossSystemSnapshot(uid: string): Promise<string> {
  const db = getAdminDb();
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  try {
    // Overdue or high-priority tasks
    const tasksSnap = await db.collection(`users/${uid}/tasks`)
      .where("status", "==", "active")
      .orderBy("priority_score", "desc")
      .limit(8)
      .get();
    const tasks = tasksSnap.docs.map((d) => d.data());
    const overdue = tasks.filter((t) => t.due_date && t.due_date < today);
    const urgent = tasks.filter((t) => (t.priority_score ?? 0) >= 75 && !overdue.find((o) => o.title === t.title));
    if (overdue.length) lines.push(`Overdue tasks (${overdue.length}): ${overdue.slice(0, 3).map((t) => t.title).join(", ")}`);
    if (urgent.length) lines.push(`High-priority tasks: ${urgent.slice(0, 3).map((t) => t.title).join(", ")}`);
  } catch { /* optional */ }

  try {
    // Active goals — any nearing deadline or with low milestone progress
    const goalsSnap = await db.collection(`users/${uid}/goals`)
      .where("status", "==", "active").limit(5).get();
    const goals = goalsSnap.docs.map((d) => d.data());
    const needsAttention = goals.filter((g) => {
      const milestones: { completed: boolean }[] = g.milestones ?? [];
      if (!milestones.length) return false;
      const pct = milestones.filter((m) => m.completed).length / milestones.length;
      const daysLeft = g.target_date
        ? Math.ceil((new Date(g.target_date).getTime() - Date.now()) / 86400000)
        : null;
      return (daysLeft !== null && daysLeft < 14 && pct < 0.5) || pct === 0;
    });
    if (needsAttention.length) {
      lines.push(`Goals needing attention: ${needsAttention.slice(0, 2).map((g) => g.title).join(", ")}`);
    }
  } catch { /* optional */ }

  try {
    // Habit streak health — any habits with recent drops
    const habitsSnap = await db.collection(`users/${uid}/habits`).limit(20).get();
    const habits = habitsSnap.docs.map((d) => d.data());
    const past7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString("en-CA");
    });
    const lagging = habits.filter((h) => {
      const completions: string[] = h.completions ?? [];
      const recent = past7.filter((d) => completions.includes(d)).length;
      return recent <= 1 && h.name; // nearly no completions this week
    });
    if (lagging.length) {
      lines.push(`Habits with low engagement this week: ${lagging.slice(0, 2).map((h) => h.name).join(", ")}`);
    }
  } catch { /* optional */ }

  try {
    // Recent health trend — last 3 days energy average
    const healthSnap = await db.collection(`users/${uid}/health`)
      .orderBy("date", "desc").limit(5).get();
    const healthDocs = healthSnap.docs.map((d) => d.data());
    const energyReadings = healthDocs
      .filter((h) => typeof h.energy_level === "number")
      .slice(0, 3)
      .map((h) => h.energy_level as number);
    if (energyReadings.length >= 2) {
      const avgEnergy = energyReadings.reduce((a, b) => a + b, 0) / energyReadings.length;
      if (avgEnergy < 5) lines.push(`Low energy trend (avg ${avgEnergy.toFixed(1)}/10 over last ${energyReadings.length} logged days)`);
    }
  } catch { /* optional */ }

  try {
    // Finance — month-to-date spending
    const thisMonth = today.slice(0, 7);
    const txSnap = await db.collection(`users/${uid}/transactions`)
      .where("date", ">=", `${thisMonth}-01`)
      .orderBy("date", "desc")
      .limit(100)
      .get();
    const monthExpenses = txSnap.docs
      .map((d) => d.data())
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    if (monthExpenses > 0) lines.push(`Month-to-date spending: $${Math.round(monthExpenses).toLocaleString()}`);
  } catch { /* optional */ }

  return lines.length
    ? `CROSS-SYSTEM SNAPSHOT:\n${lines.map((l) => `- ${l}`).join("\n")}`
    : "CROSS-SYSTEM SNAPSHOT: No urgent signals detected.";
}

/** Generate a fresh "What Actually Matters" signal and persist it. */
export async function generateWhatMatters(uid: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all context layers in parallel
  const [constitutionCtx, seasonCtx, lifeCtx, crossSystem] = await Promise.all([
    getConstitutionContext(uid).catch(() => null),
    getSeasonContext(uid).catch(() => null),
    getLifeContextForChat(uid).catch(() => null),
    collectCrossSystemSnapshot(uid),
  ]);

  const contextBlocks = [
    constitutionCtx ? `PERSONAL CONSTITUTION:\n${constitutionCtx}` : null,
    seasonCtx ? `CURRENT LIFE SEASON:\n${seasonCtx}` : null,
    lifeCtx ? `LONGITUDINAL PATTERNS:\n${lifeCtx}` : null,
    crossSystem,
  ].filter(Boolean).join("\n\n---\n\n");

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: [
      "You are a deeply personal life advisor who knows this person intimately.",
      "Your job is to read across everything — their values, their current season, their patterns over time, and what's urgent in their systems — and surface the ONE thing that most deserves their attention today.",
      "",
      "Output: 1-2 sentences maximum. Plain language. No fluff, no hedging. Start directly with the insight.",
      "Do NOT start with 'I' or 'You should'. Make it feel like an honest observation from someone who truly knows them.",
      "Examples of good output:",
      "- 'Your health metrics have been slipping for three weeks — this is the thing to protect today, not the productivity sprint.'",
      "- 'The relationship you've been meaning to reconnect with has gone quiet for two months. Given what you say matters most, this is the week.'",
      "- 'You have a major deadline approaching and your task list shows it is under-resourced. That gap deserves your attention today.'",
    ].join("\n"),
    messages: [{
      role: "user",
      content: `Today is ${today}. Based on everything below, what is the one thing that most deserves this person's attention right now?\n\n${contextBlocks}`,
    }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  if (content) {
    await getAdminDb().doc(`users/${uid}/what_matters/today`).set({
      content,
      generated_at: new Date().toISOString(),
      date: today,
    });
  }

  return content;
}
