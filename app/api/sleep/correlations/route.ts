// GET  /api/sleep/correlations — monthly cron: Claude Haiku surfaces personal sleep correlations
// POST /api/sleep/correlations — manual trigger (Firebase ID token auth)
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function isCronAuthed(req: NextRequest) {
  return CRON_SECRET !== "" && (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}
async function getUidFromToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ") || auth === `Bearer ${CRON_SECRET}`) return null;
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch { return null; }
}

async function analyzeUser(uid: string): Promise<boolean> {
  const db = getAdminDb();

  const monthKey = new Date().toISOString().slice(0, 7);
  const existingSnap = await db.doc(`users/${uid}/sleep_correlations/${monthKey}`).get();
  if (existingSnap.exists) return false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toLocaleDateString("en-CA");

  const [healthSnap, moodSnap, energySnap] = await Promise.all([
    db.collection(`users/${uid}/health`).where("date", ">=", startDate).orderBy("date", "asc").get(),
    db.collection(`users/${uid}/mood`).where("date", ">=", startDate).orderBy("date", "asc").get(),
    db.collection(`users/${uid}/energy`).where("date", ">=", startDate).orderBy("date", "asc").get(),
  ]);

  if (healthSnap.size < 7) return false;

  const healthByDate: Record<string, Record<string, unknown>> = {};
  healthSnap.docs.forEach((d) => { healthByDate[d.id] = d.data(); });
  const moodByDate: Record<string, number> = {};
  moodSnap.docs.forEach((d) => { moodByDate[d.id] = d.data().score as number; });
  const energyByDate: Record<string, number> = {};
  energySnap.docs.forEach((d) => { energyByDate[d.id] = d.data().score as number; });

  const rows = Object.entries(healthByDate).map(([date, h]) => ({
    date,
    sleep_h: h.sleep_hours as number,
    sleep_q: h.sleep_quality as number,
    exercise: h.exercise_done ? 1 : 0,
    mood: moodByDate[date] ?? null,
    energy: energyByDate[date] ? Math.round((energyByDate[date] / 2)) : null,
  }));

  const table = rows.map((r) =>
    `${r.date}: sleep=${r.sleep_h}h quality=${r.sleep_q}/10 exercise=${r.exercise} mood=${r.mood ?? "?"}/10 energy=${r.energy ?? "?"}/5`
  ).join("\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Analyze this 30-day sleep data and identify the 3 strongest personal correlations. Look for patterns like: exercise vs sleep quality, prior night sleep vs next-day mood/energy, consistency vs quality. Be specific with numbers. Format as 3 markdown bullets, each under 30 words.\n\n${table}`,
    }],
  });

  const content = (msg.content[0] as { text: string }).text;

  await db.doc(`users/${uid}/sleep_correlations/${monthKey}`).set({
    month: monthKey,
    content,
    generated_at: new Date().toISOString(),
    data_points: rows.length,
  });

  return true;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  let processed = 0;
  await Promise.all(usersSnap.docs.map(async (userDoc) => {
    try {
      const ran = await analyzeUser(userDoc.id);
      if (ran) processed++;
    } catch { /* per-user failure non-fatal */ }
  }));
  return NextResponse.json({ ok: true, processed });
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = getAdminDb();
    const monthKey = new Date().toISOString().slice(0, 7);
    await db.doc(`users/${uid}/sleep_correlations/${monthKey}`).delete();
    await analyzeUser(uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
