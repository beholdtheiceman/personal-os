// categorizeTransactions — one Claude Haiku batch call that maps Plaid transactions
// (merchant name + Plaid's coarse category + amount) onto a candidate set of category
// labels (the user's own budget categories, falling back to PLAID_CATEGORY_LABELS).
// Returns a confidence per transaction so the caller can flag low-confidence ones for review.
//
// Follows the Haiku JSON-extraction pattern in app/api/ingest/transcript/route.ts.

import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

export interface TxnToCategorize {
  transaction_id: string;
  merchant_name: string;
  plaid_category: string;
  amount: number; // positive = expense/debit, negative = income/credit
}

export interface TxnCategory {
  transaction_id: string;
  ai_category: string;
  confidence: number; // 0..1
}

/**
 * Map each transaction to one of `categories`. Best-effort: returns [] on empty input,
 * missing API key, or a parse failure (caller treats that as "leave uncategorized").
 */
export async function categorizeTransactions(
  txns: TxnToCategorize[],
  categories: string[],
): Promise<TxnCategory[]> {
  if (txns.length === 0 || categories.length === 0 || !ANTHROPIC_API_KEY) return [];

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const system =
    "You are a personal-finance categorizer. You are given a list of bank/card transactions " +
    "and a fixed set of allowed category labels. For EACH transaction, pick the single best " +
    "category from the allowed set based on the merchant name, the bank's coarse category hint, " +
    "and whether it's income (negative amount) or spending (positive amount). " +
    "Return ONLY a valid JSON array (no markdown, no prose) of objects: " +
    `[{ "transaction_id": string, "ai_category": string, "confidence": number }]. ` +
    "ai_category MUST be exactly one of the allowed labels. confidence is 0..1 — be honest; " +
    "use < 0.8 when the merchant is ambiguous or you're guessing.";

  const user =
    `Allowed categories: ${JSON.stringify(categories)}\n\n` +
    `Transactions:\n${JSON.stringify(
      txns.map((t) => ({
        transaction_id: t.transaction_id,
        merchant: t.merchant_name,
        bank_hint: t.plaid_category,
        amount: t.amount,
      })),
    )}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      // ~40 tokens/txn for the JSON; clamp to a sane range.
      max_tokens: Math.min(8192, Math.max(1024, txns.length * 40)),
      system,
      messages: [{ role: "user", content: user }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = parseJsonArray(raw);
    const allowed = new Set(categories);
    const out: TxnCategory[] = [];
    for (const p of parsed) {
      const id = p?.transaction_id;
      const cat = p?.ai_category;
      const conf = p?.confidence;
      if (
        typeof id === "string" &&
        typeof cat === "string" &&
        allowed.has(cat) &&
        typeof conf === "number"
      ) {
        out.push({ transaction_id: id, ai_category: cat, confidence: Math.max(0, Math.min(1, conf)) });
      }
    }
    return out;
  } catch (e) {
    console.error("categorizeTransactions error:", e);
    return [];
  }
}

// Tolerant extraction: handles a bare array or one wrapped in ```json fences / surrounding text.
function parseJsonArray(raw: string): Array<Record<string, unknown>> {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
