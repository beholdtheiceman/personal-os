// runDayRecap — shared core for the End-of-Day Recap (PA-2).
// Extracts structured data from a free-form day description (Haiku → JSON) and writes
// to each module's canonical collection. Used by both /api/ingest/day-recap (UI) and
// the run_day_recap chat tool (so the agent can trigger it mid-conversation).
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface RecapResult {
  actions: string[];
  summary: string;
  xp_awarded: number;
}

interface RecapData {
  mood?: { score: number; note?: string };
  nutrition?: Array<{
    meal: "breakfast" | "lunch" | "dinner" | "snack";
    description: string;
    calories_estimated?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  }>;
  workout?: { type: string; duration_minutes?: number; notes?: string };
  completed_tasks?: string[];
  new_tasks?: Array<{ title: string; priority?: "high" | "medium" | "low"; due_date?: string }>;
  interactions?: Array<{ name: string; notes?: string; interaction_type?: string }>;
  journal_entry?: { content: string };
  water_glasses?: number;
  transactions?: Array<{ description: string; amount: number; category?: string; type?: "expense" | "income" }>;
}

const SYSTEM_PROMPT = `You are an end-of-day recap extractor for a personal life OS. The user is describing how their day went in natural language. Extract everything they mention and return ONLY a valid JSON object (no markdown, no explanation) with these optional fields:

{
  "mood": { "score": number (1-10), "note": string },
  "nutrition": [{ "meal": "breakfast"|"lunch"|"dinner"|"snack", "description": string, "calories_estimated": number, "protein_g": number, "carbs_g": number, "fat_g": number }],
  "workout": { "type": string, "duration_minutes": number, "notes": string },
  "completed_tasks": [string],
  "new_tasks": [{ "title": string, "priority": "high"|"medium"|"low", "due_date": "YYYY-MM-DD" }],
  "interactions": [{ "name": string, "notes": string, "interaction_type": string }],
  "journal_entry": { "content": string },
  "water_glasses": number,
  "transactions": [{ "description": string, "amount": number, "category": string, "type": "expense"|"income" }]
}

Guidance:
- "completed_tasks" are things the user says they finished/did today (short phrases that can be matched against their existing to-do list). "new_tasks" are things they say they still need to do.
- Estimate nutrition macros when the user describes food without numbers; round sensibly.
- "journal_entry.content" should be a brief 1-3 sentence reflection capturing the day's tone, only if the user reflected.
- Only include fields clearly present. Omit anything not mentioned.`;

function parseJsonObject(raw: string): RecapData | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as RecapData;
  } catch {
    return null;
  }
}

export async function runDayRecap(uid: string, text: string, today: string): Promise<RecapResult> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";
  const extracted = parseJsonObject(rawText);
  if (!extracted) {
    return { actions: [], summary: "Could not parse the recap. Try rephrasing.", xp_awarded: 0 };
  }

  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const now = FieldValue.serverTimestamp();
  const actions: string[] = [];
  const xpEvents: Array<{ type: string; xp: number; description: string }> = [];

  // Mood → users/{uid}/mood/{date}
  if (extracted.mood && typeof extracted.mood.score === "number") {
    const score = Math.min(10, Math.max(1, Math.round(extracted.mood.score)));
    const moodRef = userRef.collection("mood").doc(today);
    const wasFirst = !(await moodRef.get()).exists;
    await moodRef.set(
      { date: today, score, note: extracted.mood.note ?? "", logged_at: new Date().toISOString() },
      { merge: true },
    );
    actions.push(`Logged mood: ${score}/10`);
    if (wasFirst) xpEvents.push({ type: "mood_logged", xp: 5, description: "Mood logged (recap)" });
  }

  // Nutrition → users/{uid}/nutrition (one doc per meal)
  for (const meal of extracted.nutrition ?? []) {
    await userRef.collection("nutrition").add({
      date: today,
      meal: meal.meal,
      description: meal.description,
      calories_estimated: meal.calories_estimated ?? null,
      protein_g: meal.protein_g ?? null,
      carbs_g: meal.carbs_g ?? null,
      fat_g: meal.fat_g ?? null,
      source: "day_recap",
      logged_at: now,
    });
    actions.push(`Logged ${meal.meal}: ${meal.description}`);
  }
  if ((extracted.nutrition ?? []).length > 0) {
    xpEvents.push({ type: "nutrition_logged", xp: 5, description: "Meals logged (recap)" });
  }

  // Workout → users/{uid}/workouts
  if (extracted.workout?.type) {
    await userRef.collection("workouts").add({
      type: extracted.workout.type,
      duration_minutes: extracted.workout.duration_minutes ?? null,
      notes: extracted.workout.notes ?? "",
      date: today,
      source: "day_recap",
    });
    actions.push(`Logged workout: ${extracted.workout.type}`);
    xpEvents.push({ type: "workout_complete", xp: 15, description: "Workout logged (recap)" });
  }

  // Completed tasks → match open tasks by title and mark completed
  if ((extracted.completed_tasks ?? []).length > 0) {
    const openSnap = await userRef.collection("tasks").where("status", "in", ["active", "pending"]).limit(50).get();
    for (const phrase of extracted.completed_tasks ?? []) {
      const needle = phrase.toLowerCase().trim();
      const match = openSnap.docs.find((d) => {
        const title = String(d.data().title ?? "").toLowerCase();
        return title && (title.includes(needle) || needle.includes(title));
      });
      if (match) {
        await match.ref.update({ status: "completed", completed_at: new Date().toISOString() });
        actions.push(`Completed task: ${match.data().title}`);
        xpEvents.push({ type: "task_complete", xp: 5, description: "Task completed (recap)" });
      }
    }
  }

  // New tasks → users/{uid}/tasks
  for (const task of extracted.new_tasks ?? []) {
    await userRef.collection("tasks").add({
      title: task.title,
      priority: task.priority ?? "medium",
      status: "active",
      source: "day_recap",
      created_at: now,
      ...(task.due_date && { due_date: task.due_date }),
    });
    actions.push(`Added task: ${task.title}`);
  }

  // Interactions → users/{uid}/interactions
  for (const interaction of extracted.interactions ?? []) {
    await userRef.collection("interactions").add({
      name: interaction.name,
      notes: interaction.notes ?? "",
      interaction_type: interaction.interaction_type ?? "general",
      date: today,
      source: "day_recap",
    });
    actions.push(`Logged interaction with: ${interaction.name}`);
  }
  if ((extracted.interactions ?? []).length > 0) {
    xpEvents.push({ type: "interaction_logged", xp: 5, description: "Interaction logged (recap)" });
  }

  // Journal seed → users/{uid}/journal
  if (extracted.journal_entry?.content) {
    await userRef.collection("journal").add({
      content: extracted.journal_entry.content,
      date: today,
      source: "day_recap",
      created_at: now,
    });
    actions.push("Created journal entry");
    xpEvents.push({ type: "journal_entry", xp: 10, description: "Journal entry (recap)" });
  }

  // Water → users/{uid}/hydration/{date}
  if (typeof extracted.water_glasses === "number" && extracted.water_glasses > 0) {
    const glasses = Math.round(extracted.water_glasses);
    await userRef.collection("hydration").doc(today).set(
      { date: today, glasses, goal: 8, updated_at: new Date().toISOString() },
      { merge: true },
    );
    actions.push(`Logged ${glasses} glasses of water`);
  }

  // Transactions → users/{uid}/transactions
  for (const tx of extracted.transactions ?? []) {
    await userRef.collection("transactions").add({
      description: tx.description,
      amount: tx.amount,
      category: tx.category ?? "General",
      type: tx.type ?? "expense",
      date: today,
      source: "day_recap",
    });
    actions.push(`Recorded transaction: ${tx.description} ($${tx.amount})`);
  }

  // Award XP once for everything logged this recap.
  const xpTotal = xpEvents.reduce((s, e) => s + e.xp, 0);
  if (xpTotal > 0) {
    const xpRef = userRef.collection("xp").doc("summary");
    const xpSnap = await xpRef.get();
    const current: number = xpSnap.exists ? (xpSnap.data()?.total ?? 0) : 0;
    await xpRef.set({ total: current + xpTotal }, { merge: true });
    const ts = new Date().toISOString();
    await Promise.all(
      xpEvents.map((e) => userRef.collection("xp_events").add({ ...e, timestamp: ts })),
    );
  }

  const summary =
    actions.length === 0
      ? "Didn't catch anything to log — try describing your day in a bit more detail."
      : `Filed ${actions.length} item${actions.length !== 1 ? "s" : ""} from your day${xpTotal > 0 ? ` · +${xpTotal} XP` : ""}.`;

  return { actions, summary, xp_awarded: xpTotal };
}
