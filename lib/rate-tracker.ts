// Rate Tracker — core types, RSS parsing, FRED benchmark rates, eligibility.
// Firestore paths:
//   rate_offers/{offerId}              — global parsed offers (server-write only)
//   benchmark_rates/latest             — FRED benchmark rates
//   users/{uid}/settings/rate_profile  — user profile (institutions, balance, etc.)
//   users/{uid}/rate_taken/{offerId}   — offers the user has applied for

import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase-admin";
import { ANTHROPIC_API_KEY } from "@/lib/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OfferType =
  | "savings_apy"
  | "cd_apy"
  | "checking_bonus"
  | "credit_card_bonus"
  | "brokerage_bonus"
  | "other";

export interface RateOffer {
  id: string;
  source: "doctor_of_credit" | "reddit_churning" | "reddit_personalfinance";
  type: OfferType;
  institution: string;
  title: string;
  apy?: number;
  bonus_amount?: number;
  spend_requirement?: number;
  spend_timeframe_days?: number;
  minimum_balance?: number;
  direct_deposit_required: boolean;
  new_customer_only: boolean;
  expires_at?: string;             // YYYY-MM-DD
  source_url: string;
  scraped_at: string;              // ISO timestamp
  raw_title: string;
}

export interface RateProfile {
  existing_institutions: string[];
  cards_opened_24mo: number;       // for Chase 5/24
  current_cards: string[];
  deployable_balance: number;      // cash available to deploy
  updated_at: string;
}

export interface BenchmarkRates {
  fed_funds: number;
  treasury_1y: number;
  treasury_5y: number;
  treasury_10y: number;
  updated_at: string;
}

export interface EligibilityResult {
  eligible: boolean;
  warnings: string[];
  estimated_value: number;
  can_hit_spend: boolean;
}

// ─── RSS / Reddit scraping ────────────────────────────────────────────────────

interface RawItem {
  title: string;
  link: string;
  content: string;
  source: RateOffer["source"];
}

export async function fetchRawItems(): Promise<RawItem[]> {
  const items: RawItem[] = [];

  // Doctor of Credit RSS
  try {
    const res = await fetch("https://www.doctorofcredit.com/feed/", {
      headers: { "User-Agent": "PersonalOS/1.0 (rate tracker)" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const xml = await res.text();
      const titles = [...xml.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>/gs)].slice(1);
      const links  = [...xml.matchAll(/<link>(?!https?:\/\/www\.doctorofcredit\.com\/)(.+?)<\/link>/gs)];
      const descs  = [...xml.matchAll(/<description><!\[CDATA\[(.+?)\]\]><\/description>/gs)].slice(1);
      for (let i = 0; i < Math.min(titles.length, 20); i++) {
        items.push({
          title: (titles[i]?.[1] ?? "").trim(),
          link: (links[i]?.[1] ?? "").trim(),
          content: (descs[i]?.[1] ?? "").replace(/<[^>]+>/g, " ").slice(0, 400),
          source: "doctor_of_credit",
        });
      }
    }
  } catch { /* skip on timeout */ }

  // Reddit r/churning
  try {
    const res = await fetch("https://www.reddit.com/r/churning/new.json?limit=25", {
      headers: { "User-Agent": "PersonalOS/1.0 (rate tracker)" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const json = await res.json();
      for (const post of (json?.data?.children ?? []).slice(0, 15)) {
        const d = post?.data ?? {};
        items.push({
          title: (d.title as string) ?? "",
          link: `https://reddit.com${d.permalink as string ?? ""}`,
          content: ((d.selftext as string) ?? "").slice(0, 400),
          source: "reddit_churning",
        });
      }
    }
  } catch { /* skip */ }

  // Reddit r/personalfinance high-yield savings
  try {
    const res = await fetch(
      "https://www.reddit.com/r/personalfinance/search.json?q=high+yield+savings+APY+bonus&sort=new&limit=10&restrict_sr=1",
      {
        headers: { "User-Agent": "PersonalOS/1.0 (rate tracker)" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) {
      const json = await res.json();
      for (const post of (json?.data?.children ?? []).slice(0, 10)) {
        const d = post?.data ?? {};
        items.push({
          title: (d.title as string) ?? "",
          link: `https://reddit.com${d.permalink as string ?? ""}`,
          content: ((d.selftext as string) ?? "").slice(0, 400),
          source: "reddit_personalfinance",
        });
      }
    }
  } catch { /* skip */ }

  return items.filter((i) => i.title.length > 5);
}

// ─── Haiku parsing ────────────────────────────────────────────────────────────

interface ParsedOffer {
  is_relevant: boolean;
  institution: string | null;
  type: OfferType;
  apy: number | null;
  bonus_amount: number | null;
  spend_requirement: number | null;
  spend_timeframe_days: number | null;
  minimum_balance: number | null;
  direct_deposit_required: boolean;
  new_customer_only: boolean;
  expires_at: string | null;
}

export async function parseOfferWithHaiku(item: RawItem): Promise<ParsedOffer | null> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      tools: [
        {
          name: "extract_offer",
          description: "Extract structured financial offer data.",
          input_schema: {
            type: "object" as const,
            properties: {
              is_relevant: { type: "boolean", description: "Is this a rate/bonus offer worth tracking?" },
              institution: { type: "string", description: "Bank or card issuer name." },
              type: { type: "string", enum: ["savings_apy", "cd_apy", "checking_bonus", "credit_card_bonus", "brokerage_bonus", "other"] },
              apy: { type: "number", description: "APY as a number e.g. 5.25. Null if not applicable." },
              bonus_amount: { type: "number", description: "Dollar bonus, e.g. 300." },
              spend_requirement: { type: "number", description: "Spend req in dollars." },
              spend_timeframe_days: { type: "number", description: "Days to meet spend req." },
              minimum_balance: { type: "number", description: "Min balance required." },
              direct_deposit_required: { type: "boolean" },
              new_customer_only: { type: "boolean" },
              expires_at: { type: "string", description: "Expiry YYYY-MM-DD or null." },
            },
            required: ["is_relevant", "type", "direct_deposit_required", "new_customer_only"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_offer" },
      messages: [{ role: "user", content: `Title: ${item.title}\n\nContent: ${item.content}` }],
    });
    const toolUse = msg.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    return toolUse.input as ParsedOffer;
  } catch {
    return null;
  }
}

// ─── Sync offers ──────────────────────────────────────────────────────────────

export async function syncOffers(): Promise<{ added: number; skipped: number }> {
  const db = getAdminDb();
  const items = await fetchRawItems();

  const existingSnap = await db.collection("rate_offers")
    .orderBy("scraped_at", "desc").limit(200).get();
  const existingUrls = new Set(existingSnap.docs.map((d) => d.data().source_url as string));

  let added = 0;
  let skipped = 0;

  for (const item of items) {
    if (existingUrls.has(item.link)) { skipped++; continue; }
    const parsed = await parseOfferWithHaiku(item);
    if (!parsed || !parsed.is_relevant || !parsed.institution) { skipped++; continue; }

    const offer: Omit<RateOffer, "id"> = {
      source: item.source,
      type: parsed.type,
      institution: parsed.institution,
      title: item.title.slice(0, 200),
      raw_title: item.title,
      source_url: item.link,
      scraped_at: new Date().toISOString(),
      direct_deposit_required: parsed.direct_deposit_required ?? false,
      new_customer_only: parsed.new_customer_only ?? false,
      ...(parsed.apy != null && { apy: parsed.apy }),
      ...(parsed.bonus_amount != null && { bonus_amount: parsed.bonus_amount }),
      ...(parsed.spend_requirement != null && { spend_requirement: parsed.spend_requirement }),
      ...(parsed.spend_timeframe_days != null && { spend_timeframe_days: parsed.spend_timeframe_days }),
      ...(parsed.minimum_balance != null && { minimum_balance: parsed.minimum_balance }),
      ...(parsed.expires_at && { expires_at: parsed.expires_at }),
    };

    await db.collection("rate_offers").add(offer);
    existingUrls.add(item.link);
    added++;
  }

  return { added, skipped };
}

// ─── FRED benchmark rates ─────────────────────────────────────────────────────

async function fetchFredSeries(seriesId: string, apiKey: string): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&sort_order=desc&limit=1&file_type=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const val = parseFloat(data?.observations?.[0]?.value ?? "");
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

export async function syncBenchmarkRates(): Promise<BenchmarkRates | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;
  const [fedFunds, treasury1y, treasury5y, treasury10y] = await Promise.all([
    fetchFredSeries("FEDFUNDS", apiKey),
    fetchFredSeries("TB1YR", apiKey),
    fetchFredSeries("GS5", apiKey),
    fetchFredSeries("GS10", apiKey),
  ]);
  if (fedFunds == null && treasury1y == null) return null;
  const rates: BenchmarkRates = {
    fed_funds: fedFunds ?? 0,
    treasury_1y: treasury1y ?? 0,
    treasury_5y: treasury5y ?? 0,
    treasury_10y: treasury10y ?? 0,
    updated_at: new Date().toISOString(),
  };
  const db = getAdminDb();
  await db.doc("benchmark_rates/latest").set(rates);
  return rates;
}

export async function getBenchmarkRates(): Promise<BenchmarkRates | null> {
  const db = getAdminDb();
  const snap = await db.doc("benchmark_rates/latest").get();
  if (!snap.exists) return null;
  return snap.data() as BenchmarkRates;
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export function computeEligibility(
  offer: RateOffer,
  profile: RateProfile,
  avgMonthlySpend: number,
): EligibilityResult {
  const warnings: string[] = [];
  const institutionLower = offer.institution.toLowerCase();

  const alreadyHas = profile.existing_institutions.some(
    (i) => institutionLower.includes(i.toLowerCase()) || i.toLowerCase().includes(institutionLower)
  );
  if (offer.new_customer_only && alreadyHas) {
    warnings.push(`Already have an account at ${offer.institution}`);
  }

  if (
    offer.type === "credit_card_bonus" &&
    institutionLower.includes("chase") &&
    profile.cards_opened_24mo >= 5
  ) {
    warnings.push(`Chase 5/24: opened ${profile.cards_opened_24mo} cards in 24mo (need <5)`);
  }

  let can_hit_spend = true;
  if (offer.spend_requirement && offer.spend_timeframe_days) {
    const requiredMonthly = offer.spend_requirement / (offer.spend_timeframe_days / 30);
    can_hit_spend = avgMonthlySpend >= requiredMonthly * 0.8;
    if (!can_hit_spend) {
      warnings.push(
        `Spend req $${offer.spend_requirement} in ${offer.spend_timeframe_days}d — avg monthly: $${Math.round(avgMonthlySpend)}`
      );
    }
  }

  let estimated_value = 0;
  if (offer.type === "savings_apy" || offer.type === "cd_apy") {
    estimated_value = profile.deployable_balance * ((offer.apy ?? 0) / 100);
  } else if (offer.bonus_amount) {
    estimated_value = offer.bonus_amount;
  }

  const hardBlocking = warnings.filter(
    (w) => w.includes("Already have") || w.includes("5/24")
  ).length;

  return { eligible: hardBlocking === 0, warnings, estimated_value, can_hit_spend };
}

// ─── Ranked offers for a user ─────────────────────────────────────────────────

export interface RankedOffer extends RateOffer {
  eligibility: EligibilityResult;
  taken: boolean;
}

export async function getRankedOffersForUser(uid: string): Promise<RankedOffer[]> {
  const db = getAdminDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const [offersSnap, profileSnap, takenSnap, plaidTxSnap] = await Promise.all([
    db.collection("rate_offers").orderBy("scraped_at", "desc").limit(100).get(),
    db.doc(`users/${uid}/settings/rate_profile`).get(),
    db.collection(`users/${uid}/rate_taken`).get(),
    db.collection(`users/${uid}/plaid_transactions`)
      .where("date", ">=", (() => {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        return d.toISOString().slice(0, 10);
      })())
      .get(),
  ]);

  const profile: RateProfile = profileSnap.exists
    ? (profileSnap.data() as RateProfile)
    : { existing_institutions: [], cards_opened_24mo: 0, current_cards: [], deployable_balance: 0, updated_at: "" };

  const takenIds = new Set(takenSnap.docs.map((d) => d.id));

  let totalSpend = 0;
  for (const tx of plaidTxSnap.docs) {
    const amt = tx.data().amount as number;
    if (amt > 0) totalSpend += amt;
  }
  const avgMonthlySpend = totalSpend / 3;

  const ranked: RankedOffer[] = offersSnap.docs.map((d) => {
    const offer = { id: d.id, ...d.data() } as RateOffer;
    return { ...offer, eligibility: computeEligibility(offer, profile, avgMonthlySpend), taken: takenIds.has(d.id) };
  });

  ranked.sort((a, b) => {
    if (a.taken !== b.taken) return a.taken ? 1 : -1;
    if (a.eligibility.eligible !== b.eligibility.eligible) return a.eligibility.eligible ? -1 : 1;
    return b.eligibility.estimated_value - a.eligibility.estimated_value;
  });

  return ranked;
}
