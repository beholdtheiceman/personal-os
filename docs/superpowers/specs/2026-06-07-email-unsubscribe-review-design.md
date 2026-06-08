# Email Unsubscribe Review — Design Spec

**Date:** 2026-06-07  
**Status:** Approved  
**Feature:** Weekly AI-powered email unsubscribe evaluator with dashboard widget and notification

---

## Overview

A scheduled job runs every Saturday night, scans the past 7 days of email, and uses Claude to evaluate each mailing-list sender's value. Results are persisted to Firestore, a notification fires, and a dashboard widget surfaces the recommendations as a checklist. The user confirms selections; the system unsubscribes them using the existing unsubscribe infrastructure.

---

## Data Flow

```
Saturday 11 PM UTC
       ↓
/api/email/unsubscribe-review (cron, one run per user)
       ↓
Search Gmail: last 7 days — query: "newer_than:7d has:unsubscribe"
       ↓
Group by sender, deduplicate, cap at 20 highest-volume senders
       ↓
For each sender: fetch 2 most recent emails → Claude evaluates
  verdict: "unsubscribe" | "keep" | "maybe"
  reason: one sentence
       ↓
Persist to Firestore: users/{uid}/unsubscribe_reviews/{YYYY-Www}
       ↓
Push notification if ≥1 "unsubscribe" verdict exists
       ↓
User opens dashboard → UnsubscribeReviewWidget shows checklist
       ↓
User selects senders → hits Confirm
       ↓
For each selected: /api/gmail/unsubscribe (RFC 8058 + GET + mailto fallbacks)
       ↓
Widget updates to "acted" state, records what was unsubscribed
```

---

## Data Model

**Firestore path:** `users/{uid}/unsubscribe_reviews/{YYYY-Www}`  
**Week key format:** ISO 8601 week (e.g. `2026-W24`), same convention as weekly reviews.

```typescript
interface UnsubscribeReview {
  week: string;                        // "2026-W24"
  generatedAt: Timestamp;
  status: "pending" | "acted";
  actedAt?: Timestamp;
  recommendations: UnsubscribeRecommendation[];
  unsubscribedFrom: string[];          // sender emails confirmed by user
}

interface UnsubscribeRecommendation {
  senderEmail: string;                 // "deals@brand.com"
  senderName: string;                  // "Brand Weekly"
  emailCount: number;                  // emails in the 7-day window
  verdict: "unsubscribe" | "keep" | "maybe";
  reason: string;                      // one sentence from Claude
  sampleSubjects: string[];            // up to 2 subject lines
  listUnsubscribeHeader: string;       // stored for the confirm action
}
```

---

## Cron Route

**File:** `app/api/email/unsubscribe-review/route.ts`  
**Schedule:** `0 23 * * 6` (Saturday 11 PM UTC)  
**Auth:** `CRON_SECRET` header for Vercel scheduler; Firebase ID token for manual "Run now" triggers from the widget. Same dual-auth pattern as `daily-briefing` and `weekly-review`.

**vercel.json addition:**
```json
{ "path": "/api/email/unsubscribe-review", "schedule": "0 23 * * 6" }
```

**Implementation steps:**

1. Verify `CRON_SECRET` — return 401 if missing/wrong
2. Fetch all users with Gmail connected
3. For each user in parallel:
   a. Compute ISO week key; check Firestore — skip if document already exists (idempotency)
   b. Skip if user has no Gmail token
   c. Search Gmail: `newer_than:7d has:unsubscribe`
   d. Group results by `from` address, sort by email count descending, take top 20
   e. For each sender: fetch the 2 most recent email bodies via existing Gmail tools
   f. Call Claude (Sonnet) with evaluation prompt — get `{ verdict, reason }`
   g. On Claude JSON parse failure: retry once; if still fails, skip sender
   h. Write `UnsubscribeReview` document to Firestore with `status: "pending"`
   i. If ≥1 `"unsubscribe"` verdict: fire push notification via existing notification system

**Claude evaluation prompt (per sender):**
```
You are helping Larry decide whether to unsubscribe from a mailing list.

Sender: {senderName} ({senderEmail})
Emails this week: {emailCount}

Recent email 1 subject: {subject1}
Recent email 1 body: {body1}

Recent email 2 subject: {subject2}
Recent email 2 body: {body2}

Respond with JSON only: { "verdict": "unsubscribe"|"keep"|"maybe", "reason": "<one sentence>" }

Guidelines:
- unsubscribe: promotional, sale alerts, low-value repetitive content, brands not recently engaged with
- keep: genuinely useful content, newsletters with articles worth reading, receipts, shipping, account alerts
- maybe: unclear value, infrequent but not obviously useless
```

**Cost estimate:** ~20 senders × ~1,000 tokens avg = ~20k tokens/user/week. At Claude Sonnet pricing: <$0.10/user/week.

---

## Dashboard Widget

**File:** `components/dashboard/UnsubscribeReviewWidget.tsx`  
**Pattern:** Follows existing widget card pattern (same as `WeeklyReviewWidget`, `EmailAgentWidget`)

### Widget States

**Empty (no review this week yet):**
- Shows last run date or "Runs every Saturday night" if never run
- "Run now" button — POST to `/api/email/unsubscribe-review` with Firebase ID token (manual trigger, same pattern as daily-briefing)

**Pending (review ready, not yet acted):**
- Header: "Unsubscribe Review — Week of {date}" + badge showing count of `"unsubscribe"` verdicts
- **Pre-checked list** — `"unsubscribe"` verdict senders, each card showing:
  - Sender name + email address
  - Email count ("3 this week")
  - AI reason ("Promotional sale emails, no content value")
  - Sample subject line in muted text
- **Collapsed section** — "Maybe ({N})" — expandable, unchecked by default
- **Collapsed section** — "Keep ({N})" — no checkboxes, informational only
- Footer: "Unsubscribe from selected ({N})" primary button
  - Calls confirm endpoint for each selected sender sequentially
  - Shows per-sender progress (success / "Failed — try manually")
  - On completion: transitions to Acted state

**Acted:**
- Summary: "Unsubscribed from {N} senders this week · {M} kept"
- Link to expand full list
- Resets to empty state next Saturday when a new review generates

### Notification

- **Category:** `unsubscribe_review` (new, opt-in/out via notification settings alongside existing categories)
- **Message:** "Weekly unsubscribe review ready — {N} senders flagged"
- **Fires only if:** at least 1 `"unsubscribe"` verdict exists (no notification for all-keep weeks)

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No emails with unsubscribe headers in 7-day window | Skip Firestore write and notification entirely |
| Gmail fetch fails for a sender | Skip that sender, continue with rest |
| Claude returns invalid JSON | Retry once; if still fails, skip sender |
| Unsubscribe action fails for a sender | Per-sender error state in widget: "Failed — try manually" |
| Cron runs twice (Vercel retry) | Idempotent: check for existing week document before running |
| User has no Gmail connected | Skip silently |
| More than 20 senders | Evaluate top 20 by volume; widget notes "X more senders not evaluated this week" |

---

## Files Affected

**New:**
- `app/api/email/unsubscribe-review/route.ts` — cron route
- `components/dashboard/UnsubscribeReviewWidget.tsx` — widget

**Modified:**
- `vercel.json` — add cron schedule entry
- `app/(pages)/dashboard/page.tsx` — add widget to dashboard
- Notification settings — add `unsubscribe_review` category

**Reused as-is:**
- `app/api/gmail/unsubscribe/route.ts` — unsubscribe action
- Existing Gmail search and content fetch logic in `lib/chat-tools.ts`

---

## Out of Scope (v1)

- Senders without `List-Unsubscribe` headers (can't auto-unsubscribe)
- Sender preference memory ("always keep this sender")
- Catch-up scan for monthly newsletters missed in a 7-day window
- Open-rate tracking (Gmail API doesn't expose this reliably)
