// GET /api/news/refresh — Vercel cron route (hourly)
// Fetches RSS/Reddit feeds for all users and classifies with Claude Haiku.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { getEnv, ANTHROPIC_API_KEY } from "@/lib/env";
import { DEFAULT_FEEDS } from "@/lib/default-feeds";
import type { NewsFeed, NewsItem } from "@/types";

export const maxDuration = 60;

const parser = new Parser({ timeout: 10_000 });
const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

type RawArticle = { title: string; url: string; description: string; published_at: string };
type ClassifiedArticle = RawArticle & { tags: string[]; relevance_score: number };

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = getEnv("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const isCron     = cronSecret ? authHeader === `Bearer ${cronSecret}` : false;

  // Accept either cron secret (all users) or user ID token (that user only)
  let singleUid: string | null = null;
  if (!isCron) {
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
      singleUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const force = req.nextUrl.searchParams.get("force") === "true";
  const db = getAdminDb();
  let processed = 0;
  let skipped   = 0;

  if (singleUid) {
    const result = await refreshForUser(singleUid, db, force);
    processed = result.processed;
    skipped   = result.skipped;
    return NextResponse.json({ ok: true, processed, skipped, users: 1 });
  }

  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    try {
      const result = await refreshForUser(uid, db, force);
      processed += result.processed;
      skipped   += result.skipped;
    } catch (err) {
      console.error(`[news/refresh] user ${uid} failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, processed, skipped, users: usersSnap.size });
}

// ── Per-user refresh ──────────────────────────────────────────────────────────

async function refreshForUser(
  uid: string,
  db: FirebaseFirestore.Firestore,
  force = false
): Promise<{ processed: number; skipped: number }> {
  const feedsRef = db.collection(`users/${uid}/news_feeds`);
  let feedsSnap = await feedsRef.where("enabled", "==", true).get();

  // Seed default feeds on first run
  if ((await feedsRef.get()).empty) {
    const now = new Date().toISOString();
    const batch = db.batch();
    for (const tpl of DEFAULT_FEEDS) {
      const ref = feedsRef.doc();
      batch.set(ref, { ...tpl, id: ref.id, created_at: now });
    }
    await batch.commit();
    feedsSnap = await feedsRef.where("enabled", "==", true).get();
  }

  let processed = 0;
  let skipped   = 0;

  // Pre-fetch starred tags for personalised relevance scoring
  const readerInterests = await getStarredTags(uid, db);

  for (const feedDoc of feedsSnap.docs) {
    const feed = { ...feedDoc.data(), id: feedDoc.id } as NewsFeed;
    try {
      const raw = feed.type === "reddit"
        ? await fetchReddit(feed.url)
        : await fetchRss(feed.url);

      const classified = await classifyArticles(raw, feed.tags, readerInterests);
      const itemsRef = db.collection(`users/${uid}/news_items`);

      for (const article of classified) {
        const id = makeItemId(feed.id, article.url);
        const existing = await itemsRef.doc(id).get();
        if (existing.exists && !force) { skipped++; continue; }
        if (existing.exists && force) {
          // Re-classify: only update tags and relevance_score
          await itemsRef.doc(id).update({ tags: article.tags, relevance_score: article.relevance_score });
          skipped++;
          continue;
        }

        const item: Omit<NewsItem, "saved_at"> = {
          id,
          feed_id:         feed.id,
          feed_name:       feed.name,
          title:           article.title,
          url:             article.url,
          description:     article.description,
          published_at:    article.published_at,
          fetched_at:      new Date().toISOString(),
          tags:            article.tags,
          relevance_score: article.relevance_score,
          status:          "unread",
        };

        await itemsRef.doc(id).set(item);
        processed++;
      }
    } catch (err) {
      console.error(`[news/refresh] feed "${feed.name}" failed:`, err);
    }
  }

  return { processed, skipped };
}

// ── Starred tag helper ────────────────────────────────────────────────────────

async function getStarredTags(uid: string, db: FirebaseFirestore.Firestore): Promise<string[]> {
  try {
    const snap = await db.collection(`users/${uid}/news_items`)
      .where("starred", "==", true).limit(30).get();
    const tagSet = new Set<string>();
    snap.docs.forEach((d) => ((d.data().tags ?? []) as string[]).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  } catch { return []; }
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchRss(url: string): Promise<RawArticle[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).slice(0, 30).map((item) => ({
      title:        item.title ?? "",
      url:          item.link  ?? "",
      description:  (item.contentSnippet ?? item.summary ?? "").slice(0, 400),
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    })).filter((a) => a.title && a.url);
  } catch {
    return [];
  }
}

async function fetchReddit(subreddit: string): Promise<RawArticle[]> {
  try {
    const slug = subreddit.replace(/^r\//, "");
    const res  = await fetch(
      `https://www.reddit.com/r/${slug}/hot.json?limit=25`,
      { headers: { "User-Agent": "personal-os/1.0" } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data?.children ?? []).map((c: any) => {
      const d = c.data;
      return {
        title:        d.title ?? "",
        url:          `https://reddit.com${d.permalink}`,
        description:  (d.selftext ?? "").slice(0, 400),
        published_at: new Date(d.created_utc * 1000).toISOString(),
      };
    }).filter((a: RawArticle) => a.title && a.url);
  } catch {
    return [];
  }
}

// ── Claude Haiku classification ───────────────────────────────────────────────

async function classifyArticles(
  articles: RawArticle[],
  feedTags: string[],
  readerInterests: string[] = []
): Promise<ClassifiedArticle[]> {
  if (articles.length === 0) return [];

  const BATCH = 10;
  const results: ClassifiedArticle[] = [];

  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH);
    const payload = batch.map((a, idx) => `${idx}: ${a.title}\n${a.description}`).join("\n\n");

    let classifications: { tags: string[]; relevance: number }[] = [];

    try {
      const res = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{
          role:    "user",
          content: `Classify these ${batch.length} news items. Return a JSON array of exactly ${batch.length} objects, one per item in order.
Each object: {"tags":["tag1","tag2"],"relevance":7}
- tags: 2-4 specific topics (tech, finance, world, sports, faith, science, culture, etc.)
- relevance: 1-10 (10=must-read, 1=noise)${readerInterests.length > 0 ? `\n- Reader interests (boost relevance for these topics): ${readerInterests.join(", ")}` : ""}

Items:
${payload}

Return only the JSON array, no other text.`,
        }],
      });

      const text = res.content[0].type === "text" ? res.content[0].text.trim() : "[]";
      const jsonStart = text.indexOf("[");
      const jsonEnd   = text.lastIndexOf("]");
      const jsonStr   = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : "[]";
      classifications = JSON.parse(jsonStr);
    } catch (err) {
      console.error("[news/refresh] Haiku classification failed:", err);
      classifications = batch.map(() => ({ tags: feedTags, relevance: 5 }));
    }

    for (let j = 0; j < batch.length; j++) {
      results.push({
        ...batch[j],
        tags:            classifications[j]?.tags     ?? feedTags,
        relevance_score: classifications[j]?.relevance ?? 5,
      });
    }
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItemId(feedId: string, url: string): string {
  return Buffer.from(`${feedId}|${url}`).toString("base64url").slice(0, 40);
}
