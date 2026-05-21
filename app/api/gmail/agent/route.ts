// Email Agent — scans Gmail inbox, classifies emails, auto-writes to Finance + Subscriptions
// GET  → Vercel cron (CRON_SECRET auth) — processes all Gmail-connected users
// POST → Manual trigger (Firebase ID token auth) — processes single user via ?uid=
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { CRON_SECRET } from "@/lib/env";
import { refreshGmailToken, extractEmailBody } from "@/lib/gmail-token";
import { classifyEmails, extractSubscription, extractTransaction } from "@/lib/email-classifier";
import type { GmailAgentRun, EmailMeta } from "@/types";

const MAX_EXTRACTIONS = 5; // Keeps runs well inside Vercel timeout on Hobby plan

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isCronAuthed(req: NextRequest): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${CRON_SECRET}`;
}

async function getUidFromIdToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    // Don't treat it as a cron secret
    if (token === CRON_SECRET) return null;
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ─── Gmail helpers ────────────────────────────────────────────────────────────

function parseFromHeader(raw: string) {
  const match = raw.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: raw, email: raw };
}

async function fetchMessageMetaBatch(
  ids: string[],
  accessToken: string
): Promise<EmailMeta[]> {
  const BATCH = 20;
  const results: EmailMeta[] = [];
  const auth = { Authorization: `Bearer ${accessToken}` };

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map((id) =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata` +
            `&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: auth }
        ).then((r) => r.json())
      )
    );
    for (const msg of fetched) {
      if (msg.error) continue;
      const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
      const get = (n: string) =>
        headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      const from = parseFromHeader(get("From"));
      results.push({
        id:      msg.id,
        subject: get("Subject") || "(no subject)",
        from:    from.name || from.email,
        snippet: msg.snippet ?? "",
      });
    }
  }
  return results;
}

async function fetchFullMessage(
  id: string,
  accessToken: string
): Promise<{ body: string; date: string } | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await res.json();
    if (msg.error) return null;

    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const date = headers.find((h) => h.name.toLowerCase() === "date")?.value ?? "";
    // Convert RFC 2822 date to YYYY-MM-DD
    const parsed = date ? new Date(date) : new Date();
    const dateStr = isNaN(parsed.getTime())
      ? new Date().toLocaleDateString("en-CA")
      : parsed.toLocaleDateString("en-CA");

    return { body: extractEmailBody(msg.payload ?? {}), date: dateStr };
  } catch {
    return null;
  }
}

// ─── Dedup helpers ────────────────────────────────────────────────────────────

async function subscriptionExists(uid: string, name: string): Promise<boolean> {
  const db = getAdminDb();
  const snap = await db.collection(`users/${uid}/subscriptions`).get();
  const lower = name.toLowerCase().trim();
  return snap.docs.some((d) => {
    const existing = ((d.data().name as string) ?? "").toLowerCase().trim();
    return existing.includes(lower) || lower.includes(existing);
  });
}

async function transactionExists(
  uid: string,
  description: string,
  amount: number,
  date: string
): Promise<boolean> {
  const db = getAdminDb();
  // Check ±3 days window in email-agent sourced transactions
  const d = new Date(date + "T00:00:00Z");
  const from = new Date(d);
  from.setUTCDate(from.getUTCDate() - 3);
  const cutoff = from.toLocaleDateString("en-CA");

  const snap = await db
    .collection(`users/${uid}/transactions`)
    .where("source", "==", "email-agent")
    .where("date", ">=", cutoff)
    .get();

  const lowerDesc = description.toLowerCase().trim();
  return snap.docs.some((d) => {
    const data = d.data();
    return (
      Math.abs((data.amount as number) - amount) < 0.01 &&
      ((data.description as string) ?? "").toLowerCase().trim() === lowerDesc
    );
  });
}

// ─── Weekly counter helper ────────────────────────────────────────────────────

function computeWeeklyStats(
  existing: GmailAgentRun["stats"] | undefined,
  subsAdded: number,
  txnAdded: number
): GmailAgentRun["stats"] {
  const today = new Date().toLocaleDateString("en-CA");
  const prev = existing ?? {
    subscriptions_added: 0,
    transactions_added: 0,
    last_week_count: 0,
    week_start: today,
  };

  // Reset weekly counter if week_start is > 7 days ago
  const weekStart = new Date(prev.week_start + "T00:00:00Z");
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000);
  const isNewWeek = daysDiff >= 7;

  return {
    subscriptions_added: prev.subscriptions_added + subsAdded,
    transactions_added:  prev.transactions_added  + txnAdded,
    last_week_count:     isNewWeek ? subsAdded + txnAdded : prev.last_week_count + subsAdded + txnAdded,
    week_start:          isNewWeek ? today : prev.week_start,
  };
}

// ─── Core per-user logic ──────────────────────────────────────────────────────

async function processUser(uid: string): Promise<{ subscriptions: number; transactions: number }> {
  const db = getAdminDb();
  const agentRef = db.doc(`users/${uid}/agent_runs/gmail`);
  const agentSnap = await agentRef.get();
  const agentData = agentSnap.exists ? (agentSnap.data() as GmailAgentRun) : null;

  const lastHistoryId   = agentData?.last_history_id ?? "";
  const processedIds    = agentData?.processed_ids   ?? [];
  const processedSet    = new Set(processedIds);

  // Get fresh Gmail token
  const accessToken = await refreshGmailToken(uid);
  const auth = { Authorization: `Bearer ${accessToken}` };

  // ── Fetch new message IDs ─────────────────────────────────────────────────

  let newMessageIds: string[] = [];
  let newHistoryId = lastHistoryId;

  if (!lastHistoryId) {
    // First run — poll last 100 inbox messages
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&labelIds=INBOX`,
      { headers: auth }
    );
    const listData = await listRes.json();
    if (listData.error) throw new Error(`Gmail list error: ${listData.error.message}`);
    newMessageIds = (listData.messages ?? []).map((m: { id: string }) => m.id);
    newHistoryId  = listData.historyId ?? "";
  } else {
    // Incremental via History API
    const histRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history` +
        `?startHistoryId=${lastHistoryId}&historyTypes=messageAdded&labelId=INBOX`,
      { headers: auth }
    );
    const histData = await histRes.json();

    if (histData.error?.code === 404 || histData.error?.message?.includes("invalidHistoryId")) {
      // Checkpoint expired — fall back to full poll
      console.warn(`[email-agent] uid=${uid}: historyId expired, falling back to poll`);
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&labelIds=INBOX`,
        { headers: auth }
      );
      const listData = await listRes.json();
      if (!listData.error) {
        newMessageIds = (listData.messages ?? []).map((m: { id: string }) => m.id);
        newHistoryId  = listData.historyId ?? lastHistoryId;
      }
    } else if (histData.error) {
      throw new Error(`Gmail history error: ${histData.error.message}`);
    } else {
      for (const record of histData.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          newMessageIds.push(added.message.id);
        }
      }
      newHistoryId = histData.historyId ?? lastHistoryId;
    }
  }

  // ── Dedup + cap ───────────────────────────────────────────────────────────

  const unprocessed = newMessageIds.filter((id) => !processedSet.has(id));
  const toFetch = unprocessed.slice(0, 50);

  if (toFetch.length === 0) {
    // Nothing new — update checkpoint only
    await agentRef.set(
      { last_run_at: new Date().toISOString(), last_history_id: newHistoryId, last_error: FieldValue.delete() },
      { merge: true }
    );
    return { subscriptions: 0, transactions: 0 };
  }

  // ── Fetch metadata + classify ─────────────────────────────────────────────

  const emailMetas = await fetchMessageMetaBatch(toFetch, accessToken);
  const classifications = await classifyEmails(emailMetas);
  const flagged = classifications
    .filter((c) => c.type !== "ignore")
    .slice(0, MAX_EXTRACTIONS);

  let subsAdded = 0;
  let txnAdded  = 0;

  // ── Extract + write ───────────────────────────────────────────────────────

  for (const { id, type } of flagged) {
    try {
      const meta     = emailMetas.find((m) => m.id === id);
      const fullMsg  = await fetchFullMessage(id, accessToken);
      if (!meta || !fullMsg) continue;

      if (type === "subscription") {
        const sub = await extractSubscription(fullMsg.body, meta.subject, meta.from, fullMsg.date);
        if (sub?.name) {
          const dup = await subscriptionExists(uid, sub.name);
          if (!dup) {
            await db.collection(`users/${uid}/subscriptions`).add({
              name:              sub.name,
              category:          sub.category ?? "Other",
              amount:            sub.amount ?? 0,
              billing_cycle:     sub.billing_cycle ?? "monthly",
              next_billing_date: sub.next_billing_date ?? fullMsg.date,
              start_date:        sub.start_date ?? fullMsg.date,
              status:            "active",
              source:            "email-agent",
              created_at:        new Date().toISOString(),
            });
            subsAdded++;
          }
        }
      }

      if (type === "receipt") {
        const txn = await extractTransaction(fullMsg.body, meta.subject, meta.from, fullMsg.date);
        if (txn?.description) {
          const dup = await transactionExists(uid, txn.description, txn.amount ?? 0, txn.date ?? fullMsg.date);
          if (!dup) {
            await db.collection(`users/${uid}/transactions`).add({
              description: txn.description,
              amount:      txn.amount ?? 0,
              category:    txn.category ?? "Other",
              date:        txn.date ?? fullMsg.date,
              type:        "expense",
              source:      "email-agent",
              logged_at:   FieldValue.serverTimestamp(),
            });
            txnAdded++;
          }
        }
      }
    } catch (err) {
      console.error(`[email-agent] uid=${uid} message=${id} error:`, err);
      // Continue — one bad extraction doesn't stop the rest
    }
  }

  // ── Update agent state ────────────────────────────────────────────────────

  const updatedProcessedIds = [...Array.from(processedSet), ...toFetch].slice(-500);
  const stats = computeWeeklyStats(agentData?.stats, subsAdded, txnAdded);

  await agentRef.set({
    last_run_at:     new Date().toISOString(),
    last_history_id: newHistoryId,
    processed_ids:   updatedProcessedIds,
    stats,
    // Clear any previous error
    last_error:    FieldValue.delete(),
    last_error_at: FieldValue.delete(),
  } as Record<string, unknown>, { merge: true });

  console.log(`[email-agent] uid=${uid}: checked=${toFetch.length} flagged=${flagged.length} subs=${subsAdded} txn=${txnAdded}`);
  return { subscriptions: subsAdded, transactions: txnAdded };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function runAgent(uids: string[]) {
  const results: Record<string, unknown> = {};
  for (const uid of uids) {
    try {
      results[uid] = await processUser(uid);
    } catch (err) {
      console.error(`[email-agent] uid=${uid} fatal error:`, err);
      // Write error to Firestore for widget display
      try {
        const db = getAdminDb();
        await db.doc(`users/${uid}/agent_runs/gmail`).set(
          {
            last_error:    err instanceof Error ? err.message : String(err),
            last_error_at: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch { /* ignore */ }
      results[uid] = { error: String(err) };
    }
  }
  return NextResponse.json({ ok: true, results });
}

// GET — Vercel cron: process all Gmail-connected users
export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const gmailChecks = await Promise.all(
    usersSnap.docs.map(async (d) => {
      const gmailDoc = await db.doc(`users/${d.id}/integrations/gmail`).get();
      return gmailDoc.exists ? d.id : null;
    })
  );
  const uids = gmailChecks.filter((id): id is string => id !== null);

  return runAgent(uids);
}

// POST — Manual trigger: process single user
export async function POST(req: NextRequest) {
  const uidParam = req.nextUrl.searchParams.get("uid");

  // Accept either cron secret (for server-side testing) or Firebase ID token
  let uid: string | null = null;
  if (isCronAuthed(req)) {
    uid = uidParam;
  } else {
    uid = await getUidFromIdToken(req);
  }

  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runAgent([uid]);
}
