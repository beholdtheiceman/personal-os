# Personal Newsfeed — Implementation Guide

## Overview

A curated, AI-filtered news aggregator built into the app. Pulls from RSS feeds and APIs you choose, deduplicates and classifies each item, and surfaces the stories most relevant to your actual life — not an algorithm's idea of engagement. Think Google Reader with Claude as the filter layer.

**Estimated effort:** 2–3 days  
**Dependencies:** None (Tavily already wired; can optionally enhance with it)  
**Data stores:** New Firestore collection `users/{uid}/news_items` + `users/{uid}/news_feeds`

---

## Architecture

```
RSS/API Sources
      │
      ▼
GET /api/news/refresh (cron, every 30–60 min)
      │
      ├─ Fetch + deduplicate items
      ├─ Claude Haiku classifies: topic, relevance, type
      ├─ Write to Firestore news_items
      │
      ▼
GET /api/news/feed (client read)
      │
      ▼
/news page + dashboard widget
```

---

## Step 1: Data Model

### Firestore: `users/{uid}/news_feeds/{feedId}`
```ts
interface NewsFeed {
  id: string;
  url: string;          // RSS URL or API endpoint
  name: string;
  type: "rss" | "reddit" | "custom";
  category: string;     // "tech" | "finance" | "world" | "sports" | etc.
  enabled: boolean;
  last_fetched: string; // ISO timestamp
}
```

### Firestore: `users/{uid}/news_items/{itemId}`
```ts
interface NewsItem {
  id: string;           // hash of (feedId + link) for dedup
  feed_id: string;
  feed_name: string;
  title: string;
  summary: string;      // Claude-generated if article is too long; raw otherwise
  url: string;
  published_at: string;
  fetched_at: string;
  category: string;     // from feed + Claude classification
  tags: string[];       // Claude-extracted topics
  relevance_score: number; // 0–10, Claude-assessed against your interests
  read: boolean;
  saved: boolean;
  image_url?: string;
}
```

---

## Step 2: Feed Refresh Endpoint

### `app/api/news/refresh/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase-admin";
import Parser from "rss-parser"; // npm install rss-parser

const parser = new Parser();
const client = new Anthropic();

// Called by cron or manually
export async function GET(req: NextRequest) {
  // Auth: cron secret or user token
  const secret = req.headers.get("x-cron-secret");
  const isCron = secret === process.env.CRON_SECRET;
  if (!isCron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    await refreshFeedsForUser(uid, db);
  }

  return NextResponse.json({ ok: true });
}

async function refreshFeedsForUser(uid: string, db: FirebaseFirestore.Firestore) {
  const feedsSnap = await db
    .collection("users").doc(uid)
    .collection("news_feeds")
    .where("enabled", "==", true)
    .get();

  for (const feedDoc of feedsSnap.docs) {
    const feed = feedDoc.data() as NewsFeed;
    try {
      const items = await fetchFeed(feed);
      await classifyAndStore(uid, feed, items, db);
      await feedDoc.ref.update({ last_fetched: new Date().toISOString() });
    } catch (err) {
      console.error(`Feed error [${feed.name}]:`, err);
    }
  }
}

async function fetchFeed(feed: NewsFeed): Promise<RawItem[]> {
  if (feed.type === "reddit") {
    // Reddit's JSON API — no auth needed for public subreddits
    const res = await fetch(`https://www.reddit.com/r/${feed.url}/hot.json?limit=25`, {
      headers: { "User-Agent": "personal-os/1.0" },
    });
    const data = await res.json();
    return data.data.children.map((c: any) => ({
      title: c.data.title,
      url: c.data.url,
      summary: c.data.selftext?.slice(0, 500) || "",
      published_at: new Date(c.data.created_utc * 1000).toISOString(),
    }));
  }

  // Standard RSS
  const parsed = await parser.parseURL(feed.url);
  return (parsed.items || []).slice(0, 30).map(item => ({
    title: item.title || "",
    url: item.link || "",
    summary: item.contentSnippet?.slice(0, 500) || item.summary?.slice(0, 500) || "",
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
  }));
}

async function classifyAndStore(
  uid: string,
  feed: NewsFeed,
  items: RawItem[],
  db: FirebaseFirestore.Firestore
) {
  const itemsRef = db.collection("users").doc(uid).collection("news_items");

  for (const item of items) {
    // Dedup by content hash
    const id = Buffer.from(feed.id + item.url).toString("base64url").slice(0, 20);
    const existing = await itemsRef.doc(id).get();
    if (existing.exists) continue;

    // Classify with Claude Haiku (cheap, fast)
    let tags: string[] = [];
    let relevance_score = 5;

    try {
      const res = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Classify this news item. Return JSON only.
Title: ${item.title}
Summary: ${item.summary}

Return: {"tags": ["tag1","tag2","tag3"], "relevance": 7}
Tags should be 2-4 specific topics. Relevance is 1-10 (10 = must read, 1 = noise).`,
        }],
      });
      const parsed = JSON.parse(res.content[0].type === "text" ? res.content[0].text : "{}");
      tags = parsed.tags || [];
      relevance_score = parsed.relevance || 5;
    } catch {
      // classification is best-effort
    }

    await itemsRef.doc(id).set({
      id,
      feed_id: feed.id,
      feed_name: feed.name,
      title: item.title,
      summary: item.summary,
      url: item.url,
      published_at: item.published_at,
      fetched_at: new Date().toISOString(),
      category: feed.category,
      tags,
      relevance_score,
      read: false,
      saved: false,
    });
  }
}
```

---

## Step 3: Read Endpoint

### `app/api/news/feed/route.ts`

```ts
export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { uid } = await getAdminAuth().verifyIdToken(token!);
  const db = getAdminDb();

  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category"); // optional filter
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50");

  let query = db
    .collection("users").doc(uid)
    .collection("news_items")
    .orderBy("relevance_score", "desc")
    .orderBy("published_at", "desc")
    .limit(limit);

  if (unreadOnly) query = query.where("read", "==", false);
  if (category) query = query.where("category", "==", category);

  const snap = await query.get();
  return NextResponse.json(snap.docs.map(d => d.data()));
}
```

---

## Step 4: Starter Feed List

```ts
// lib/default-feeds.ts
export const DEFAULT_FEEDS: Omit<NewsFeed, "id" | "last_fetched">[] = [
  // World / General
  { url: "https://feeds.bbci.co.uk/news/rss.xml", name: "BBC News", type: "rss", category: "world", enabled: true },
  { url: "https://feeds.npr.org/1001/rss.xml", name: "NPR News", type: "rss", category: "world", enabled: true },

  // Tech
  { url: "https://feeds.feedburner.com/TechCrunch", name: "TechCrunch", type: "rss", category: "tech", enabled: true },
  { url: "https://www.theverge.com/rss/index.xml", name: "The Verge", type: "rss", category: "tech", enabled: true },
  { url: "https://hnrss.org/frontpage", name: "Hacker News", type: "rss", category: "tech", enabled: true },

  // Finance
  { url: "https://feeds.finance.yahoo.com/rss/2.0/headline", name: "Yahoo Finance", type: "rss", category: "finance", enabled: true },
  { url: "https://www.reddit.com/r/personalfinance", name: "r/personalfinance", type: "reddit", category: "finance", enabled: false },

  // Faith
  { url: "https://www.desiringgod.org/articles.rss", name: "Desiring God", type: "rss", category: "faith", enabled: false },

  // Sports (configure per preference)
  { url: "https://www.espn.com/espn/rss/news", name: "ESPN", type: "rss", category: "sports", enabled: false },
];
```

---

## Step 5: UI — `/news` Page

```
┌─────────────────────────────────────────────────┐
│  📰 News                          [Refresh] [⚙]  │
│                                                   │
│  [All] [World] [Tech] [Finance] [Faith] [Sports]  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ ★ BBC News · 20m ago               ██████ 9 │  │
│  │ OpenAI Releases New Model           [Save]   │  │
│  │ The new model scores 40% higher...           │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Hacker News · 45m ago              █████ 8  │  │
│  │ Show HN: I built a...               [Save]   │  │
│  │ ...                                          │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

Key interactions:
- Click article → mark read, open in new tab
- Save → adds to Reading List collection
- Swipe left (mobile) → dismiss
- Relevance score bar (1–10) shown on each card
- "Refresh" button triggers manual `GET /api/news/refresh`

---

## Step 6: Dashboard Widget

A compact "Top Stories" widget showing the 3 highest-relevance unread items from the past 6 hours. Tap any story to open the full article.

---

## Step 7: Chat Tools

```ts
{ name: "get_news_feed", description: "Get recent news items", input_schema: { type: "object", properties: { category: { type: "string" }, limit: { type: "number" } } } },
{ name: "save_article", description: "Save a news article to reading list", input_schema: { type: "object", properties: { url: { type: "string" }, title: { type: "string" } }, required: ["url", "title"] } },
{ name: "add_news_feed", description: "Add a new RSS feed", input_schema: { type: "object", properties: { url: { type: "string" }, name: { type: "string" }, category: { type: "string" } }, required: ["url", "name", "category"] } },
```

---

## Cron Setup

In `vercel.json`:
```json
{ "path": "/api/news/refresh", "schedule": "0 * * * *" }
```

Every hour. For more frequent updates, go every 30 minutes with `"*/30 * * * *"`.

---

## Costs

- **RSS parsing** — free (rss-parser runs server-side)
- **Claude Haiku classification** — ~$0.002 per 30 articles, ~$0.15/month at hourly refresh
- **Reddit JSON** — free, no auth needed for public subreddits

---

## Suggested Build Order

1. Basic RSS fetch + store without classification (verify pipeline)
2. Add Haiku classification
3. Build `/news` page with feed list from Firestore
4. Dashboard widget
5. Chat tools
6. Feed management UI (add/remove/toggle feeds in Settings)
