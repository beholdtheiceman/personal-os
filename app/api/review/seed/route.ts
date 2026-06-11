// POST /api/review/seed — seed review cards from existing book highlights and journal insights.
// Idempotent: skips cards whose text already exists for the user. Safe to call repeatedly.
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { addReviewCard } from "@/lib/review-cards";

async function getUidFromToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const today = new Date().toISOString().slice(0, 10);

  // Build a set of existing card texts to avoid duplicates
  const existingSnap = await db.collection(`users/${uid}/review_cards`).get();
  const existingTexts = new Set(existingSnap.docs.map((d) => (d.data().text as string).trim()));

  let added = 0;

  // ── Book highlights ──────────────────────────────────────────────────────────
  const booksSnap = await db.collection(`users/${uid}/books`).get();
  for (const bookDoc of booksSnap.docs) {
    const book = bookDoc.data();
    const highlights: string[] = book.highlights ?? [];
    for (const highlight of highlights) {
      const text = highlight.trim();
      if (!text || existingTexts.has(text)) continue;
      // Stagger initial review dates so they don't all pile up on day 1
      const daysOffset = added % 7;
      const nextDate = new Date(today + "T12:00:00");
      nextDate.setDate(nextDate.getDate() + daysOffset);
      await addReviewCard(uid, {
        source_type: "book_highlight",
        source_id: bookDoc.id,
        source_title: (book.title as string) ?? "Unknown Book",
        text,
        created_at: new Date().toISOString(),
        last_surfaced_at: null,
        next_review_date: nextDate.toISOString().slice(0, 10),
        interval_days: 1,
        times_reviewed: 0,
        tags: book.tags ?? [],
      });
      existingTexts.add(text);
      added++;
    }
  }

  // ── Journal insights (ai_summary from recent 30 entries) ─────────────────────
  const journalSnap = await db.collection(`users/${uid}/journal`)
    .orderBy("created_at", "desc")
    .limit(30)
    .get();
  for (const jDoc of journalSnap.docs) {
    const entry = jDoc.data();
    const summary: string = (entry.ai_summary as string | undefined)?.trim() ?? "";
    if (!summary || existingTexts.has(summary)) continue;
    const daysOffset = added % 7;
    const nextDate = new Date(today + "T12:00:00");
    nextDate.setDate(nextDate.getDate() + daysOffset);
    await addReviewCard(uid, {
      source_type: "journal_insight",
      source_id: jDoc.id,
      source_title: `Journal — ${(entry.date as string) ?? ""}`,
      text: summary,
      created_at: new Date().toISOString(),
      last_surfaced_at: null,
      next_review_date: nextDate.toISOString().slice(0, 10),
      interval_days: 1,
      times_reviewed: 0,
      tags: entry.tags ?? [],
    });
    existingTexts.add(summary);
    added++;
  }

  return NextResponse.json({ added, total: existingTexts.size });
}
