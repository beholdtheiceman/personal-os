// POST /api/okrs/review — generate quarterly review for one objective (Firebase ID token auth)
// GET  /api/okrs/review — cron: auto-review objectives whose quarter just ended
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import type { Objective } from "@/types";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function isCronAuthed(req: NextRequest) {
  return CRON_SECRET !== "" && (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}

function prevQuarter(): string {
  const now = new Date();
  let q = Math.ceil((now.getMonth() + 1) / 3) - 1;
  let y = now.getFullYear();
  if (q === 0) { q = 4; y--; }
  return `${y}-Q${q}`;
}

async function buildReview(uid: string, objectiveId: string): Promise<void> {
  const db = getAdminDb();
  const snap = await db.doc(`users/${uid}/okrs/${objectiveId}`).get();
  if (!snap.exists) throw new Error("Objective not found");
  const obj = { id: snap.id, ...snap.data() } as Objective;
  if (obj.keyResults.length === 0) throw new Error("No key results to review");

  const krLines = obj.keyResults.map((kr) => {
    const pct = kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : kr.completed ? 100 : 0;
    const score = Math.min(1, pct / 100).toFixed(2);
    return `- ${kr.title}: ${kr.current}/${kr.target} ${kr.unit} (${pct}% → score ${score})`;
  }).join("\n");

  const overallScore = obj.keyResults.reduce((s, kr) => {
    return s + Math.min(1, kr.target > 0 ? kr.current / kr.target : kr.completed ? 1 : 0);
  }, 0) / obj.keyResults.length;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Write a 2-3 sentence quarterly OKR review for this objective. Be honest about what drove success or shortfall. End with one forward-looking insight for next quarter.\n\nObjective: "${obj.title}"\nQuarter: ${obj.quarter}\n\nKey Results:\n${krLines}\n\nOverall score: ${overallScore.toFixed(2)}`,
    }],
  });

  await db.doc(`users/${uid}/okrs/${objectiveId}`).update({
    "review.score": parseFloat(overallScore.toFixed(2)),
    "review.summary": (msg.content[0] as { text: string }).text,
    "review.generated_at": new Date().toISOString(),
    status: overallScore >= 0.7 ? "completed" : "active",
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ") || auth === `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    const uid = decoded.uid;
    const { objectiveId } = await req.json() as { objectiveId: string };
    if (!objectiveId) return NextResponse.json({ error: "objectiveId required" }, { status: 400 });
    await buildReview(uid, objectiveId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  const pq = prevQuarter();
  const usersSnap = await db.collection("users").get();
  const results: Record<string, string[]> = {};

  await Promise.all(usersSnap.docs.map(async (userDoc) => {
    const uid = userDoc.id;
    const reviewed: string[] = [];
    try {
      const snap = await db.collection(`users/${uid}/okrs`)
        .where("quarter", "==", pq)
        .where("status", "==", "active")
        .get();
      for (const d of snap.docs) {
        const obj = d.data() as Objective;
        if (obj.review) continue;
        try {
          await buildReview(uid, d.id);
          reviewed.push(d.data().title as string);
        } catch { /* per-objective failure non-fatal */ }
      }
      if (reviewed.length) results[uid] = reviewed;
    } catch { /* per-user failure non-fatal */ }
  }));

  return NextResponse.json({ ok: true, quarter: pq, results });
}
