// POST /api/habits/suggest — Habit Bootstrapping (PA-5)
// Reads the user's goals, Constitution, and current life season, then asks Claude to
// propose 3 starter habits (with a one-line rationale each) so a blank habit page never
// stays blank. Read-only: returns suggestions; the client creates the habits on accept.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { getConstitutionContext } from "@/lib/constitution";
import { getSeasonContext } from "@/lib/season";

interface Suggestion {
  name: string;
  category: string;
  target_days: number[]; // 0=Sun..6=Sat
  timing: string;
  rationale: string;
}

const SYSTEM_PROMPT = `You are a habit coach for a personal life OS. Given the user's goals, values (Constitution), and current life season, suggest exactly 3 high-leverage daily/weekly habits to start with. Favor small, concrete, trackable habits that ladder up to what they care about right now. Return ONLY a valid JSON array (no markdown, no prose):

[{ "name": string, "category": string, "target_days": number[] (0=Sun..6=Sat), "timing": string (e.g. "morning", "after work"), "rationale": string (one sentence on why this one, tied to their goals/values/season) }]

Use [1,2,3,4,5] for weekday habits, [0,1,2,3,4,5,6] for daily. Keep names short (2-4 words).`;

function parseJsonArray(raw: string): Suggestion[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.name === "string")
      .map((s) => ({
        name: String(s.name),
        category: typeof s.category === "string" ? s.category : "",
        target_days: Array.isArray(s.target_days) && s.target_days.every((n: unknown) => typeof n === "number")
          ? s.target_days
          : [1, 2, 3, 4, 5],
        timing: typeof s.timing === "string" ? s.timing : "",
        rationale: typeof s.rationale === "string" ? s.rationale : "",
      }))
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
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

  const db = getAdminDb();
  const [goalsSnap, constitutionCtx, seasonCtx] = await Promise.all([
    db.collection(`users/${uid}/goals`).where("status", "==", "active").limit(8).get().catch(() => null),
    getConstitutionContext(uid).catch(() => null),
    getSeasonContext(uid).catch(() => null),
  ]);

  const goalLines = goalsSnap && !goalsSnap.empty
    ? goalsSnap.docs.map((d) => `- ${d.data().title}`).join("\n")
    : "No goals set yet.";

  const userPrompt = [
    "GOALS:",
    goalLines,
    "",
    constitutionCtx ?? "(No Constitution yet — suggest broadly healthy foundational habits.)",
    "",
    seasonCtx ?? "(No active season.)",
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const suggestions = parseJsonArray(raw);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Habit suggestion error:", err);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
