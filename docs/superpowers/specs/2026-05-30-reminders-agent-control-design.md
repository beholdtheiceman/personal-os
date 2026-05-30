# Design Spec: One-off Reminders + Expanded Agent Control

**Date:** 2026-05-30  
**Status:** Approved  
**Scope:** Two sub-projects shipped together. Journal auto-tag deferred (already shipped in `/api/journal/summarize`). Weekly email digest deferred.

---

## Context

The app already has a 17-category push notification system (hourly Vercel cron, `lib/notification-handlers.ts`, `lib/send-push.ts`), 70+ chat tools inline in `app/api/chat/route.ts`, and settings persisted to `users/{uid}/settings/*` subcollections. Both sub-projects plug into this existing infra — no new Vercel crons, no new API routes except one new endpoint.

---

## Sub-project 1 — One-off Reminders

### Goal

Users can say "remind me to call Dr. Smith next Thursday at 10am" or "ping me in 2 hours about the contract" from chat or voice. The reminder fires once as a push notification at the right time.

### Data Model

**Firestore path:** `users/{uid}/reminders/{autoId}`

```
{
  text: string,          // "Call Dr. Smith"
  fire_at: string,       // local wall-clock "2026-06-04T10:00" (no UTC offset)
  tz: string,            // user's tz at creation time, e.g. "America/Chicago"
  status: "pending" | "fired" | "cancelled",
  created_at: string,    // ISO UTC
  fired_at?: string      // ISO UTC, written when push is sent
}
```

**Why local wall-clock:** the hourly cron already resolves each user's `localDate` + `localHour` via `getLocalTimeInfo()`. Storing the intended local datetime and comparing lexically (`currentLocalDatetime >= fire_at`) avoids all UTC-offset math. "10am" fires at 10am regardless of future DST changes.

### Firing Semantics

- The existing hourly `GET /api/notifications/daily` cron handles firing.
- A reminder fires at the **first cron run at or after `fire_at`**. Never fires early.
- Uses `>=` comparison so a missed cron run never permanently drops a reminder (it catches up on the next run).
- Reminders **bypass DND / protected-time windows** — the user explicitly set a point-in-time, so it fires regardless.
- After firing: `status` → `"fired"`, `fired_at` → current UTC ISO.

### Chat Tools

**`create_reminder`**
```
input_schema:
  text: string (required) — what to remind about
  fire_at: string (required) — absolute local datetime "YYYY-MM-DDTHH:MM"
```
Claude resolves relative phrases ("next Thursday at 10am", "in 2 hours") to absolute local datetime before calling the tool. The tool response confirms the exact local time so the user can verify. The chat system prompt already injects today's local date; to support relative-time phrases we also inject the current local time (HH:MM).

**`list_reminders`**
```
input_schema: {} (no params)
```
Returns all `status: "pending"` reminders sorted by `fire_at`.

**`cancel_reminder`**
```
input_schema:
  id: string (required) — Firestore document ID
```
Sets `status: "cancelled"`. Claude calls `list_reminders` first if user says "cancel my reminder about X" so it can resolve the id.

### Cron Change (one block added to existing handler)

In `app/api/notifications/daily/route.ts`, after the 17 existing notification category checks, add:

```
1. Query users/{uid}/reminders where status == "pending"
2. For each: if currentLocalDatetime >= fire_at → send push, mark fired
3. Build currentLocalDatetime from getLocalTimeInfo() → "{localDate}T{HH:MM}"
```

No new Vercel cron. No new notification settings category (reminders bypass settings entirely — they're always enabled by definition).

### Push Payload

```
title: "⏰ Reminder"
body: {reminder.text}
tag: "reminder-{docId}"   // unique tag prevents notification collapse
```

---

## Sub-project 2 — Expanded Agent Control (Chat Tool Pack)

### Goal

Any setting, notification, or dashboard configuration that currently requires a UI visit should be doable from chat or voice. 9 new tools over existing Firestore docs — no schema changes.

### Tools

#### `get_notification_settings`
Read-only. Returns all 17 notification categories with their current `enabled`, `time`, `day_of_week`, `days_before` values. Used before update calls so Claude can tell the user their current config.
```
input_schema: {}
```

#### `update_notification_setting`
Update one notification category.
```
input_schema:
  category: string (required) — one of the 17 category keys
  enabled: boolean (optional)
  time: string (optional) — "HH:MM" local time
  day_of_week: number (optional) — 0=Sun … 6=Sat (weekly_review only)
  days_before: number (optional) — for goal_deadline, birthday_reminder, subscription_renewal
```
Writes via `setDoc(..., { merge: true })` to `users/{uid}/settings/notifications`.

#### `snooze_all_notifications`
Temporarily mute all push notifications until a given local datetime.
```
input_schema:
  until: string (required) — local datetime "YYYY-MM-DDTHH:MM"
```
Writes `snooze_until: string` field onto `users/{uid}/settings/notifications`.
Cron guard: at top of the per-user loop in `notifications/daily`, read `snooze_until`; if `currentLocalDatetime < snooze_until`, skip all categories for that user (reminders still fire — see above).

#### `get_app_settings`
Read-only. Returns timezone, weather unit + city, and protected-time windows.
```
input_schema: {}
```
Reads `settings/timezone` and `settings/weather`.

#### `update_app_setting`
```
input_schema:
  setting: "home_timezone" | "weather_units" | "weather_location"
  value: string
```
- `home_timezone` → writes to `settings/timezone.home_timezone`
- `weather_units` → `"fahrenheit"` or `"celsius"` → `settings/weather.units`
- `weather_location` → city name string; server-side Nominatim geocode to lat/lon; writes `settings/weather.{latitude, longitude, city}`. If Nominatim returns no results, tool returns an error string and Claude asks the user to try a more specific city name.

#### `get_dashboard_layout`
Read-only. Returns current widget order and hidden widgets by human-readable label.
```
input_schema: {}
```

#### `manage_dashboard`
```
input_schema:
  action: "show" | "hide" | "move_to_top" | "move_to_bottom" | "move_up" | "move_down"
  widget: string — natural language name matched to one of 24 widget IDs
```
Claude resolves "finance summary" → `"finance"` using the id↔label map embedded in the tool description. Writes to `settings/dashboard`.

#### `get_integration_status`
Read-only. Returns connection status + last sync time for: Gmail, Plaid, Google Health, Google Contacts, Google Calendar, Google Drive.
```
input_schema: {}
```
Reads each integration doc (`users/{uid}/integrations/{name}` and `users/{uid}/settings/plaid`). Returns `{ name, connected: bool, last_synced?: string }` per integration. No disconnect capability from chat.

#### `trigger_plaid_sync`
Manually kick off a Plaid sync from chat ("re-run Plaid").
```
input_schema: {}
```
Calls `POST /api/plaid/sync` server-side (internal fetch with the user's uid). Returns count of transactions synced.

---

## What Is Not In This Spec

- **Integration disconnect from chat** — stays in Settings UI only (safety boundary).
- **Weekly email digest** — deferred; overlaps existing weekly-review push.
- **Journal auto-tag** — already shipped in `/api/journal/summarize`.
- **New Vercel cron** — the reminder firing piggybacks the existing hourly cron.
- **Notification settings UI changes** — `snooze_until` field is read/written by chat tools only; the existing `NotificationSettings` component doesn't need to surface it (though a future pass could add a visual snooze indicator).

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/chat/route.ts` | Add 9 tool definitions + 9 execution cases to `executeTool()` |
| `app/api/notifications/daily/route.ts` | Add reminder-firing block + snooze guard |
| `app/api/weather/route.ts` | Verify Nominatim geocode path exists (used by `update_app_setting`) |
| `types/index.ts` | Add `snooze_until?: string` to `NotificationSettings` type |

No new Firestore collections except `users/{uid}/reminders`.  
No new Vercel crons.  
No new API routes (Plaid sync reuses existing `POST /api/plaid/sync`).

---

## Success Criteria

- "Remind me to pick up kids at 3pm tomorrow" → push fires at 3pm local the next day
- "Cancel my reminder about the kids" → Claude lists, user confirms, reminder cancelled
- "Turn off my mid-day progress reminders" → immediately takes effect on next cron run
- "Set my morning briefing to 6:30am" → agent rounds to the nearest supported hour, stores `"06:00"`, and confirms "I'll set it to 6am" (the notification system fires on the hour; `isHour` compares `localHour` to `parseInt(time)`, so only the hour part is used)
- "Snooze all notifications until Monday" → no pushes fire until Monday
- "Hide the weather widget" → widget disappears from dashboard
- "What integrations do I have connected?" → agent lists all 6 with status + last sync
- "Sync my Plaid accounts" → sync triggers, agent reports transaction count
