import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/send-push";
import { refreshGmailToken, extractEmailBody } from "@/lib/gmail-token";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { UnsubscribeReview, UnsubscribeRecommendation } from "@/types";

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function isCronAuthed(req: NextRequest): boolean {
  return CRON_SECRET !== "" && (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}

async function getUidFromIdToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    if (token === CRON_SECRET) return null;
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

function currentISOWeekKey(): string {
  const now = new Date();
  return `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
}

interface GmailMsg { id: string }
interface GmailHdr { name: string; value: string }

interface SenderGroup {
  senderEmail: string;
  senderName: string;
  emailIds: string[];
  subjects: string[];
}

async function searchGmailSenders(accessToken: string): Promise<SenderGroup[]> {
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages" +
      "?q=newer_than%3A7d+%28category%3Apromotions+OR+unsubscribe%29&maxResults=100",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) return [];
  const listData = (await listRes.json()) as { messages?: GmailMsg[] };
  const messages = listData.messages ?? [];
  if (!messages.length) return [];

  const metaResults = await Promise.allSettled(
    messages.map((m) =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}` +
          "?format=metadata" +
          "&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ).then((r) => r.json()),
    ),
  );

  const senderMap = new Map<string, SenderGroup>();

  for (const result of metaResults) {
    if (result.status !== "fulfilled") continue;
    const msg = result.value as { id?: string; payload?: { headers?: GmailHdr[] } };
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    if (!get("List-Unsubscribe")) continue;

    const fromRaw = get("From");
    const addrMatch = fromRaw.match(/<([^>]+)>/);
    const senderEmail = (addrMatch?.[1] ?? fromRaw).toLowerCase().trim();
    const senderName = addrMatch
      ? fromRaw.replace(/<[^>]+>/, "").replace(/"/g, "").trim()
      : senderEmail;
    const subject = get("Subject");

    if (!senderEmail || !msg.id) continue;

    if (senderMap.has(senderEmail)) {
      const g = senderMap.get(senderEmail)!;
      g.emailIds.push(msg.id);
      if (subject && g.subjects.length < 2) g.subjects.push(subject);
    } else {
      senderMap.set(senderEmail, {
        senderEmail,
        senderName: senderName || senderEmail,
        emailIds: [msg.id],
        subjects: subject ? [subject] : [],
      });
    }
  }

  return [...senderMap.values()].sort((a, b) => b.emailIds.length - a.emailIds.length);
}

async function fetchEmailBodies(
  accessToken: string,
  emailIds: string[],
): Promise<Array<{ subject: string; body: string }>> {
  return Promise.all(
    emailIds.slice(0, 2).map(async (id) => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) return { subject: "", body: "" };
        const data = (await res.json()) as {
          payload?: { headers?: GmailHdr[]; [k: string]: unknown };
        };
        const subject =
          (data.payload?.headers ?? []).find(
            (h) => h.name.toLowerCase() === "subject",
          )?.value ?? "";
        const body = data.payload ? extractEmailBody(data.payload as Parameters<typeof extractEmailBody>[0]).slice(0, 2000) : "";
        return { subject, body };
      } catch {
        return { subject: "", body: "" };
      }
    }),
  );
}

async function evaluateSender(
  sender: SenderGroup,
  emails: Array<{ subject: string; body: string }>,
): Promise<{ verdict: "unsubscribe" | "keep" | "maybe"; reason: string } | null> {
  function sanitize(s: string): string {
    return s.replace(/[\r\n]/g, " ");
  }
  const safeName = sanitize(sender.senderName);
  const safeEmail = sanitize(sender.senderEmail);

  const emailBlocks = emails
    .map(
      (e, i) => {
        const safeSubject = sanitize(e.subject || "(none)").slice(0, 200);
        return `Email ${i + 1} subject: ${safeSubject}\nEmail ${i + 1} body:\n${e.body || "(empty)"}`;
      },
    )
    .join("\n\n");

  const prompt = `You are helping Larry decide whether to unsubscribe from a mailing list.

Sender: ${safeName} (${safeEmail})
Emails this week: ${sender.emailIds.length}

${emailBlocks}

Respond with JSON only, no other text:
{"verdict":"unsubscribe","reason":"one sentence"}

verdict must be exactly one of: unsubscribe, keep, maybe
- unsubscribe: promotional, sale alerts, low-value repetitive content, brands not recently engaged with
- keep: genuinely useful content, newsletters with articles worth reading, receipts, shipping, account alerts
- maybe: unclear value, infrequent but not obviously useless`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      });
      const text =
        response.content[0].type === "text" ? response.content[0].text.trim() : "";
      const parsed = JSON.parse(text) as { verdict: string; reason: string };
      if (["unsubscribe", "keep", "maybe"].includes(parsed.verdict)) {
        return {
          verdict: parsed.verdict as "unsubscribe" | "keep" | "maybe",
          reason: String(parsed.reason ?? "").replace(/[\r\n]/g, " ").slice(0, 200),
        };
      }
    } catch {
      // retry
    }
  }
  return null;
}

async function processUser(uid: string): Promise<{ uid: string; status: string }> {
  const db = getAdminDb();
  const weekKey = currentISOWeekKey();

  const docRef = db.doc(`users/${uid}/unsubscribe_reviews/${weekKey}`);
  const existing = await docRef.get();
  if (existing.exists) return { uid, status: "skipped (already run this week)" };

  let accessToken: string;
  try {
    accessToken = await refreshGmailToken(uid);
  } catch {
    return { uid, status: "skipped (no Gmail)" };
  }

  const allSenders = await searchGmailSenders(accessToken);
  if (!allSenders.length) return { uid, status: "done (no candidates)" };

  const skippedCount = Math.max(0, allSenders.length - 20);
  const senders = allSenders.slice(0, 20);
  const recommendations: UnsubscribeRecommendation[] = [];

  for (const sender of senders) {
    try {
      const emails = await fetchEmailBodies(accessToken, sender.emailIds);
      const evaluation = await evaluateSender(sender, emails);
      if (!evaluation) continue;
      recommendations.push({
        senderEmail: sender.senderEmail,
        senderName: sender.senderName,
        emailCount: sender.emailIds.length,
        verdict: evaluation.verdict,
        reason: evaluation.reason,
        sampleSubjects: sender.subjects.slice(0, 2),
        emailId: sender.emailIds[0],
      });
    } catch {
      // skip this sender on any error
    }
  }

  const review: UnsubscribeReview = {
    week: weekKey,
    generatedAt: new Date().toISOString(),
    status: "pending",
    recommendations,
    unsubscribedFrom: [],
    skippedCount,
  };
  await docRef.set(review);

  const flaggedCount = recommendations.filter((r) => r.verdict === "unsubscribe").length;
  if (flaggedCount > 0) {
    await sendPushToUser(uid, {
      title: "Weekly Unsubscribe Review Ready",
      body: `${flaggedCount} sender${flaggedCount === 1 ? "" : "s"} flagged for unsubscribe`,
      tag: "unsubscribe_review",
      data: { url: "/dashboard" },
    });
  }

  return {
    uid,
    status: `done (${recommendations.length} evaluated, ${flaggedCount} flagged)`,
  };
}

// GET — Vercel cron (Saturdays). Vercel invokes cron paths with GET, so the
// weekly review needs a GET entry point (a POST-only route 405s the cron).
export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const uids = usersSnap.docs.map((d) => d.id);
  const results = await Promise.allSettled(uids.map((uid) => processUser(uid)));
  const summary = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { uid: "unknown", status: `error: ${String(r.reason)}` },
  );
  return NextResponse.json({ processed: summary.length, results: summary });
}

export async function POST(req: NextRequest) {
  const isCron = isCronAuthed(req);
  const manualUid = isCron ? null : await getUidFromIdToken(req);

  if (!isCron && !manualUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (manualUid) {
    const result = await processUser(manualUid);
    return NextResponse.json(result);
  }

  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const uids = usersSnap.docs.map((d) => d.id);

  const results = await Promise.allSettled(uids.map((uid) => processUser(uid)));
  const summary = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { uid: "unknown", status: `error: ${String(r.reason)}` },
  );

  return NextResponse.json({ processed: summary.length, results: summary });
}
