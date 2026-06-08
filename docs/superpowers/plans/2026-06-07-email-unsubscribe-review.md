# Email Unsubscribe Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weekly cron job scans 7 days of Gmail, uses Claude to evaluate each mailing-list sender, stores recommendations in Firestore, fires a notification, and surfaces a dashboard widget where the user confirms which senders to unsubscribe from.

**Architecture:** A new cron route (`/api/email/unsubscribe-review`) runs Saturday at 11 PM UTC, queries Gmail for emails from the past 7 days, groups by sender (filtering to those with `List-Unsubscribe` headers), calls Claude per sender to get a verdict and reason, and writes results to `users/{uid}/unsubscribe_reviews/{YYYY-Www}`. A new React widget reads the current week's document via Firestore `onSnapshot`, pre-checks senders flagged "unsubscribe", and calls the existing `/api/gmail/unsubscribe` route per selected sender on confirm. Firestore is then updated to `status: "acted"`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Firestore Admin SDK + Client SDK, Gmail REST API, Anthropic SDK (`claude-sonnet-4-6`), `date-fns` (already installed) for ISO week calculation, React hooks.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `types/index.ts` | Modify | Add `UnsubscribeReview`, `UnsubscribeRecommendation` interfaces; add `unsubscribe_review` to `NotificationSettings` |
| `app/api/email/unsubscribe-review/route.ts` | Create | Cron + manual trigger: Gmail scan → Claude evaluation → Firestore write → push notification |
| `vercel.json` | Modify | Add `0 23 * * 6` cron entry |
| `components/dashboard/UnsubscribeReviewWidget.tsx` | Create | Dashboard widget: three states (empty / pending / acted), checklist, confirm flow |
| `app/(pages)/dashboard/page.tsx` | Modify | Import widget, add `"unsubscribe_review"` case to `renderWidget`, add to default widget order |

**Reused as-is (no changes):**
- `app/api/gmail/unsubscribe/route.ts` — the confirm action calls this per sender
- `lib/send-push.ts` → `sendPushToUser()` — push notification
- `lib/gmail-token.ts` → `refreshGmailToken()` — per-user OAuth token

---

## Task 1: Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add the two new interfaces at the end of `types/index.ts`**

Open `types/index.ts`. Scroll to the end of the file and append:

```typescript
export interface UnsubscribeRecommendation {
  senderEmail: string;       // "deals@brand.com"
  senderName: string;        // "Brand Weekly"
  emailCount: number;        // emails found in the 7-day window
  verdict: "unsubscribe" | "keep" | "maybe";
  reason: string;            // one sentence from Claude
  sampleSubjects: string[];  // up to 2 subject lines for display
  emailId: string;           // most recent email ID — passed to /api/gmail/unsubscribe
}

export interface UnsubscribeReview {
  week: string;                        // "2026-W24" (ISO 8601)
  generatedAt: string;                 // ISO timestamp
  status: "pending" | "acted";
  actedAt?: string;                    // ISO timestamp
  recommendations: UnsubscribeRecommendation[];
  unsubscribedFrom: string[];          // senderEmails confirmed by user
  skippedCount?: number;               // senders beyond the 20-cap
}
```

- [ ] **Step 2: Add `unsubscribe_review` to `NotificationSettings` interface**

Find the `NotificationSettings` interface. Add this field before the `snooze_until` line:

```typescript
  unsubscribe_review: NotificationCategory;
```

- [ ] **Step 3: Add default for `unsubscribe_review` in `DEFAULT_NOTIFICATION_SETTINGS`**

Find `DEFAULT_NOTIFICATION_SETTINGS`. Add this entry (enabled by default — only fires when there are actual flagged senders):

```typescript
  unsubscribe_review: { enabled: true },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors (pre-existing errors are fine).

- [ ] **Step 5: Commit**

```bash
git add types/index.ts
git commit -m "feat(unsubscribe-review): add types and notification category"
```

---

## Task 2: Cron Route

**Files:**
- Create: `app/api/email/unsubscribe-review/route.ts`

Build this file in four steps — auth helpers, Gmail scanner, Claude evaluator, and the route handler. Each step appends to the same file.

- [ ] **Step 1: Create file with imports and auth helpers**

Create `app/api/email/unsubscribe-review/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/send-push";
import { refreshGmailToken } from "@/lib/gmail-token";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { UnsubscribeReview, UnsubscribeRecommendation } from "@/types";

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function isCronAuthed(req: NextRequest): boolean {
  return (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
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
```

- [ ] **Step 2: Append Gmail scanner**

Append to the same file:

```typescript
interface GmailMsg { id: string }
interface GmailHdr { name: string; value: string }

interface SenderGroup {
  senderEmail: string;
  senderName: string;
  emailIds: string[];   // all IDs from this sender, most-recent first
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

  // Fetch metadata for all messages in parallel
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

    // Only process emails that have an unsubscribe header
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
```

- [ ] **Step 3: Append email body fetcher and Claude evaluator**

Append to the same file:

```typescript
function extractTextBody(payload: Record<string, unknown>): string {
  const mimeType = payload?.mimeType as string | undefined;
  const body = payload?.body as { data?: string } | undefined;
  if (mimeType === "text/plain" && body?.data) {
    return Buffer.from(body.data, "base64url").toString("utf-8").slice(0, 2000);
  }
  const parts = payload?.parts as Record<string, unknown>[] | undefined;
  if (parts) {
    for (const part of parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }
  return "";
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
        const body = extractTextBody(data.payload as Record<string, unknown>);
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
  const emailBlocks = emails
    .map(
      (e, i) =>
        `Email ${i + 1} subject: ${e.subject || "(none)"}\nEmail ${i + 1} body:\n${e.body || "(empty)"}`,
    )
    .join("\n\n");

  const prompt = `You are helping Larry decide whether to unsubscribe from a mailing list.

Sender: ${sender.senderName} (${sender.senderEmail})
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
          reason: String(parsed.reason ?? ""),
        };
      }
    } catch {
      // retry
    }
  }
  return null;
}
```

- [ ] **Step 4: Append per-user processor and route handler**

Append to the same file:

```typescript
async function processUser(uid: string): Promise<{ uid: string; status: string }> {
  const db = getAdminDb();
  const weekKey = currentISOWeekKey();

  // Idempotency: skip if already run this week
  const docRef = db.doc(`users/${uid}/unsubscribe_reviews/${weekKey}`);
  const existing = await docRef.get();
  if (existing.exists) return { uid, status: "skipped (already run this week)" };

  // Get Gmail token — skip silently if not connected
  let accessToken: string;
  try {
    const tokenData = await refreshGmailToken(uid);
    accessToken = tokenData.access_token;
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
        emailId: sender.emailIds[0], // most recent — used by /api/gmail/unsubscribe
      });
    } catch {
      // skip this sender on any error, continue with rest
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

export async function POST(req: NextRequest) {
  const isCron = isCronAuthed(req);
  const manualUid = isCron ? null : await getUidFromIdToken(req);

  if (!isCron && !manualUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (manualUid) {
    // Manual "Run now" from the widget — single user only
    const result = await processUser(manualUid);
    return NextResponse.json(result);
  }

  // Cron path — process all users
  const db = getAdminDb();
  const usersSnap = await db.collectionGroup("memory").get();
  const uids = [...new Set(usersSnap.docs.map((d) => d.ref.path.split("/")[1]))];

  const results = await Promise.allSettled(uids.map((uid) => processUser(uid)));
  const summary = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { uid: "unknown", status: `error: ${String(r.reason)}` },
  );

  return NextResponse.json({ processed: summary.length, results: summary });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "unsubscribe-review" | head -20
```

Expected: no errors for this file.

- [ ] **Step 6: Commit**

```bash
git add app/api/email/unsubscribe-review/route.ts
git commit -m "feat(unsubscribe-review): cron route — Gmail scan, Claude evaluation, Firestore write, push notification"
```

---

## Task 3: Add Cron Schedule

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add cron entry**

Open `vercel.json`. Find the `"crons"` array. Add this entry before the closing `]`:

```json
{
  "path": "/api/email/unsubscribe-review",
  "schedule": "0 23 * * 6"
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(unsubscribe-review): add Saturday 11PM UTC cron schedule"
```

---

## Task 4: Dashboard Widget

**Files:**
- Create: `components/dashboard/UnsubscribeReviewWidget.tsx`

- [ ] **Step 1: Create the file with imports, the `SenderCard` sub-component, and `currentISOWeekKey` helper**

Create `components/dashboard/UnsubscribeReviewWidget.tsx`:

```typescript
"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { UnsubscribeReview, UnsubscribeRecommendation } from "@/types";

function currentISOWeekKey(): string {
  const now = new Date();
  return `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
}

// Defined outside the main component to avoid re-creating on every render
interface SenderCardProps {
  rec: UnsubscribeRecommendation;
  showCheckbox: boolean;
  checked: boolean;
  onToggle: (email: string) => void;
  actionStatus?: "success" | "error";
}

function SenderCard({ rec, showCheckbox, checked, onToggle, actionStatus }: SenderCardProps) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      {showCheckbox && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(rec.senderEmail)}
          className="mt-0.5 accent-accent"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary truncate">{rec.senderName}</span>
          <span className="text-xs text-text-secondary/60">{rec.emailCount} this week</span>
          {actionStatus === "success" && (
            <span className="text-xs text-green-400">✓ Unsubscribed</span>
          )}
          {actionStatus === "error" && (
            <span className="text-xs text-red-400">Failed — try manually</span>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-0.5">{rec.reason}</p>
        {rec.sampleSubjects[0] && (
          <p className="text-xs text-text-secondary/40 mt-0.5 truncate italic">
            &ldquo;{rec.sampleSubjects[0]}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append the main `UnsubscribeReviewWidget` component**

Append to the same file:

```typescript
export default function UnsubscribeReviewWidget() {
  const { user } = useAuth();
  const weekKey = currentISOWeekKey();

  const [review, setReview]         = useState<UnsubscribeReview | null>(null);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checked, setChecked]       = useState<Set<string>>(new Set());
  const [perStatus, setPerStatus]   = useState<Record<string, "success" | "error">>({});
  const [maybeOpen, setMaybeOpen]   = useState(false);
  const [keepOpen,  setKeepOpen]    = useState(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/unsubscribe_reviews/${weekKey}`);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UnsubscribeReview;
        setReview(data);
        setChecked((prev) => {
          if (prev.size > 0) return prev; // don't override user's choices after first load
          return new Set(
            data.recommendations
              .filter((r) => r.verdict === "unsubscribe")
              .map((r) => r.senderEmail),
          );
        });
      } else {
        setReview(null);
      }
      setLoading(false);
    });
  }, [user, weekKey]);

  const toggleChecked = useCallback((email: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const runNow = useCallback(async () => {
    if (!user || running) return;
    setRunning(true);
    try {
      const token = await user.getIdToken();
      await fetch("/api/email/unsubscribe-review", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // onSnapshot updates state when Firestore doc appears
    } catch {
      // silent — user can retry
    } finally {
      setRunning(false);
    }
  }, [user, running]);

  const confirmUnsubscribe = useCallback(async () => {
    if (!user || !review || processing) return;
    setProcessing(true);

    const toUnsub = review.recommendations.filter((r) => checked.has(r.senderEmail));
    const statuses: Record<string, "success" | "error"> = {};

    for (const rec of toUnsub) {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/gmail/unsubscribe?uid=${user.uid}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ emailId: rec.emailId }),
        });
        statuses[rec.senderEmail] = res.ok ? "success" : "error";
      } catch {
        statuses[rec.senderEmail] = "error";
      }
    }

    setPerStatus(statuses);

    const unsubscribedFrom = toUnsub
      .filter((r) => statuses[r.senderEmail] === "success")
      .map((r) => r.senderEmail);

    await updateDoc(doc(db, `users/${user.uid}/unsubscribe_reviews/${weekKey}`), {
      status: "acted",
      actedAt: new Date().toISOString(),
      unsubscribedFrom,
    });

    setProcessing(false);
  }, [user, review, checked, processing, weekKey]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
        <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-3" />
        <div className="h-3 w-full bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  // ── Acted ──
  if (review?.status === "acted") {
    const kept = review.recommendations.length - review.unsubscribedFrom.length;
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">Unsubscribe Review</h3>
        <p className="text-sm text-text-secondary">
          Unsubscribed from{" "}
          <span className="text-green-400 font-medium">{review.unsubscribedFrom.length}</span>{" "}
          sender{review.unsubscribedFrom.length !== 1 ? "s" : ""} this week
          {kept > 0 && ` · ${kept} kept`}
        </p>
        <p className="text-xs text-text-secondary/50">Next review runs Saturday night.</p>
      </div>
    );
  }

  // ── Empty ──
  if (!review) {
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Unsubscribe Review</h3>
        <p className="text-xs text-text-secondary">
          Runs every Saturday night — scans the week&apos;s email and flags senders worth
          unsubscribing from.
        </p>
        <button
          onClick={runNow}
          disabled={running}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {running ? "Scanning…" : "Run now"}
        </button>
      </div>
    );
  }

  // ── Pending ──
  const unsubRecs = review.recommendations.filter((r) => r.verdict === "unsubscribe");
  const maybeRecs = review.recommendations.filter((r) => r.verdict === "maybe");
  const keepRecs  = review.recommendations.filter((r) => r.verdict === "keep");
  const selectedCount = review.recommendations.filter((r) => checked.has(r.senderEmail)).length;
  const [yr, wk] = review.week.split("-W");

  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Unsubscribe Review
          <span className="ml-1.5 text-xs font-normal text-text-secondary">
            — Week {wk}, {yr}
          </span>
        </h3>
        {unsubRecs.length > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            {unsubRecs.length} flagged
          </span>
        )}
      </div>

      {unsubRecs.length > 0 ? (
        <div>
          {unsubRecs.map((rec) => (
            <SenderCard
              key={rec.senderEmail}
              rec={rec}
              showCheckbox
              checked={checked.has(rec.senderEmail)}
              onToggle={toggleChecked}
              actionStatus={perStatus[rec.senderEmail]}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-secondary">No senders flagged for unsubscribe this week.</p>
      )}

      {maybeRecs.length > 0 && (
        <div>
          <button
            onClick={() => setMaybeOpen((v) => !v)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <span>{maybeOpen ? "▾" : "▸"}</span> Maybe ({maybeRecs.length})
          </button>
          {maybeOpen &&
            maybeRecs.map((rec) => (
              <SenderCard
                key={rec.senderEmail}
                rec={rec}
                showCheckbox
                checked={checked.has(rec.senderEmail)}
                onToggle={toggleChecked}
                actionStatus={perStatus[rec.senderEmail]}
              />
            ))}
        </div>
      )}

      {keepRecs.length > 0 && (
        <div>
          <button
            onClick={() => setKeepOpen((v) => !v)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <span>{keepOpen ? "▾" : "▸"}</span> Keep ({keepRecs.length})
          </button>
          {keepOpen &&
            keepRecs.map((rec) => (
              <SenderCard
                key={rec.senderEmail}
                rec={rec}
                showCheckbox={false}
                checked={false}
                onToggle={() => {}}
              />
            ))}
        </div>
      )}

      {(review.skippedCount ?? 0) > 0 && (
        <p className="text-xs text-text-secondary/50">
          {review.skippedCount} more sender{review.skippedCount !== 1 ? "s" : ""} not evaluated
          this week (cap: 20).
        </p>
      )}

      {(unsubRecs.length > 0 || maybeRecs.length > 0) && (
        <button
          onClick={confirmUnsubscribe}
          disabled={processing || selectedCount === 0}
          className="w-full text-sm py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50"
        >
          {processing
            ? "Unsubscribing…"
            : selectedCount === 0
              ? "Select senders to unsubscribe"
              : `Unsubscribe from selected (${selectedCount})`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "UnsubscribeReviewWidget" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/UnsubscribeReviewWidget.tsx
git commit -m "feat(unsubscribe-review): dashboard widget — empty/pending/acted states with confirm flow"
```

---

## Task 5: Wire into Dashboard

**Files:**
- Modify: `app/(pages)/dashboard/page.tsx`

- [ ] **Step 1: Add import**

Open `app/(pages)/dashboard/page.tsx`. In the widget imports block (around line 1–44), add:

```typescript
import UnsubscribeReviewWidget from "@/components/dashboard/UnsubscribeReviewWidget";
```

- [ ] **Step 2: Add case to `renderWidget`**

Find this line in the `renderWidget` function:

```typescript
case "unsubscribe": return gmailConnected ? <UnsubscribeWidget key="unsubscribe" /> : null;
```

Add immediately after it:

```typescript
case "unsubscribe_review": return gmailConnected ? <UnsubscribeReviewWidget key="unsubscribe_review" /> : null;
```

- [ ] **Step 3: Find the default widget order and add the new widget ID**

Run:

```bash
grep -rn '"unsubscribe"' hooks/ types/ lib/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | head -15
```

Open the file containing the default `widgetOrder` array. Add `"unsubscribe_review"` immediately after `"unsubscribe"` in that array.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(pages)/dashboard/page.tsx
git commit -m "feat(unsubscribe-review): wire widget into dashboard"
```

---

## Task 6: Smoke Test and Push

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Trigger the route manually**

In a second terminal (replace `your-cron-secret` with the value from `.env.local`):

```bash
curl -X POST http://localhost:3000/api/email/unsubscribe-review \
  -H "Authorization: Bearer your-cron-secret" \
  -s | python -m json.tool
```

Expected: `{"processed": 1, "results": [{"uid": "...", "status": "done (N evaluated, M flagged)"}]}`

- [ ] **Step 3: Verify Firestore document**

Firebase console → Firestore → `users/{uid}/unsubscribe_reviews/`. Confirm document for current ISO week with `status: "pending"`, `recommendations` array populated with `verdict`, `reason`, `senderEmail`, `emailId` fields.

- [ ] **Step 4: Verify dashboard widget**

Open `http://localhost:3000/dashboard`. Check:
- Unsubscribe Review widget appears
- Senders with `verdict: "unsubscribe"` are pre-checked
- Maybe and Keep sections are collapsed
- Confirm button shows correct selected count

- [ ] **Step 5: Test confirm flow**

Check one sender, click "Unsubscribe from selected". Verify:
- Sender shows "✓ Unsubscribed" or "Failed — try manually"
- Widget transitions to Acted state: "Unsubscribed from N senders this week"
- Firestore document shows `status: "acted"` and `unsubscribedFrom` array

- [ ] **Step 6: Test "Run now"**

Delete the Firestore document for this week, refresh the page, verify empty state with "Run now" button, click it, verify widget transitions to pending.

- [ ] **Step 7: Push to main**

```bash
git push origin main
```
