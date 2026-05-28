import { getAdminDb } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

interface LifeContextDoc {
  content: string;
  updated_at: string;
  weeks_analyzed: number;
  created_at: string;
}

export async function getLifeContextForChat(uid: string): Promise<string | null> {
  try {
    const snap = await getAdminDb().doc(`users/${uid}/life_context/main`).get();
    if (!snap.exists) return null;
    const data = snap.data() as Partial<LifeContextDoc>;
    if (!data?.content) return null;
    return [
      "## What I've Learned About You Over Time",
      "",
      data.content,
      "",
      `*Last updated: ${data.updated_at} · ${data.weeks_analyzed ?? 1} week(s) of data*`,
    ].join("\n");
  } catch {
    return null;
  }
}

export async function updateLifeContext(
  uid: string,
  weekDataSummary: string,
  reviewContent: string
): Promise<void> {
  try {
    const db = getAdminDb();
    const ref = db.doc(`users/${uid}/life_context/main`);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data() as Partial<LifeContextDoc>) : null;
    const existingContent = existing?.content ?? null;
    const weeksAnalyzed = (existing?.weeks_analyzed ?? 0) + 1;
    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = [
      "You maintain a living pattern document about a person based on their weekly data.",
      "The document is organized into exactly these five sections:",
      "",
      "## Patterns That Unlock Me",
      "## Patterns That Derail Me",
      "## Health & Energy Correlations",
      "## Recurring Themes",
      "## Notable Observations",
      "",
      existingContent
        ? "Update this document based on new week data. Strengthen confirmed patterns, revise contradicted ones, add new ones only if significant."
        : "Create the initial document from this first week of data.",
      "",
      "Rules: write in second person (\"You tend to...\"), keep under 500 words total, output only the document with no preamble or closing remarks.",
    ].join("\n");

    const userMessage = [
      existingContent ? `EXISTING DOCUMENT:\n${existingContent}\n\n---\n` : "",
      `NEW WEEK DATA SUMMARY:\n${weekDataSummary}`,
      "",
      `WEEKLY REVIEW CONTENT:\n${reviewContent}`,
    ].join("\n");

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    if (!content) return;

    await ref.set({
      content,
      updated_at: today,
      weeks_analyzed: weeksAnalyzed,
      created_at: existing?.created_at ?? today,
    });
  } catch {
    // Background task — swallow errors silently
  }
}
