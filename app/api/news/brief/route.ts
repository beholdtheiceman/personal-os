// GET /api/news/brief
// Returns today's news brief, generating it via Claude Sonnet if not yet cached.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import type { NewsBrief, NewsItem } from "@/types";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function getUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const db    = getAdminDb();
  const briefRef = db.doc(`users/${uid}/news_brief/${today}`);

  // Return cached brief if already generated today
  const existing = await briefRef.get();
  if (existing.exists) {
    return NextResponse.json({ brief: existing.data() as NewsBrief });
  }

  // Fetch top articles from the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const snap  = await db.collection(`users/${uid}/news_items`)
    .where("fetched_at", ">=", since).get();

  const articles = snap.docs
    .map((d) => d.data() as NewsItem)
    .filter((i) => i.status !== "dismissed")
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 10);

  if (articles.length === 0) {
    return NextResponse.json({ brief: null });
  }

  const articleList = articles
    .map((a, i) => `${i + 1}. ${a.title}\n   ${(a.description ?? "").slice(0, 200)}`)
    .join("\n\n");

  const res = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 500,
    messages: [{
      role:    "user",
      content: `Write a personal news brief summarising the key themes across these top stories in 4-5 sentences of plain prose. Be direct and informative. No bullet points or headers.

Top stories:
${articleList}`,
    }],
  });

  const summary = res.content[0].type === "text" ? res.content[0].text.trim() : "";
  const sources = articles.slice(0, 5).map((a) => ({ title: a.title, url: a.url }));

  const brief: NewsBrief = {
    date:          today,
    summary,
    sources,
    generated_at:  new Date().toISOString(),
    article_count: articles.length,
  };

  await briefRef.set(brief);
  return NextResponse.json({ brief });
}

export async function DELETE(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const db    = getAdminDb();
  await db.doc(`users/${uid}/news_brief/${today}`).delete();
  return NextResponse.json({ ok: true });
}
