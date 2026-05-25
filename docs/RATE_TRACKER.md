# Financial Rate & Promotion Tracker — Implementation Guide

## Overview

A personal aggregator for savings rates, bank account bonuses, credit card offers, and CD rates — filtered through your actual financial situation. Unlike public rate sites, this knows which banks you already have accounts at, your monthly spend, your credit card history, and your savings balance. That context turns a generic list of offers into a ranked, personalized shortlist of things actually worth your time.

**Estimated effort:** 3–4 days (v1), ongoing refinement  
**Dependencies:** Plaid already integrated (account balances + transaction history available); Finance tracker already built  
**Data stores:** New Firestore collections `users/{uid}/rate_offers` + shared `global_rate_feed` (populated by cron)

---

## The Data Problem (And What's Actually Feasible)

There is no clean "best rates API." The data is deliberately fragmented:

- Rate aggregator sites (Bankrate, NerdWallet, DepositAccounts) treat their data as their product and prohibit scraping in their ToS
- Banks rarely publish rates in machine-readable form
- Promotions are marketing campaigns — they change weekly, are sometimes targeted, and can disappear without notice
- Credit card offers are heavily personalized; the advertised offer may not be available to you

**Realistic sources, in order of reliability:**

| Source | Type | Access | Signal Quality |
|--------|------|--------|---------------|
| DepositAccounts.com | RSS | Free RSS feed | Best for savings/CD rates |
| Doctor of Credit | RSS | Free RSS feed | Gold standard for bonuses (low affiliate bias) |
| r/churning | Reddit JSON API | Free, no auth | Real-time "just got approved / bonus posted" signal |
| r/personalfinance | Reddit JSON API | Free, no auth | General rate discussion |
| r/CreditCards | Reddit JSON API | Free, no auth | Card comparison discussion |
| FRED (Federal Reserve) | REST API | Free, no key | Benchmark rates (fed funds, T-bill) — context only |
| Treasury Direct | REST API | Free | T-bill rates, I-bond rates |
| Bank press releases | RSS where available | Free | New product launches |

**The Points Guy / Frequent Miler** — RSS available, useful if travel rewards are relevant to you.

---

## Architecture

```
Ingest Layer (cron, every 4–6 hours)
    │
    ├─ RSS: DepositAccounts.com
    ├─ RSS: Doctor of Credit  
    ├─ Reddit JSON: r/churning, r/personalfinance, r/CreditCards
    ├─ API: FRED (fed funds rate)
    └─ API: TreasuryDirect (T-bill, I-bond)
          │
          ▼
    LLM Parse (Claude Haiku)
    "Chase Sapphire Preferred: 80k points after $4k in 3 months"
          │
          ▼
    Structured offer → Firestore global_rate_feed
    {card, bonus, currency, spend_req, timeframe_days, offer_type, expires_at, ...}
          │
          ▼
    Personalization layer (per-user eligibility check)
    → Am I an existing customer? (can't get "new customer" bonus)
    → Can I hit the spend requirement? (vs. my actual monthly spend from Plaid)
    → Am I under Chase 5/24? (card count in past 24 months)
    → Have I taken this bonus before? (from user's offer history)
          │
          ▼
    /rate-tracker page + dashboard widget + push alerts
```

---

## Step 1: Data Model

### `global_rate_feed/{offerId}` (shared across users, refreshed by cron)

```ts
interface RateOffer {
  id: string;                    // hash of (source + title + date)
  source: string;                // "doctorofcredit" | "depositaccounts" | "reddit_churning" | "fred"
  source_url: string;
  title: string;                 // raw title from feed
  published_at: string;
  fetched_at: string;
  offer_type: OfferType;         // see below
  
  // Structured fields (Claude-extracted)
  institution?: string;          // "Chase", "Marcus", "Discover"
  product_name?: string;         // "Sapphire Preferred", "Online Savings"
  
  // For savings/CD rates
  apy?: number;                  // e.g., 5.10
  rate_type?: "savings" | "cd" | "checking" | "money_market" | "tbill" | "ibond";
  term_months?: number;          // for CDs
  balance_cap?: number;          // "5.1% on first $10k"
  min_balance?: number;
  
  // For bonuses/promotions
  bonus_amount?: number;
  bonus_currency?: "usd" | "points" | "miles" | "cashback_pct";
  spend_requirement?: number;    // dollars to spend to earn bonus
  spend_timeframe_days?: number; // e.g., 90
  direct_deposit_required?: boolean;
  direct_deposit_amount?: number;
  account_fee?: number;          // monthly fee if any
  fee_waiver_condition?: string;
  
  // For credit card offers
  card_network?: "visa" | "mastercard" | "amex" | "discover";
  ongoing_rewards?: string;      // "3% dining, 2% travel"
  annual_fee?: number;
  
  expires_at?: string;           // if expiry is mentioned
  new_customer_only: boolean;    // default true for most offers
  
  // Confidence
  parse_confidence: "high" | "medium" | "low";
  raw_summary: string;           // original text, for reference
  
  verified: boolean;             // has someone manually confirmed this offer?
  last_verified?: string;
}

type OfferType = 
  | "savings_rate"
  | "cd_rate"
  | "checking_bonus"
  | "savings_bonus"
  | "credit_card_signup"
  | "credit_card_limited_offer"
  | "brokerage_bonus"
  | "benchmark_rate"
  | "news";
```

### `users/{uid}/rate_profile` (personal context for eligibility)

```ts
interface RateProfile {
  // Banks where user has existing accounts (excludes "new customer" bonuses)
  existing_institutions: string[];          // ["Chase", "Marcus", "Ally"]
  
  // Credit cards opened in last 24 months (for Chase 5/24 etc.)
  cards_opened_24mo: number;
  
  // Cards user currently holds (to skip "already have this" offers)  
  current_cards: string[];                  // ["Chase Sapphire Preferred", "Amex Gold"]
  
  // Bonuses already taken (to skip lifetime-once offers)
  taken_bonuses: { institution: string; product: string; taken_at: string }[];
  
  // From Plaid: average monthly spend (for spend requirement feasibility)
  avg_monthly_spend: number;               // auto-populated from Plaid data
  
  // Savings available to move (for rate offers)
  available_to_deploy: number;             // manually set or from Plaid
  
  // Preferences
  interested_in_travel_rewards: boolean;
  interested_in_cashback: boolean;
  interested_in_savings_rates: boolean;
  min_bonus_value_usd: number;             // filter out small offers (default: 100)
}
```

### `users/{uid}/rate_alerts/{alertId}` (user-defined alert rules)

```ts
interface RateAlert {
  id: string;
  type: "savings_above" | "bonus_above" | "institution_offer";
  threshold?: number;           // e.g., 5.0 for savings rate
  institution?: string;         // e.g., "Marcus" — alert on any Marcus offer
  enabled: boolean;
}
```

---

## Step 2: Ingest & Parse Endpoint

### `app/api/rates/refresh/route.ts`

```ts
import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { getAdminDb } from "@/lib/firebase-admin";

const client = new Anthropic();
const parser = new Parser();

const SOURCES = [
  {
    id: "doctorofcredit",
    name: "Doctor of Credit",
    url: "https://www.doctorofcredit.com/feed/",
    type: "rss",
  },
  {
    id: "depositaccounts",
    name: "DepositAccounts",
    url: "https://www.depositaccounts.com/blog/feed/",
    type: "rss",
  },
  {
    id: "reddit_churning",
    name: "r/churning",
    url: "churning", // subreddit name
    type: "reddit",
  },
  {
    id: "reddit_personalfinance",
    name: "r/personalfinance",
    url: "personalfinance",
    type: "reddit",
  },
];

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  let newItems = 0;

  for (const source of SOURCES) {
    const items = source.type === "reddit"
      ? await fetchReddit(source.url)
      : await fetchRSS(source.url);

    for (const item of items) {
      const id = Buffer.from(source.id + item.url).toString("base64url").slice(0, 20);
      const existing = await db.collection("global_rate_feed").doc(id).get();
      if (existing.exists) continue;

      const parsed = await parseOfferWithClaude(item.title, item.summary);
      if (!parsed || parsed.offer_type === "news") continue; // skip pure news

      await db.collection("global_rate_feed").doc(id).set({
        id,
        source: source.id,
        source_url: item.url,
        title: item.title,
        published_at: item.published_at,
        fetched_at: new Date().toISOString(),
        raw_summary: item.summary,
        verified: false,
        ...parsed,
      });

      newItems++;
    }
  }

  // Also fetch benchmark rates from FRED
  await fetchFredRates(db);

  return NextResponse.json({ ok: true, new_items: newItems });
}

async function parseOfferWithClaude(title: string, summary: string): Promise<Partial<RateOffer> | null> {
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `You are parsing financial offers for a personal finance app. Extract structured data from this item.

Title: ${title}
Summary: ${summary.slice(0, 800)}

Return JSON with these fields (omit fields that aren't mentioned):
{
  "offer_type": one of: savings_rate | cd_rate | checking_bonus | savings_bonus | credit_card_signup | credit_card_limited_offer | brokerage_bonus | benchmark_rate | news,
  "institution": string or null,
  "product_name": string or null,
  "apy": number (e.g. 5.10) or null,
  "rate_type": savings | cd | checking | money_market or null,
  "term_months": number or null,
  "balance_cap": number or null,
  "bonus_amount": number or null,
  "bonus_currency": usd | points | miles | cashback_pct or null,
  "spend_requirement": number or null,
  "spend_timeframe_days": number or null,
  "direct_deposit_required": boolean,
  "direct_deposit_amount": number or null,
  "annual_fee": number or null,
  "new_customer_only": boolean,
  "expires_at": ISO date string or null,
  "parse_confidence": high | medium | low
}

If this is general financial news with no specific offer, set offer_type to "news".
Return only valid JSON, no explanation.`,
    }],
  });

  try {
    const text = res.content[0].type === "text" ? res.content[0].text : "";
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchFredRates(db: FirebaseFirestore.Firestore) {
  // FRED API — free, no key needed for basic series
  const series = [
    { id: "FEDFUNDS", name: "Federal Funds Rate" },
    { id: "DGS1MO", name: "1-Month T-Bill" },
    { id: "DGS3MO", name: "3-Month T-Bill" },
    { id: "DGS1", name: "1-Year T-Bill" },
  ];

  for (const s of series) {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&sort_order=desc&limit=1&file_type=json&api_key=${process.env.FRED_API_KEY}`
    );
    const data = await res.json();
    const latest = data.observations?.[0];
    if (!latest || latest.value === ".") continue;

    const id = `fred_${s.id}_${latest.date}`;
    await db.collection("global_rate_feed").doc(id).set({
      id,
      source: "fred",
      source_url: `https://fred.stlouisfed.org/series/${s.id}`,
      title: `${s.name}: ${latest.value}%`,
      published_at: latest.date,
      fetched_at: new Date().toISOString(),
      offer_type: "benchmark_rate",
      institution: "US Federal Reserve",
      product_name: s.name,
      apy: parseFloat(latest.value),
      new_customer_only: false,
      verified: true,
      parse_confidence: "high",
    }, { merge: true });
  }
}
```

> **FRED API Key:** Free at https://fred.stlouisfed.org/docs/api/api_key.html — takes 2 minutes. Add to env as `FRED_API_KEY`.

---

## Step 3: Personalized Feed Endpoint

### `app/api/rates/feed/route.ts`

```ts
export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { uid } = await getAdminAuth().verifyIdToken(token!);
  const db = getAdminDb();

  // Get user's rate profile
  const profileDoc = await db.collection("users").doc(uid)
    .collection("rate_profile").doc("config").get();
  const profile = profileDoc.data() as RateProfile | undefined;

  // Get recent offers (last 30 days, exclude pure benchmark rates from main feed)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const offersSnap = await db.collection("global_rate_feed")
    .where("published_at", ">=", thirtyDaysAgo)
    .where("offer_type", "!=", "news")
    .orderBy("offer_type")
    .orderBy("published_at", "desc")
    .limit(100)
    .get();

  const offers = offersSnap.docs.map(d => d.data() as RateOffer);

  // Score each offer against user's profile
  const scored = offers.map(offer => ({
    ...offer,
    eligibility: assessEligibility(offer, profile),
    estimated_value: estimateValue(offer, profile),
  }));

  // Sort: eligible + high value first
  scored.sort((a, b) => {
    if (a.eligibility.eligible && !b.eligibility.eligible) return -1;
    if (!a.eligibility.eligible && b.eligibility.eligible) return 1;
    return (b.estimated_value || 0) - (a.estimated_value || 0);
  });

  return NextResponse.json(scored);
}

function assessEligibility(offer: RateOffer, profile?: RateProfile) {
  const reasons: string[] = [];
  let eligible = true;

  if (!profile) return { eligible: true, reasons: [] };

  // Existing customer check
  if (offer.new_customer_only && offer.institution &&
      profile.existing_institutions.includes(offer.institution)) {
    eligible = false;
    reasons.push(`You already bank with ${offer.institution}`);
  }

  // Already have this card
  if (offer.product_name && profile.current_cards.includes(offer.product_name)) {
    eligible = false;
    reasons.push("You already have this card");
  }

  // Already took this bonus
  const alreadyTook = profile.taken_bonuses.some(
    b => b.institution === offer.institution && b.product === offer.product_name
  );
  if (alreadyTook) {
    eligible = false;
    reasons.push("You've already received this bonus");
  }

  // Chase 5/24 (rough heuristic)
  if (offer.institution === "Chase" && offer.offer_type === "credit_card_signup") {
    if (profile.cards_opened_24mo >= 5) {
      eligible = false;
      reasons.push(`You're over Chase 5/24 (${profile.cards_opened_24mo} cards in 24 months)`);
    }
  }

  // Spend requirement feasibility
  if (offer.spend_requirement && offer.spend_timeframe_days && profile.avg_monthly_spend) {
    const monthsToSpend = offer.spend_timeframe_days / 30;
    const spendCapacity = profile.avg_monthly_spend * monthsToSpend;
    if (offer.spend_requirement > spendCapacity * 1.2) {
      reasons.push(
        `Spend req $${offer.spend_requirement} may be tight ` +
        `(your avg is ~$${Math.round(spendCapacity)} over that period)`
      );
    }
  }

  // Balance cap vs. what you have
  if (offer.apy && offer.balance_cap && profile.available_to_deploy) {
    if (profile.available_to_deploy > offer.balance_cap) {
      reasons.push(
        `Rate only applies to first $${offer.balance_cap.toLocaleString()} ` +
        `(you have $${profile.available_to_deploy.toLocaleString()} to deploy)`
      );
    }
  }

  return { eligible, reasons };
}

function estimateValue(offer: RateOffer, profile?: RateProfile): number {
  if (offer.offer_type === "savings_rate" && offer.apy && profile?.available_to_deploy) {
    const effectiveBalance = offer.balance_cap
      ? Math.min(profile.available_to_deploy, offer.balance_cap)
      : profile.available_to_deploy;
    return (effectiveBalance * (offer.apy / 100)); // annual interest earned
  }

  if (offer.bonus_amount && offer.bonus_currency === "usd") {
    return offer.bonus_amount;
  }

  if (offer.bonus_amount && offer.bonus_currency === "points") {
    return offer.bonus_amount * 0.015; // rough cpp (cents per point) for generic points
  }

  return 0;
}
```

---

## Step 4: Rate Profile Setup

A simple onboarding flow in Settings > Rate Tracker:

```
Which banks do you currently have accounts with?
[Chase] [Bank of America] [Wells Fargo] [Marcus] [Ally] [Discover] [Other...]

Which credit cards do you currently hold?
[Free text input or search]

How many new credit cards have you opened in the last 24 months? [__]

What's your average monthly spending? (auto-filled from Plaid if connected)
[$__,___]

How much do you have available to move to a higher-yield account?
[$__,___]
```

This takes 2 minutes and makes the feed dramatically more useful. Auto-populate what you can from Plaid.

---

## Step 5: UI — `/rate-tracker` Page

```
┌─────────────────────────────────────────────────────┐
│  📊 Rate Tracker                        [⚙ Profile] │
│                                                      │
│  Benchmark: Fed Funds 5.33% · 3-Mo T-Bill 5.25%    │
│                                                      │
│  [For You] [Savings] [Bonuses] [Cards] [All]        │
│                                                      │
│  ✅ ELIGIBLE — Est. value: $510/yr                   │
│  ┌────────────────────────────────────────────────┐  │
│  │ 💰 Marcus Savings — 5.10% APY                  │  │
│  │ Doctor of Credit · 2h ago                      │  │
│  │ No minimum balance · No fees                   │  │
│  │ New customers only                             │  │
│  │ [Mark taken] [Open offer] [Save]               │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ✅ ELIGIBLE — Est. value: $300 bonus                │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🏦 Discover Checking — $300 bonus              │  │
│  │ Doctor of Credit · 4h ago                      │  │
│  │ $1,500 direct deposit within 3 months          │  │
│  │ [Mark taken] [Open offer] [Save]               │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ⚠️ MAY NOT QUALIFY                                  │
│  ┌────────────────────────────────────────────────┐  │
│  │ 💳 Chase Sapphire Preferred — 80k points       │  │
│  │ Doctor of Credit · 1h ago                      │  │
│  │ $4,000 spend in 3 months                       │  │
│  │ ⚠️ You're over Chase 5/24 (6 cards in 24 mo)  │  │
│  │ [Mark taken] [Open offer] [Save]               │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Step 6: Chat Tools

```ts
{
  name: "get_rate_offers",
  description: "Get current financial rate offers and promotions, filtered for user eligibility",
  input_schema: {
    type: "object",
    properties: {
      type: { 
        type: "string",
        enum: ["savings_rate", "checking_bonus", "credit_card_signup", "all"],
        description: "Type of offer to retrieve"
      },
      eligible_only: { type: "boolean", description: "Return only offers user is eligible for" }
    }
  }
},
{
  name: "get_benchmark_rates",
  description: "Get current benchmark interest rates (Fed Funds, T-bills)",
  input_schema: { type: "object", properties: {} }
},
{
  name: "mark_offer_taken",
  description: "Record that user has applied for or received a specific offer",
  input_schema: {
    type: "object",
    properties: {
      institution: { type: "string" },
      product: { type: "string" },
    },
    required: ["institution", "product"]
  }
},
```

---

## Step 7: Push Alerts

Add a `rate_alerts` category to `NotificationSettings`. When the ingest cron finds a new eligible offer above the user's `min_bonus_value_usd` threshold, queue a push notification:

```
"New offer: Marcus 5.10% APY — potentially worth $510/yr for you"
"New offer: $300 Discover checking bonus — you're likely eligible"
```

---

## Freshness & Trust

Every offer card shows:
- Source (Doctor of Credit vs. Reddit)
- Time fetched
- "⚠️ Verify before applying — rates change without notice" disclaimer

A "Last verified" field tracks community confirmation. Reddit comments saying "just got approved" or "bonus posted" increment confidence.

---

## Important Non-Features

- **No "one-tap apply" button** — links open the offer URL in a new tab; the user applies manually. Credit applications have legal implications; you want a human in the loop.
- **No affiliate links** — this is your personal tool, not a business. Don't introduce commission bias.
- **No storing actual account numbers** — the rate profile stores institution names only; Plaid handles account data through its own secure flow.

---

## Env Vars

```
FRED_API_KEY=your_fred_api_key   # free at stlouisfed.org
# No other keys needed for v1
```

---

## Cron Setup

```json
{ "path": "/api/rates/refresh", "schedule": "0 */6 * * *" }
```

Every 6 hours. Doctor of Credit posts multiple times daily; DepositAccounts updates weekly. Six hours is a reasonable balance.

---

## Suggested Build Order

1. Set up ingest cron for Doctor of Credit + DepositAccounts RSS → raw storage (no parsing)
2. Add Claude Haiku parsing to extract structured offer data
3. Build rate profile setup UI in Settings
4. Build personalization / eligibility layer
5. Build `/rate-tracker` page
6. Add chat tools
7. Add FRED benchmark rates
8. Push alerts for high-value eligible offers
9. Reddit signal (add later — more complex to filter signal from noise)
