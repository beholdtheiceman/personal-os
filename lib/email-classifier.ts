// Email classification and data extraction using Claude
// Triage pass: Haiku (cheap, batch) → Extraction: Sonnet (accurate, per-email)
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import type { EmailMeta, Subscription, Transaction } from "@/types";

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const HAIKU  = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

// ─── Classification ───────────────────────────────────────────────────────────

export type EmailClass = "subscription" | "receipt" | "ignore";

export async function classifyEmails(
  emails: EmailMeta[]
): Promise<{ id: string; type: EmailClass }[]> {
  if (emails.length === 0) return [];

  const prompt = `Classify these emails. Respond with a JSON array ONLY — no markdown fences, no explanation.
Format: [{"id":"...","type":"receipt"|"subscription"|"ignore"}, ...]

Rules:
- "receipt" = one-time purchase confirmation, order confirmation, payment receipt, or charge notification
- "subscription" = subscription confirmation, renewal notice, billing notice, or new recurring service signup
- "ignore" = everything else: newsletters, promotions, shipping updates without a charge, personal emails
- When in doubt, use "ignore" — false positives are worse than misses
- Do NOT classify promotional emails or "offer" emails as receipts unless they confirm an actual charge

Emails:
${emails.map((e) => `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`).join("\n---\n")}`;

  try {
    const res = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
    // Strip any accidental markdown fences
    const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(clean) as { id: string; type: string }[];

    return parsed.map((item) => ({
      id: item.id,
      type: (["subscription", "receipt"].includes(item.type) ? item.type : "ignore") as EmailClass,
    }));
  } catch (err) {
    console.error("[email-classifier] classifyEmails error:", err);
    // On failure, treat all as ignore — never throw
    return emails.map((e) => ({ id: e.id, type: "ignore" as EmailClass }));
  }
}

// ─── Subscription Extraction ──────────────────────────────────────────────────

export async function extractSubscription(
  body: string,
  subject: string,
  from: string,
  emailDate: string
): Promise<Partial<Omit<Subscription, "id" | "status" | "created_at">> | null> {
  const prompt = `Extract subscription billing information from this email. Respond with a single JSON object ONLY — no markdown, no explanation.

Fields (omit any you cannot determine with confidence from the email text):
{
  "name": "service name e.g. Netflix, Spotify, Adobe Creative Cloud",
  "category": one of ["Entertainment","Productivity","Health & Fitness","Finance","Utilities","Food & Drink","Gaming","News & Media","Shopping","Other"],
  "amount": number (USD, no currency symbol — omit if not stated),
  "billing_cycle": one of ["weekly","monthly","quarterly","yearly"] — omit if unclear,
  "next_billing_date": "YYYY-MM-DD" — omit if not stated,
  "start_date": "YYYY-MM-DD" (use the email date ${emailDate} if this is a new signup confirmation)
}

From: ${from}
Subject: ${subject}
Email date: ${emailDate}
---
${body}`;

  try {
    const res = await anthropic.messages.create({
      model: SONNET,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
    const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;

    // Require at least a name to be useful
    if (!parsed.name) return null;

    return {
      name:              typeof parsed.name === "string" ? parsed.name : undefined,
      category:          typeof parsed.category === "string" ? parsed.category as Subscription["category"] : "Other",
      amount:            typeof parsed.amount === "number" ? parsed.amount : undefined,
      billing_cycle:     typeof parsed.billing_cycle === "string" ? parsed.billing_cycle as Subscription["billing_cycle"] : undefined,
      next_billing_date: typeof parsed.next_billing_date === "string" ? parsed.next_billing_date : undefined,
      start_date:        typeof parsed.start_date === "string" ? parsed.start_date : emailDate,
    };
  } catch (err) {
    console.error("[email-classifier] extractSubscription error:", err);
    return null;
  }
}

// ─── Transaction Extraction ───────────────────────────────────────────────────

export async function extractTransaction(
  body: string,
  subject: string,
  from: string,
  emailDate: string
): Promise<Partial<Omit<Transaction, "id" | "type" | "source">> | null> {
  const prompt = `Extract transaction data from this receipt or payment confirmation email. Respond with a single JSON object ONLY — no markdown, no explanation.

Fields (omit any you cannot determine with confidence):
{
  "description": "short description e.g. 'Amazon order' or 'Uber ride' or 'DoorDash order'",
  "amount": number (USD total charge — omit if not clearly stated),
  "category": one of ["Food","Transport","Housing","Utilities","Health","Shopping","Entertainment","Education","Other"],
  "date": "YYYY-MM-DD" — use the actual charge date from the email, NOT today; if uncertain use ${emailDate}
}

Important: Only extract real charges. If this is a promotional email without an actual confirmed charge, return {}.

From: ${from}
Subject: ${subject}
Email date: ${emailDate}
---
${body}`;

  try {
    const res = await anthropic.messages.create({
      model: SONNET,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
    const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;

    // Require at least a description to be useful
    if (!parsed.description) return null;

    return {
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      amount:      typeof parsed.amount === "number" ? parsed.amount : undefined,
      category:    typeof parsed.category === "string" ? parsed.category : "Other",
      date:        typeof parsed.date === "string" ? parsed.date : emailDate,
    };
  } catch (err) {
    console.error("[email-classifier] extractTransaction error:", err);
    return null;
  }
}
