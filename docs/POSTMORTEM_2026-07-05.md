# Post-Mortem — Highest-Risk Systems (2026-07-05)

Scope: the complex, high-blast-radius subsystems — the API auth surface, the chat/voice pipeline, the timezone/cron/notification layer, conversational ingestion, and the money-touching code (Plaid, rate tracker). Every finding below was read in source and the load-bearing ones independently re-verified (not taken on an agent's word). Citations are `file:line`.

Context: this runs alongside the lean-refocus in `docs/LEAN_AUDIT_2026-07-05.md`. Some findings live in features already slated to be **cut** (Drive UI, People CRM, news, meal-planner). Where deleting the feature is the cleaner fix than patching it, that's called out — no effort is spent hardening code that's about to be removed.

---

## 1. Correctness bugs

### 1.1 — CRITICAL: unauthenticated IDOR across every Google integration
A whole family of internet-reachable routes take `uid` from the request **body or query string** and act on that user's stored OAuth tokens with **no `verifyIdToken`**. Anyone who knows a Firebase uid can act as that user.

- `app/api/gmail/reply/route.ts:32` — POST **sends email** as victim (`uid` from body → `refreshToken(uid)` at :38). Verified.
- `app/api/gmail/action/route.ts:6` — POST archives/**trashes**/marks mail (`uid` from body). Verified.
- `app/api/gmail/unsubscribe/route.ts` — POST sends mail / fires outbound unsubscribe POST (`uid` from query).
- `app/api/gmail/message`, `gmail/messages`, `gmail/unsubscribe-scan` — GET read arbitrary inbox (`uid` query).
- `app/api/calendar/events/route.ts` — GET reads any calendar, writes refreshed token (`uid` query).
- `app/api/health/data/route.ts` — GET reads any user's Google Health + writes cache (`uid` query).
- `app/api/drive/file`, `drive/files` — GET exfiltrate any Drive file *(feature on cut list)*.

**Fix path:** for keepers (Gmail, Calendar, Health) verify the ID token and derive `uid` from `decoded.uid`, ignoring body/query uid — the exact pattern already used at `app/api/chat/route.ts:76-84`. For cut features (Drive), deletion closes the hole.

### 1.2 — CRITICAL: no-auth endpoints that spend money
Every one of these is POST with **no auth**, each firing a paid LLM/TTS call on demand → unbounded spend by any anonymous caller:
`app/api/daily-report`, `journal/summarize`, `tasks/score`, `tasks/extract`, `memory/suggest`, `nutrition/estimate` (all Anthropic), `app/api/tts` (OpenAI TTS). Add token verification; delete any that the refocus orphans.

### 1.3 — HIGH: `CRON_SECRET`-unset auth bypass
`lib/env.ts:33` returns `""` for any unset var. Routes that gate on `if (cronSecret) { check }` (e.g. `app/api/contacts/sync/route.ts:75`) **skip the check entirely** when the secret is empty; routes comparing `header !== \`Bearer ${cronSecret}\`` accept a literal `Authorization: Bearer ` when it's empty (`app/api/plaid/sync/route.ts`, and the `isCronAuthed` family: daily-briefing, what-matters, weekly-review, meeting-prep, sleep/correlations, okrs/review, rate-tracker/sync, email/unsubscribe-review, gmail/agent). The correct in-repo template is `app/api/notifications/daily/route.ts:25`: `if (!cronSecret || authHeader !== ...) return 401`.

### 1.4 — HIGH: chat history listener pinned to the OLDEST 100 messages
`components/chat/ChatInterface.tsx:221` and `components/chat/ChatPanel.tsx:131` both `orderBy("timestamp","asc") + limit(100)`. Verified. Once a chat exceeds 100 messages (the app itself expects this — 500-message achievement at ChatInterface.tsx:419): the newest messages fall outside the query window, so they never display **and the listener stops firing for new writes** — the chat appears frozen in the past. Fix: `limitToLast(100)` (or `orderBy desc + limit + reverse`).

### 1.5 — HIGH: double timezone shift → wrong "yesterday" in early-morning hours
`lib/notification-handlers.ts:58` builds `yesterday` from `new Date(new Date().toLocaleString("en-US",{timeZone:tz}))` (a Date whose fields are local wall-clock but interpreted in the server's TZ), then re-applies the offset with `.toLocaleDateString("en-CA",{timeZone:tz})`. Verified. For a UTC-negative zone, any run where local hour < offset computes "yesterday" as **two days ago** → false "streak at risk" alerts / wrongly suppressed ones. Same double-shift in `weeklyReviewHandler` (:361). `subscriptionRenewalHandler` (:619) is a sibling bug: it uses server-UTC midnight and takes no `tz` at all, so "renews today" is off by one for western zones.

### 1.6 — HIGH: weekly unsubscribe-review cron is dead
`app/api/email/unsubscribe-review/route.ts` exports only `POST` (verified: `grep` shows a single `export async function POST` at :256). Vercel crons invoke via **GET** (`vercel.json:71`), which returns 405 — the Saturday review has silently never run. *(This feature is a Gmail-agent keeper, so it should be fixed, not cut.)*

### 1.7 — MED: `goals/checkin` pushes at a fixed UTC hour
`vercel.json:40` fires `0 9 * * *` and the handler has **no local-hour gate** (unlike every other push cron) — `getLocalTimeInfo` is used only for the dedup week-key. Result: stale-goal pushes land at 09:00 UTC = 02:00 PT, waking the user.

### 1.8 — MED: ingestion is non-idempotent (duplicate writes)
`lib/day-recap.ts` and `app/api/ingest/transcript/route.ts` write meals, workouts, tasks, transactions, journal, and interactions with `.add()` (fresh doc every call); only mood/hydration use `doc(today).set(merge)`. Verified by read. Running Day Recap twice — or the agent calling `run_day_recap` after the user already submitted via UI — silently **duplicates every line item**, including transactions (money data). Needs a dedup strategy (deterministic IDs or a per-day source guard). Requires design judgment.

### 1.9 — MED: per-user cron loops abort on the first failure
`app/api/notifications/daily/route.ts:33`, `notifications/habits/route.ts:23`, `goals/checkin/route.ts:25`, `health/auto-sync` all run the per-user body **unwrapped**. One user's Firestore hiccup or handler throw bubbles to the route → 500, and **every user after the failing one gets nothing that hour**. The correct pattern (per-user try/catch, continue on error) is already used in plaid/sync, news/refresh, meeting-prep. Single-user today, but it's a latent reliability landmine and a trivial fix.

### 1.10 — MED: client-side data races
- `hooks/useHydration.ts:35` — `glasses: current + 1` read-modify-write from render state; double-tap loses updates and the goal-XP award double-fires or is skipped. Use `increment()`.
- `hooks/useBudget.ts:107` — `removeLimit` deletes a map key then `setDoc(..., {merge:true})`, which never deletes server-side; the category reappears on next snapshot. Needs `FieldValue.delete()`.
- `hooks/useToday.ts:19` — self-rescheduling midnight timer whose recursive timer id isn't cleaned up → leaked timer chain firing `setToday` on unmounted hooks forever.
- `components/chat/ChatInterface.tsx:205` — chats `onSnapshot` effect deps are `[user]` but the callback reads `activeChatId` (stale closure = always `null`), so any bump to another chat force-switches the view mid-read.

---

## 2. Calibration / tuning problems

- **206 tools shipped on every chat + voice turn** (`lib/chat-tools.ts`; `app/api/realtime/tools/route.ts` sends the full set). This is the documented root cause of progressive voice-agent latency (memory: voice-agent-latency-rootcause, fix #3 still open). Voice needs a ~25-tool subset; text can keep more but 206 is a large fixed prefill on every request.
- **Voice VAD threshold 0.9 + 700 ms silence** (`RealtimeVoice.tsx:315`) is aggressive to avoid false barge-in; may now clip legitimate fast interruptions. Tune after the tool-floor fix, not before (they interact).
- **`news/refresh` runs Haiku classification BEFORE the dedup existence check** (`app/api/news/refresh/route.ts:102` classifies, :113 discards already-stored) → ~24× redundant Haiku calls/feed/day on barely-changing RSS. The dedup ID is computable before the LLM call. *(News is on the cut list — deletion resolves it.)*
- **`savingsMilestoneHandler` + `netWorthReminderHandler` run every hour with no time gate**, doing per-goal Firestore reads hourly (`notifications/daily/route.ts:119`). Cost, not correctness.
- **Plaid transaction window hardcoded to 30 days / count 100** (`lib/plaid-sync.ts:70`) — fine now; will silently truncate for heavier accounts.

---

## 3. Architectural fragility

- **`components/chat/ChatInterface.tsx` (962 lines) and `ChatPanel.tsx` (685 lines) are ~650 lines of duplicated logic** (types, file handling, recording, save, the client-tool resume loop). The divergence is *already* producing bugs: the error-rollback fix (ChatInterface.tsx:532 restores optimistic state so the chat doesn't end on a user turn), the destructive-tool confirmation path, and the image-persistence fix all exist in ChatInterface and are **missing from ChatPanel** (:404, :346, :162). One transient network error from the slide-in panel permanently breaks that chat. The missing abstraction is a shared `useChatSession` hook.
- **`lib/tool-executor.ts` is a 4,050-line switch** (`chat-tools.ts` 2,722) — 55% of `lib/`. Every new domain lands in the monolith. Split by domain when trimming the tool set.
- **~30 of 31 `onSnapshot` hooks have no error callback and no shared abstraction** — a rules/index error silently wedges `loading=true` forever with no diagnostics. A `useUserDoc`/`useUserCollection` helper would centralize error handling, loading semantics, and cleanup.
- **`lib/firebase-admin.ts` never sets `ignoreUndefinedProperties`** (verified: no match repo-wide). Any tool write that passes an `undefined` field throws `Cannot use 'undefined' as a Firestore value`. Much of `tool-executor.ts` defends with `?? null`, which shows the author hit this — but it's one missed default away from a runtime crash. One-line settings fix removes the whole class.
- **Internal HTTP self-calls** (`health/auto-sync` → `/api/health/data?uid=`) re-enter the same IDOR'd endpoint over the network and are the pattern `lib/send-push.ts` documents as previously broken by Vercel deployment protection.

---

## 4. Missing integrations / gaps

- **OAuth callbacks bind `uid` to an unauthenticated `state` param** (`gmail/callback`, `drive/callback`, `health/callback`, `calendar/callback`, `people/contacts-callback`) and write refresh tokens to `users/{uid}/integrations/...` with no CSRF/session binding — a forged callback can plant attacker tokens. Proper fix: sign/verify `state` against the session.
- **`ChatPanel` stubs `getQuickLinks: () => []`** (`ChatPanel.tsx:352`) where ChatInterface wires real data — voice/panel client tools silently no-op.
- **No idempotency key on any ingestion write** (see 1.8) — there's no integration between "user submitted recap via UI" and "agent triggers recap tool," so both can fire.
- **`useRateTracker` never fetches `benchmarks`** (dead state returned) and swallows non-OK responses with no error surface.

---

## Cross-cutting note for the refocus
Several findings sit in cut-list features (Drive, People CRM, news, meal-planner). For those, **deletion is the fix** — do not patch. The security items that touch **keepers** (Gmail, Calendar, Health, Plaid, chat) must be fixed regardless. Prioritize accordingly in the plan below.
