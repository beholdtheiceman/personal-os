// POST /api/ingest/transcript — Ambient capture: extract structured data from text and write to Firestore
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface ExtractedData {
  tasks?: Array<{ title: string; priority?: "high" | "medium" | "low"; due_date?: string; notes?: string }>;
  decisions?: Array<{ title: string; context?: string; outcome?: string }>;
  health?: { notes?: string; sleep_hours?: number; steps?: number; mood?: number };
  workout?: { type: string; duration_minutes?: number; notes?: string };
  interactions?: Array<{ name: string; notes: string; interaction_type?: string }>;
  journal_entry?: { content: string };
  transactions?: Array<{ description: string; amount: number; category?: string; type?: "expense" | "income" }>;
}

const SYSTEM_PROMPT = `You are a structured data extractor for a personal OS. Given a transcript or debrief text, extract relevant information and return ONLY a valid JSON object (no markdown, no explanation) with these optional fields:

{
  "tasks": [{ "title": string, "priority": "high"|"medium"|"low", "due_date": "YYYY-MM-DD", "notes": string }],
  "decisions": [{ "title": string, "context": string, "outcome": string }],
  "health": { "notes": string, "sleep_hours": number, "steps": number, "mood": number (1-10) },
  "workout": { "type": string, "duration_minutes": number, "notes": string },
  "interactions": [{ "name": string, "notes": string, "interaction_type": string }],
  "journal_entry": { "content": string },
  "transactions": [{ "description": string, "amount": number, "category": string, "type": "expense"|"income" }]
}

Only include fields that are clearly present in the text. Omit fields entirely if not relevant.`;

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { text, contextType, localDate } = await req.json() as { text: string; contextType: string; localDate?: string };
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const today = localDate ?? new Date().toISOString().slice(0, 10);

  // Call Claude Haiku
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Context type: ${contextType}\n\n${text}` }],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  let extracted: ExtractedData = {};
  try {
    extracted = JSON.parse(rawText);
  } catch {
    // If parsing fails, return gracefully
    return NextResponse.json({ actions: [], summary: "Could not parse response from AI." });
  }

  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const now = FieldValue.serverTimestamp();
  const actions: string[] = [];

  // Tasks
  for (const task of extracted.tasks ?? []) {
    await userRef.collection("tasks").add({
      title: task.title,
      priority: task.priority ?? "medium",
      status: "pending",
      created_at: now,
      source: "ambient_capture",
      ...(task.due_date && { due_date: task.due_date }),
      ...(task.notes && { notes: task.notes }),
    });
    actions.push(`Created task: ${task.title}`);
  }

  // Decisions
  for (const decision of extracted.decisions ?? []) {
    await userRef.collection("decisions").add({
      title: decision.title,
      context: decision.context ?? "",
      outcome: decision.outcome ?? "",
      date: today,
      source: "ambient_capture",
    });
    actions.push(`Logged decision: ${decision.title}`);
  }

  // Health
  if (extracted.health) {
    const h = extracted.health;
    await userRef.collection("health").doc(today).set(
      {
        date: today,
        ...(h.notes && { notes: h.notes }),
        ...(h.sleep_hours && { sleep_hours: h.sleep_hours }),
        ...(h.steps && { steps: h.steps }),
        ...(h.mood && { mood: h.mood }),
      },
      { merge: true }
    );
    actions.push("Updated health log");
  }

  // Workout
  if (extracted.workout) {
    const w = extracted.workout;
    await userRef.collection("workouts").add({
      type: w.type,
      duration_minutes: w.duration_minutes ?? null,
      notes: w.notes ?? "",
      date: today,
      source: "ambient_capture",
    });
    actions.push(`Logged workout: ${w.type}`);
  }

  // Interactions
  for (const interaction of extracted.interactions ?? []) {
    await userRef.collection("interactions").add({
      name: interaction.name,
      notes: interaction.notes,
      interaction_type: interaction.interaction_type ?? "general",
      date: today,
      source: "ambient_capture",
    });
    actions.push(`Logged interaction with: ${interaction.name}`);
  }

  // Journal entry
  if (extracted.journal_entry) {
    await userRef.collection("journal").add({
      content: extracted.journal_entry.content,
      date: today,
      source: "ambient_capture",
      created_at: now,
    });
    actions.push("Created journal entry");
  }

  // Transactions
  for (const tx of extracted.transactions ?? []) {
    await userRef.collection("transactions").add({
      description: tx.description,
      amount: tx.amount,
      category: tx.category ?? "General",
      type: tx.type ?? "expense",
      date: today,
      source: "ambient_capture",
    });
    actions.push(`Recorded transaction: ${tx.description} ($${tx.amount})`);
  }

  const summary =
    actions.length === 0
      ? "No structured data found in transcript."
      : `Filed ${actions.length} item${actions.length !== 1 ? "s" : ""} from your ${contextType.replace(/_/g, " ")}.`;

  return NextResponse.json({ actions, summary });
}
