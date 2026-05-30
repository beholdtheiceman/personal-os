# One-off Reminders + Expanded Agent Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create point-in-time reminders and control all notification/settings/dashboard config from chat or voice, with no UI visit required.

**Architecture:** All chat tools are added inline to the existing `TOOLS` array and `executeTool()` switch in `app/api/chat/route.ts` (the established pattern — 70+ tools already live there). Reminder firing is added as a block at the end of the existing hourly `app/api/notifications/daily/route.ts` cron handler. No new Vercel crons, no new API routes, one new Firestore collection (`users/{uid}/reminders`).

**Tech Stack:** TypeScript, Next.js App Router, Firebase Admin SDK (Firestore), Anthropic SDK, existing `lib/timezone.ts` helpers, existing `lib/send-push.ts`

---

## File Map

| File | Change |
|------|--------|
| `types/index.ts` | Add `Reminder` interface; add `snooze_until?: string` to `NotificationSettings` |
| `app/api/chat/route.ts` | Add `localTime` to destructure; inject into system prompt; add 12 tool definitions to `TOOLS`; add 12 cases to `executeTool()` |
| `app/api/notifications/daily/route.ts` | Add snooze guard after protected-time block; add reminder-firing block at end of per-user loop |
| `components/chat/ChatInterface.tsx` | Send `localTime` in POST body |
| `components/chat/ChatPanel.tsx` | Send `localTime` in POST body |

---

## Task 1: Add types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `Reminder` interface and `snooze_until` field**

Open `types/index.ts`. After the `NotificationSettings` interface (around line 128), add:

```typescript
// ─── Reminders ────────────────────────────────────────────────────────────────
export interface Reminder {
  id?: string;               // Firestore doc ID, set after fetch
  text: string;              // "Call Dr. Smith"
  fire_at: string;           // local wall-clock "YYYY-MM-DDTHH:MM" (no UTC offset)
  tz: string;                // user's tz at creation, e.g. "America/Chicago"
  status: "pending" | "fired" | "cancelled";
  created_at: string;        // ISO UTC
  fired_at?: string;         // ISO UTC, written when push is sent
}
```

In the `NotificationSettings` interface, add one optional field after `season_checkin`:

```typescript
  snooze_until?: string;     // local datetime "YYYY-MM-DDTHH:MM"; all notifications skip while now < this
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "types: add Reminder interface and snooze_until to NotificationSettings"
```

---

## Task 2: Send localTime from chat clients

The `create_reminder` tool needs Claude to know the current local time (not just date) to resolve phrases like "in 2 hours". The server already receives `localDate` from the client — we add `localTime` alongside it.

**Files:**
- Modify: `components/chat/ChatInterface.tsx`
- Modify: `components/chat/ChatPanel.tsx`

- [ ] **Step 1: Find the POST body in ChatInterface**

```bash
grep -n "localDate" components/chat/ChatInterface.tsx
```

Find the `fetch("/api/chat", ...)` call where `localDate` is assembled.

- [ ] **Step 2: Add localTime to the POST body in ChatInterface**

Near where `localDate` is computed, add:

```typescript
const localTime = new Date().toLocaleTimeString("en-US", {
  hour12: false, hour: "2-digit", minute: "2-digit",
}); // produces "14:30"
```

Then add `localTime` to the fetch body object alongside `localDate`.

- [ ] **Step 3: Repeat for ChatPanel**

```bash
grep -n "localDate" components/chat/ChatPanel.tsx
```

Apply the identical two-line change (compute `localTime`, add to body).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/chat/ChatInterface.tsx components/chat/ChatPanel.tsx
git commit -m "chat: send localTime in POST body for reminder time resolution"
```

---

## Task 3: Consume localTime in route.ts and inject into system prompt

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Destructure localTime from request body**

Find this line (~line 5504):

```typescript
const { messages, systemPrompt, uid, localDate, imageBase64, ... } = await req.json();
```

Add `localTime` to the destructure:

```typescript
const { messages, systemPrompt, uid, localDate, localTime, imageBase64, ... } = await req.json();
```

- [ ] **Step 2: Inject localTime into the full system prompt**

Find where `fullSystemPrompt` is built (the block that joins `basePrompt`, `webSearchGuard`, and `extras`). Add a time context line:

```typescript
const timeCtx = localTime ? `\n\nCurrent local time: ${localTime}` : "";
const fullSystemPrompt = extras
  ? `${basePrompt}${webSearchGuard}${timeCtx}\n\n${extras}`
  : `${basePrompt}${webSearchGuard}${timeCtx}`;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "chat: inject current local time into system prompt for reminder resolution"
```

---

## Task 4: Add reminder chat tool definitions

**Files:**
- Modify: `app/api/chat/route.ts`

The `TOOLS` array is defined near the top of `route.ts`. Find the last tool entry in the array and append these three after it (before the closing `]`).

- [ ] **Step 1: Add the three tool definitions**

```typescript
{
  name: "create_reminder",
  description: "Set a one-time push notification reminder for the user. Resolve any relative time expression ('in 2 hours', 'next Thursday at 10am', 'tomorrow morning') to an absolute local datetime using today's date and the current local time from your context — both are injected into your system prompt. Always confirm the resolved datetime back to the user so they can verify. Hour precision only: the system fires on the hour, so round to the nearest hour and confirm what you stored (e.g. '10:30am' → store '10:00', confirm 'I\\'ll remind you at 10am').",
  input_schema: {
    type: "object" as const,
    properties: {
      text:    { type: "string", description: "What to remind the user about, e.g. 'Call Dr. Smith'" },
      fire_at: { type: "string", description: "Absolute local datetime in YYYY-MM-DDTHH:MM format (hour precision, no seconds, no timezone offset)" },
    },
    required: ["text", "fire_at"],
  },
},
{
  name: "list_reminders",
  description: "List all pending (not yet fired or cancelled) reminders for the user, sorted soonest first.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
},
{
  name: "cancel_reminder",
  description: "Cancel a pending reminder by its ID. Call list_reminders first if you need to resolve which reminder the user means.",
  input_schema: {
    type: "object" as const,
    properties: {
      id: { type: "string", description: "Firestore document ID of the reminder to cancel" },
    },
    required: ["id"],
  },
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "chat: add create_reminder, list_reminders, cancel_reminder tool definitions"
```

---

## Task 5: Add reminder tool execution cases

**Files:**
- Modify: `app/api/chat/route.ts`

Add these three cases to the `executeTool()` switch, before the `default:` case.

- [ ] **Step 1: Add the three execution cases**

```typescript
case "create_reminder": {
  const text = (input.text as string ?? "").trim();
  const fire_at = (input.fire_at as string ?? "").trim();
  if (!text || !fire_at) return "Missing text or fire_at.";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fire_at)) {
    return "fire_at must be in YYYY-MM-DDTHH:MM format (e.g. 2026-06-04T10:00).";
  }
  const tzDoc = await db.doc(`users/${uid}/settings/timezone`).get();
  const tz = (tzDoc.data()?.home_timezone ?? tzDoc.data()?.current_timezone ?? "UTC") as string;
  const ref = await db.collection(`users/${uid}/reminders`).add({
    text,
    fire_at,
    tz,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  return `Reminder set ✓ (id: ${ref.id}). I'll push a notification with "${text}" at ${fire_at} (${tz}).`;
}

case "list_reminders": {
  const snap = await db.collection(`users/${uid}/reminders`)
    .where("status", "==", "pending")
    .orderBy("fire_at", "asc")
    .get();
  if (snap.empty) return "No pending reminders.";
  const lines = snap.docs.map((d) => {
    const r = d.data();
    return `• [${d.id}] "${r.text}" at ${r.fire_at} (${r.tz})`;
  });
  return `**Pending reminders:**\n${lines.join("\n")}`;
}

case "cancel_reminder": {
  const id = (input.id as string ?? "").trim();
  if (!id) return "Missing reminder id.";
  const ref = db.doc(`users/${uid}/reminders/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return `No reminder found with id ${id}.`;
  const r = snap.data()!;
  if (r.status !== "pending") return `Reminder is already ${r.status as string}.`;
  await ref.update({ status: "cancelled" });
  return `Reminder cancelled: "${r.text as string}" scheduled for ${r.fire_at as string}.`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "chat: add reminder tool execution cases (create/list/cancel)"
```

---

## Task 6: Wire reminder firing into the daily cron

**Files:**
- Modify: `app/api/notifications/daily/route.ts`

- [ ] **Step 1: Confirm localDate is on LocalTimeInfo**

```bash
grep -n "localDate" lib/timezone.ts
```

If `LocalTimeInfo` does not have a `localDate: string` field, add it. In `lib/timezone.ts`, inside `getLocalTimeInfo()`, ensure this line exists:

```typescript
const localDate = now.toLocaleDateString("en-CA", { timeZone: tz }); // "YYYY-MM-DD"
// and in the return object:
return { tz, localHour, localMinute, localDayOfWeek, localDate };
```

Also add `localDate: string` to the `LocalTimeInfo` interface if missing.

- [ ] **Step 2: Add snooze guard**

In `app/api/notifications/daily/route.ts`, find the closing `} catch { /* protected time... */ }` block (~line 58). Immediately after it, before `const send = async ...`, add:

```typescript
// ── Snooze guard: skip all category notifications if snoozed ─────────────
const snoozeUntil = (settingsDoc.data() as Record<string, unknown>)?.snooze_until as string | undefined;
if (snoozeUntil) {
  const currentLocalStr = `${timeInfo.localDate}T${String(timeInfo.localHour).padStart(2, "0")}:00`;
  if (currentLocalStr < snoozeUntil) {
    results[uid] = ["snoozed"];
    continue;
  }
}
```

- [ ] **Step 3: Add reminder-firing block**

Find `results[uid] = fired;` near the bottom of the per-user `for` loop. Add this block **immediately before** it:

```typescript
// ── One-off reminders: bypass DND and snooze, always fire when due ────────
try {
  const currentLocalStr = `${timeInfo.localDate}T${String(timeInfo.localHour).padStart(2, "0")}:00`;
  const dueSnap = await db.collection(`users/${uid}/reminders`)
    .where("status", "==", "pending")
    .get();
  for (const reminderDoc of dueSnap.docs) {
    const r = reminderDoc.data();
    if ((r.fire_at as string) <= currentLocalStr) {
      await sendPushToUser(uid, {
        title: "⏰ Reminder",
        body: r.text as string,
        tag: `reminder-${reminderDoc.id}`,
      });
      await reminderDoc.ref.update({
        status: "fired",
        fired_at: new Date().toISOString(),
      });
      fired.push(`reminder-${reminderDoc.id}`);
    }
  }
} catch (e) {
  console.error(`Reminder firing failed for ${uid}:`, e);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/notifications/daily/route.ts lib/timezone.ts
git commit -m "cron: add reminder firing and snooze guard to daily notification handler"
```

---

## Task 7: Add agent-control tool definitions

**Files:**
- Modify: `app/api/chat/route.ts`

Add these 9 definitions to the `TOOLS` array, after the 3 reminder tools added in Task 4.

- [ ] **Step 1: Add all 9 definitions**

```typescript
{
  name: "get_notification_settings",
  description: "Read the user's current notification settings — which categories are enabled, at what times, and any active snooze. Call this before update_notification_setting so you can report what's changing.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
},
{
  name: "update_notification_setting",
  description: "Enable or disable a notification category, or change its scheduled time or day. Valid category keys: morning_briefing, streak_alert, task_reminder, goal_deadline, journal_reminder, health_reminder, weekly_review, birthday_reminder, savings_milestone, progress_midday, progress_evening, decision_review, networth_reminder, time_summary, goal_inactivity, subscription_renewal, spending_trend, season_checkin. Time format: 'HH:00' (hour precision only, e.g. '07:00'). day_of_week: 0=Sun…6=Sat (only for weekly_review). days_before: integer (for goal_deadline, birthday_reminder, subscription_renewal).",
  input_schema: {
    type: "object" as const,
    properties: {
      category:    { type: "string", description: "Notification category key" },
      enabled:     { type: "boolean", description: "Enable or disable this category" },
      time:        { type: "string", description: "Scheduled time as HH:00, e.g. '09:00'" },
      day_of_week: { type: "number", description: "Day of week (0=Sun) — weekly_review only" },
      days_before: { type: "number", description: "Days before deadline — goal_deadline, birthday_reminder, subscription_renewal" },
    },
    required: ["category"],
  },
},
{
  name: "snooze_all_notifications",
  description: "Temporarily mute all push notification categories until a given local datetime. One-off reminders created with create_reminder are NOT affected. To unsnooze early, call this with a past datetime.",
  input_schema: {
    type: "object" as const,
    properties: {
      until: { type: "string", description: "Local datetime to snooze until, in YYYY-MM-DDTHH:MM format" },
    },
    required: ["until"],
  },
},
{
  name: "get_app_settings",
  description: "Read the user's current app settings: home timezone, weather units (fahrenheit/celsius), and weather location city.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
},
{
  name: "update_app_setting",
  description: "Update a specific app setting. Available settings: 'home_timezone' (IANA timezone string, e.g. 'America/Chicago'), 'weather_units' ('fahrenheit' or 'celsius'), 'weather_location' (city name — geocoded server-side to lat/lon via Nominatim).",
  input_schema: {
    type: "object" as const,
    properties: {
      setting: { type: "string", description: "One of: home_timezone, weather_units, weather_location" },
      value:   { type: "string", description: "The new value" },
    },
    required: ["setting", "value"],
  },
},
{
  name: "get_dashboard_layout",
  description: "Read the user's current dashboard widget order and which widgets are hidden.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
},
{
  name: "manage_dashboard",
  description: "Show, hide, or reorder a dashboard widget. Use the human-readable widget name. Valid widgets: What Actually Matters, System Audit, XP / Level, Quick Links, AI Briefing, AI Insights, Decision Reviews, Upcoming Birthdays, Verse of the Day, Tasks & Habits, Hydration & Mood, Calendar & Nutrition, Health & Journal, Goals & Projects, Finance Summary, Budget & Savings, Weekly Review, API Usage, Email Agent, Unsubscribe Manager, Gmail Inbox, Achievements, News Feed, Weather.",
  input_schema: {
    type: "object" as const,
    properties: {
      action: { type: "string", description: "One of: show, hide, move_to_top, move_to_bottom, move_up, move_down" },
      widget: { type: "string", description: "Widget label name as listed in this tool's description" },
    },
    required: ["action", "widget"],
  },
},
{
  name: "get_integration_status",
  description: "Check which integrations are connected and when each last synced. Covers: Gmail, Plaid, Google Health, Google Contacts, Google Calendar, Google Drive. Read-only — disconnecting must be done in the Settings UI.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
},
{
  name: "trigger_plaid_sync",
  description: "Manually trigger a Plaid sync right now to pull in the latest bank and credit card transactions, without waiting for the nightly cron.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "chat: add 9 agent-control tool definitions"
```

---

## Task 8: Add notification + snooze execution cases

**Files:**
- Modify: `app/api/chat/route.ts`

Add before the `default:` case in `executeTool()`.

- [ ] **Step 1: Add get_notification_settings, update_notification_setting, snooze_all_notifications**

```typescript
case "get_notification_settings": {
  const snap = await db.doc(`users/${uid}/settings/notifications`).get();
  const raw = snap.data() as Record<string, unknown> | undefined;
  const settings = mergeNotificationSettings(raw);
  const snoozeUntil = raw?.snooze_until as string | undefined;
  const lines = (Object.keys(settings) as Array<keyof typeof settings>).map((k) => {
    const cat = settings[k] as { enabled: boolean; time?: string; day_of_week?: number; days_before?: number };
    const parts: string[] = [`${cat.enabled ? "✅" : "⬜"} **${k}**`];
    if (cat.time) parts.push(`at ${cat.time}`);
    if (cat.day_of_week !== undefined) parts.push(`day ${cat.day_of_week}`);
    if (cat.days_before !== undefined) parts.push(`${cat.days_before}d before`);
    return parts.join(" ");
  });
  const snoozeNote = snoozeUntil ? `\n\n⏸ All notifications snoozed until **${snoozeUntil}**` : "";
  return `**Notification Settings:**\n${lines.join("\n")}${snoozeNote}`;
}

case "update_notification_setting": {
  const category = (input.category as string ?? "").trim();
  const validCategories = [
    "morning_briefing","streak_alert","task_reminder","goal_deadline","journal_reminder",
    "health_reminder","weekly_review","birthday_reminder","savings_milestone","progress_midday",
    "progress_evening","decision_review","networth_reminder","time_summary","goal_inactivity",
    "subscription_renewal","spending_trend","season_checkin",
  ];
  if (!validCategories.includes(category)) {
    return `Unknown category "${category}". Valid: ${validCategories.join(", ")}.`;
  }
  const update: Record<string, unknown> = {};
  if (input.enabled !== undefined) update[`${category}.enabled`] = input.enabled;
  if (input.time     !== undefined) update[`${category}.time`]    = input.time;
  if (input.day_of_week !== undefined) update[`${category}.day_of_week`] = input.day_of_week;
  if (input.days_before !== undefined) update[`${category}.days_before`] = input.days_before;
  if (Object.keys(update).length === 0) {
    return "Nothing to update — provide at least one of: enabled, time, day_of_week, days_before.";
  }
  await db.doc(`users/${uid}/settings/notifications`).set(update, { merge: true });
  const summary = Object.entries(update)
    .map(([k, v]) => `${k.split(".")[1]} → ${v}`)
    .join(", ");
  return `Updated **${category}**: ${summary}.`;
}

case "snooze_all_notifications": {
  const until = (input.until as string ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(until)) {
    return "until must be in YYYY-MM-DDTHH:MM format.";
  }
  await db.doc(`users/${uid}/settings/notifications`).set({ snooze_until: until }, { merge: true });
  return `All notifications snoozed until **${until}**. One-off reminders are not affected and will still fire.`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "chat: add get/update notification settings and snooze execution cases"
```

---

## Task 9: Add app settings + dashboard execution cases

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Add get_app_settings and update_app_setting**

```typescript
case "get_app_settings": {
  const [tzSnap, wxSnap] = await Promise.all([
    db.doc(`users/${uid}/settings/timezone`).get(),
    db.doc(`users/${uid}/settings/weather`).get(),
  ]);
  const tz = tzSnap.data() ?? {};
  const wx = wxSnap.data() ?? {};
  return [
    `**Home timezone:** ${(tz.home_timezone ?? tz.current_timezone ?? "not set") as string}`,
    `**Weather location:** ${(wx.city ?? "not set") as string}`,
    `**Weather units:** ${(wx.units ?? "fahrenheit") as string}`,
  ].join("\n");
}

case "update_app_setting": {
  const setting = (input.setting as string ?? "").trim();
  const value   = (input.value   as string ?? "").trim();
  if (!value) return "Value cannot be empty.";

  if (setting === "home_timezone") {
    await db.doc(`users/${uid}/settings/timezone`).set(
      { home_timezone: value, updated_at: new Date().toISOString() },
      { merge: true }
    );
    return `Home timezone updated to **${value}**.`;
  }

  if (setting === "weather_units") {
    if (value !== "fahrenheit" && value !== "celsius") {
      return "weather_units must be 'fahrenheit' or 'celsius'.";
    }
    await db.doc(`users/${uid}/settings/weather`).set({ units: value }, { merge: true });
    return `Weather units updated to **${value}**.`;
  }

  if (setting === "weather_location") {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=1`,
      { headers: { "User-Agent": "personal-os/1.0" } }
    );
    const geoData = await geoRes.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!geoData.length) {
      return `Could not find "${value}". Try a more specific name, e.g. "Austin, Texas".`;
    }
    const { lat, lon, display_name } = geoData[0];
    const city = display_name.split(",").slice(0, 2).join(",").trim();
    await db.doc(`users/${uid}/settings/weather`).set(
      { latitude: parseFloat(lat), longitude: parseFloat(lon), city },
      { merge: true }
    );
    return `Weather location updated to **${city}** (${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}).`;
  }

  return `Unknown setting "${setting}". Valid: home_timezone, weather_units, weather_location.`;
}
```

- [ ] **Step 2: Add get_dashboard_layout and manage_dashboard**

```typescript
case "get_dashboard_layout": {
  const snap = await db.doc(`users/${uid}/settings/dashboard`).get();
  const data  = snap.data() ?? {};
  const hidden: string[] = data.hiddenWidgets ?? [];
  const order:  string[] = data.widgetOrder   ?? [];

  const LABELS: Record<string, string> = {
    what_matters:"What Actually Matters", system_audit:"System Audit", xp:"XP / Level",
    quick_links:"Quick Links", daily_briefing:"AI Briefing", insights:"AI Insights",
    decision_review:"Decision Reviews", birthday:"Upcoming Birthdays", verse:"Verse of the Day",
    tasks_habits:"Tasks & Habits", hydration_mood:"Hydration & Mood",
    calendar_nutrition:"Calendar & Nutrition", health_journal:"Health & Journal",
    goals_projects:"Goals & Projects", finance:"Finance Summary", budget_savings:"Budget & Savings",
    weekly_review:"Weekly Review", api_usage:"API Usage", email_agent:"Email Agent",
    unsubscribe:"Unsubscribe Manager", gmail:"Gmail Inbox", achievements:"Achievements",
    news_feed:"News Feed", weather:"Weather",
  };

  const visible = order.filter(id => !hidden.includes(id)).map((id, i) => `${i + 1}. ${LABELS[id] ?? id}`);
  const hiddenLabels = hidden.map(id => LABELS[id] ?? id);
  return [
    `**Visible (top → bottom):**\n${visible.join("\n") || "(none)"}`,
    hiddenLabels.length ? `\n**Hidden:** ${hiddenLabels.join(", ")}` : "",
  ].join("");
}

case "manage_dashboard": {
  const action      = (input.action as string ?? "").trim();
  const widgetInput = (input.widget as string ?? "").toLowerCase().trim();

  const LABELS: Record<string, string> = {
    what_matters:"what actually matters", system_audit:"system audit", xp:"xp / level",
    quick_links:"quick links", daily_briefing:"ai briefing", insights:"ai insights",
    decision_review:"decision reviews", birthday:"upcoming birthdays", verse:"verse of the day",
    tasks_habits:"tasks & habits", hydration_mood:"hydration & mood",
    calendar_nutrition:"calendar & nutrition", health_journal:"health & journal",
    goals_projects:"goals & projects", finance:"finance summary", budget_savings:"budget & savings",
    weekly_review:"weekly review", api_usage:"api usage", email_agent:"email agent",
    unsubscribe:"unsubscribe manager", gmail:"gmail inbox", achievements:"achievements",
    news_feed:"news feed", weather:"weather",
  };

  const widgetId = Object.entries(LABELS).find(([, label]) =>
    label.includes(widgetInput) || widgetInput.includes(label)
  )?.[0];
  if (!widgetId) {
    return `Widget "${input.widget as string}" not found. Valid widgets: ${Object.values(LABELS).join(", ")}.`;
  }

  const snap = await db.doc(`users/${uid}/settings/dashboard`).get();
  const data  = snap.data() ?? {};
  const allIds = Object.keys(LABELS);
  let order:  string[] = data.widgetOrder?.length  ? [...data.widgetOrder]  : [...allIds];
  let hidden: string[] = data.hiddenWidgets?.length ? [...data.hiddenWidgets] : [];

  if (!order.includes(widgetId)) order.push(widgetId);

  if (action === "hide") {
    if (!hidden.includes(widgetId)) hidden.push(widgetId);
  } else if (action === "show") {
    hidden = hidden.filter(id => id !== widgetId);
  } else if (action === "move_to_top") {
    order = [widgetId, ...order.filter(id => id !== widgetId)];
  } else if (action === "move_to_bottom") {
    order = [...order.filter(id => id !== widgetId), widgetId];
  } else if (action === "move_up") {
    const idx = order.indexOf(widgetId);
    if (idx > 0) [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
  } else if (action === "move_down") {
    const idx = order.indexOf(widgetId);
    if (idx < order.length - 1) [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
  } else {
    return `Unknown action "${action}". Valid: show, hide, move_to_top, move_to_bottom, move_up, move_down.`;
  }

  await db.doc(`users/${uid}/settings/dashboard`).set({ widgetOrder: order, hiddenWidgets: hidden });
  const displayLabel = Object.entries(LABELS).find(([id]) => id === widgetId)?.[1] ?? widgetId;
  return `Dashboard updated: **${displayLabel}** → ${action.replace(/_/g, " ")}.`;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "chat: add app settings and dashboard management execution cases"
```

---

## Task 10: Add integration status + Plaid sync execution cases

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Check how POST /api/plaid/sync authenticates**

```bash
grep -n "Authorization\|uid\|CRON_SECRET\|idToken" app/api/plaid/sync/route.ts | head -20
```

Note whether it requires a Bearer token or a `uid` body param — you'll need this for the `trigger_plaid_sync` case below.

- [ ] **Step 2: Add get_integration_status case**

```typescript
case "get_integration_status": {
  const [gmailSnap, healthSnap, contactsSnap, calendarSnap, driveSnap, plaidSettingsSnap] =
    await Promise.all([
      db.doc(`users/${uid}/integrations/gmail`).get(),
      db.doc(`users/${uid}/integrations/google_health`).get(),
      db.doc(`users/${uid}/integrations/google_contacts`).get(),
      db.doc(`users/${uid}/integrations/google_calendar`).get(),
      db.doc(`users/${uid}/integrations/google_drive`).get(),
      db.doc(`users/${uid}/settings/plaid`).get(),
    ]);

  const connected = (snap: FirebaseFirestore.DocumentSnapshot, tokenField = "access_token") => {
    if (!snap.exists) return false;
    const d = snap.data()!;
    return !!(d[tokenField] || d.access_token_encrypted || d.refresh_token);
  };
  const lastSync = (snap: FirebaseFirestore.DocumentSnapshot, field = "last_synced") =>
    (snap.data()?.[field] as string | undefined)?.slice(0, 10) ?? "unknown";

  const plaidItemsSnap = await db.collection(`users/${uid}/plaid_items`).limit(1).get();
  const plaidConnected = !plaidItemsSnap.empty;

  const rows = [
    `**Gmail:** ${connected(gmailSnap) ? `✅ Connected` : "❌ Not connected"}`,
    `**Plaid:** ${plaidConnected ? `✅ Connected (last sync: ${lastSync(plaidSettingsSnap)})` : "❌ Not connected"}`,
    `**Google Health:** ${connected(healthSnap) ? `✅ Connected (last sync: ${lastSync(healthSnap, "last_sync")})` : "❌ Not connected"}`,
    `**Google Contacts:** ${connected(contactsSnap) ? `✅ Connected (last sync: ${lastSync(contactsSnap)})` : "❌ Not connected"}`,
    `**Google Calendar:** ${connected(calendarSnap) ? `✅ Connected` : "❌ Not connected"}`,
    `**Google Drive:** ${connected(driveSnap) ? `✅ Connected` : "❌ Not connected"}`,
  ];
  return rows.join("\n");
}
```

- [ ] **Step 3: Add trigger_plaid_sync case**

```typescript
case "trigger_plaid_sync": {
  const plaidItemsSnap = await db.collection(`users/${uid}/plaid_items`).limit(1).get();
  if (plaidItemsSnap.empty) {
    return "Plaid is not connected. Visit the Finance page → Accounts tab to link an account.";
  }
  // Call the existing sync endpoint using the uid directly (server-to-server, trusted context)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const syncRes = await fetch(`${baseUrl}/api/plaid/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid }),
  });
  if (!syncRes.ok) {
    const err = await syncRes.text().catch(() => syncRes.status.toString());
    return `Plaid sync failed: ${err}. Try again or visit the Finance page.`;
  }
  const data = await syncRes.json() as { recurring_count?: number; transaction_count?: number };
  return `Plaid sync complete ✓ — ${data.transaction_count ?? 0} transactions and ${data.recurring_count ?? 0} recurring streams updated.`;
}
```

> **Note:** If `/api/plaid/sync` requires a Firebase ID token (Bearer auth) rather than accepting a plain `uid` body param, you'll need to generate a custom token via Firebase Admin: `const customToken = await getAdminAuth().createCustomToken(uid);` and pass it. Check the auth pattern you found in Step 1.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "chat: add integration status and Plaid sync execution cases"
```

---

## Task 11: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test reminders in chat**

- "Remind me to check on the deploy in 2 hours" → agent resolves to absolute time and confirms, e.g. "I'll remind you at 4pm (2026-05-30T16:00)"
- "What reminders do I have?" → lists the pending reminder with its Firestore ID
- "Cancel my reminder about the deploy" → agent calls `list_reminders`, resolves the ID, calls `cancel_reminder`, confirms

- [ ] **Step 3: Test notification settings**

- "What notifications do I have turned on?" → lists all 18 categories with ✅/⬜
- "Turn on my morning briefing at 7am" → agent calls `update_notification_setting`, confirms
- "Snooze all notifications until tomorrow at 9am" → confirms snooze_until stored

- [ ] **Step 4: Test app settings**

- "What are my current app settings?" → shows timezone + weather info
- "Change my weather location to Nashville, Tennessee" → geocodes and confirms

- [ ] **Step 5: Test dashboard**

- "Hide the API usage widget" → confirms; refresh dashboard and verify it's gone
- "Move Finance Summary to the top" → confirms; refresh and verify order

- [ ] **Step 6: Test integrations**

- "What integrations do I have connected?" → lists all 6 with status + last sync

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: smoke test corrections for reminders and agent control"
```

---

## Task 12: Deploy and wrap up

- [ ] **Step 1: Push to main**

```bash
git push
```

- [ ] **Step 2: Confirm Vercel build passes**

Watch Vercel dashboard or run:

```bash
gh run list --limit 3
```

- [ ] **Step 3: Update ROADMAP.md**

In `ROADMAP.md`, add to the ✅ Complete section:

```markdown
- **One-off Reminders** — `users/{uid}/reminders` Firestore collection; chat tools: `create_reminder`, `list_reminders`, `cancel_reminder`; fires via existing hourly cron, bypasses DND; hour precision; Claude resolves relative phrases using local date+time from system prompt context
- **Expanded Agent Control** — 9 chat tools covering notification settings (`get_notification_settings`, `update_notification_setting`, `snooze_all_notifications`), app settings (`get_app_settings`, `update_app_setting`), dashboard layout (`get_dashboard_layout`, `manage_dashboard`), and integrations (`get_integration_status`, `trigger_plaid_sync`)
```

Remove "Natural language one-off reminders" from the AI/Automation roadmap section and the entire "Expanded Agent Control" roadmap section.

- [ ] **Step 4: Commit and push**

```bash
git add ROADMAP.md
git commit -m "roadmap: mark one-off reminders and expanded agent control complete"
git push
```
