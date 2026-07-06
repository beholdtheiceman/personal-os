# HANDOFF — Post-Mortem Remediation (2026-07-05)

Resume token for the post-mortem → fix → execute work. Full detail in `docs/POSTMORTEM_2026-07-05.md` and `docs/FIX_PLANS_2026-07-05.md`.

## Status: Priority 1–4 self-contained fixes LANDED. `npx tsc --noEmit` = 0. Not committed.

## What was completed this session

**Security (Priority 1) — all done:**
- **P1-A — IDOR closed.** 8 routes that trusted a client-supplied `uid` now verify the Firebase ID token and derive uid from it: `gmail/{reply,action,message,messages,unsubscribe,unsubscribe-scan}`, `calendar/events`, `health/data`. New shared helper `lib/api-auth.ts` (`requireAuth`). `health/data` uses **dual auth** (Firebase token OR `CRON_SECRET` bearer) because `health/auto-sync` calls it server-to-server. Updated 5 client callers to send the token (GmailView, dashboard, CalendarView, HealthTracker, UnsubscribeWidget); UnsubscribeReviewWidget already sent it.
- **P1-B — anonymous LLM/TTS spend closed.** Added `requireAuth` to `daily-report`, `journal/summarize`, `tasks/score`, `tasks/extract`, `memory/suggest`, `nutrition/estimate`, `tts`, and wired their callers to send tokens (`tts` via `lib/tts.ts` using client `auth.currentUser`). *(Done by an Opus subagent + me for tts.)*
- **P1-C — CRON_SECRET fail-closed.** 11 cron routes hardened so an empty secret rejects instead of allowing `Bearer `. *(Opus subagent; I fixed the one it flagged out-of-scope: `health/auto-sync`.)*

**Correctness (Priority 2–4):**
- **P2-A** chat listener `limit(100)` (oldest) → `limitToLast(100)` in ChatInterface + ChatPanel. **P2-C** stale-closure auto-select fixed via ref in ChatInterface. *(Opus.)*
- **P3-A** double-timezone-shift in `notification-handlers.ts` (`streakAlertHandler`, `weeklyReviewHandler`). *(Opus, repro-verified.)*
- **P3-B** added missing `GET` to `email/unsubscribe-review` (the Saturday cron was 405ing).
- **P3-C** `goals/checkin` now hourly + local-hour gate (was fixed 09:00 UTC = 2am PT). `vercel.json` schedule changed to `0 * * * *`.
- **P3-D** per-user try/catch in `notifications/daily`, `notifications/habits`, `goals/checkin`, `health/auto-sync` (one user's failure no longer aborts the rest).
- **P4-A** `firebase-admin.ts` sets `ignoreUndefinedProperties` (kills the undefined-write crash class). **P4-C** `useHydration` atomic `increment()`, `useBudget.removeLimit` uses `deleteField()`, `useToday` timer-leak fixed. *(Opus.)*

Opus output was reviewed critically. One correction made by me: the `health/auto-sync` **cron** internal fetch (line ~182) also needed the `CRON_SECRET` header (Opus/P1 only covered the manual POST path) — fixed, else the health-sync cron would 401 against the now-locked endpoint.

## ⚠ DEPLOY PREREQUISITE
All crons + `health/data` are now **fail-closed on an empty `CRON_SECRET`**. Confirm `CRON_SECRET` is set in the Vercel project env before deploying, or every cron (and health auto-sync) will 401. It should already be set (Vercel crons require it); just verify.

## Second pass (deferred items) — 3 of 4 DONE
- **P4-B — ingestion idempotency ✅.** `day-recap.ts` and `ingest/transcript` now atomically claim each capture (`create()` on `day_recap_runs/{sha256(today:text)}` / `ambient_runs/{sha256(today:contextType:text)}`) before writing, so a double-submit / retry / agent-re-trigger can't duplicate line items (incl. transactions). Claimed after parse-success, before writes, so a parse failure doesn't poison-block a retry.
- **P3-E — subscription-renewal timezone ✅.** `subscriptionRenewalHandler` now takes `tz`, computes "today" from the user's local date (UTC-anchored math), and the caller passes `timeInfo.tz`. Fixes the western-zone off-by-one "renews today".
- **P2-B — ChatPanel partial ✅.** Ported the two contained fixes: error-path rollback (deletes the optimistic user message + its saved doc + restores input, so a transient send error no longer permanently breaks the panel chat) and destructive-tool hang-prevention (cancels cleanly server-side + tells the user to use the full /chat page). **STILL TODO:** image-persistence in the panel, and a real in-panel destructive-confirm UI — both best done via the shared `useChatSession` extraction (P5 E-1), not more one-off patches.

## Third pass — DONE
- **P1-D — OAuth `state` CSRF binding ✅.** New `lib/oauth-state.ts` (`signState`/`verifyState`, HMAC-SHA256 of `uid.timestamp` keyed on `OAUTH_STATE_SECRET || CRON_SECRET`, 10-min expiry, constant-time compare). All 5 flows wired: `{gmail,drive,calendar,health}/auth` + `people/contacts-auth` sign the state; the matching callbacks verify it and derive uid (invalid/expired/forged → existing `!uid` guard redirects to the `?error=` page). ⚠ **Needs a manual reconnect test** of each integration after deploy — the round-trip couldn't be tested here. Uses CRON_SECRET as the key by default (already set in Vercel), so no new env var required.
- **P2-B — ChatPanel image-persistence ✅.** `saveMessage` now persists the `image` field, and the history builder emits multimodal `[image, text]` content for prior image messages — so panel images survive reload and stay in-context across turns (matches ChatInterface).

## Still not done
- **P5 E-1 — shared `useChatSession` hook** to dedupe ChatInterface/ChatPanel. The remaining ChatPanel gap is a real in-panel destructive-confirm modal (currently cancels + points to the full chat page). Best solved by the shared-hook extraction, not more one-off patches.
- **daily-report** secured but has **zero callers** — deletion candidate in the refocus (superseded by `daily-briefing`).
- Known-minor (Opus-flagged, intentional): `weeklyReviewHandler`'s `weekAgo` uses the old idiom but only as a Date instant vs timestamps — immaterial.

## Verify
`npx tsc --noEmit` → 0. No runtime/e2e run yet. Suggest a smoke test of: Gmail view (list/open/reply), calendar widget, health sync, one chat past 100 msgs, and a TTS play — all now require a signed-in token.
