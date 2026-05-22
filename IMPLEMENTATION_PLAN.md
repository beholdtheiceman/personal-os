# Personal OS — New Features Implementation Plan

## Overview

Nine features grouped into five phases, ordered by complexity and dependency. Each phase builds on the last — the productivity stack (Phase 4) benefits from Time Tracker existing before Focus Timer; the Finance expansion (Phase 2) is self-contained and can ship independently.

---

## Phase 0 — Prerequisite: Timezone-Aware Notifications
*Do this before any cron-triggered feature. Small lift, fixes a systemic problem.*

### The Problem
Vercel crons are static UTC schedules set at deploy time. Any "trigger at 8am" behavior is currently baked in as a UTC offset, which means it silently breaks with DST twice a year and doesn't follow you when you travel. Most consumer apps solve this at the OS level (mobile local notifications) or via a paid notification platform (OneSignal, Braze). For a single-user PWA on Vercel, the right pattern is: **capture device timezone on each visit → store in Firestore → run crons hourly → check local time in the handler before firing.**

### What to Build

**Step 1 — Capture and store device timezone**

In `app/layout.tsx` (or `contexts/AuthContext.tsx`), after auth resolves, read the browser timezone and write it to Firestore:

```typescript
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "America/New_York"
await db.doc(`users/${uid}/settings/timezone`).set({
  current_timezone: tz,
  updated_at: new Date().toISOString(),
}, { merge: true });
```

This runs on every app load, so it automatically updates when you travel. No user action required.

**Step 2 — Add timezone to user settings type**

In `types/index.ts`, add:
```typescript
export interface TimezoneSettings {
  current_timezone: string;   // updated from device on each visit, e.g. "America/New_York"
  home_timezone: string;      // user's chosen "home" timezone, set in Settings UI
}
```

`home_timezone` is a manual setting (defaulting to whatever `current_timezone` was on first write) for cases where the user wants a fixed time regardless of travel. `current_timezone` follows the device.

**Step 3 — Add a timezone helper in `lib/`**

Create `lib/timezone.ts`:
```typescript
import { getAdminDb } from "./firebase-admin";

// Returns true if the current UTC time matches the user's preferred local time (within the current hour)
export async function isLocalTime(uid: string, preferredTime: string, useCurrentTz = true): Promise<boolean> {
  const db = getAdminDb();
  const doc = await db.doc(`users/${uid}/settings/timezone`).get();
  const data = doc.data();
  if (!data) return false;

  const tz = useCurrentTz
    ? (data.current_timezone ?? data.home_timezone ?? "America/New_York")
    : (data.home_timezone ?? "America/New_York");

  const now = new Date();
  const localTime = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const [localHour, localMin] = localTime.split(":").map(Number);
  const [prefHour, prefMin] = preferredTime.split(":").map(Number);

  // Match within the same hour (cron fires once/hour, so minute precision is approximate)
  return localHour === prefHour;
}
```

**Step 4 — Switch cron schedules to hourly**

In `vercel.json`, change all notification/briefing crons from specific UTC times to `0 * * * *` (top of every hour). Each route handler calls `isLocalTime(uid, userPreferredTime)` and returns early if it's not the right hour for that user.

**Step 5 — Settings UI**

In `app/(pages)/settings/` (or the existing notifications settings), add a timezone selector:
- Show current detected timezone (`current_timezone`) as read-only with a "this updates automatically when you travel" note
- Allow setting `home_timezone` as a manual override for when the user wants a fixed schedule regardless of location

**Files to create/modify:**
- `lib/timezone.ts` — new helper (Step 3)
- `app/layout.tsx` or `contexts/AuthContext.tsx` — timezone capture on auth (Step 1)
- `types/index.ts` — `TimezoneSettings` interface (Step 2)
- `vercel.json` — switch to hourly crons (Step 4)
- All existing cron route handlers (`/api/notifications/daily`, `/api/notifications/habits`, `/api/weekly-review`, `/api/gmail/agent`) — wrap logic with `isLocalTime()` check
- `app/(pages)/settings/` — timezone display + home timezone picker (Step 5)

**Result:** Every cron-triggered feature built after this — Morning Ritual, Smart Notifications, Weekly Review — automatically respects wherever you are in the world. No per-feature timezone work needed.

---

## Phase 1 — Quick Wins
*Low complexity, extend existing systems. Ship fast.*

### 1A. Recurring Tasks

**What it is:** Tasks that auto-recreate on completion at a configurable cadence (daily, weekly, monthly, custom interval).

**Firestore:**
```
users/{uid}/tasks/{taskId}
  + recurrence: "daily" | "weekly" | "monthly" | null
  + recurrence_days?: number[]   // for weekly: [1,3,5] = Mon/Wed/Fri
  + recurrence_end?: string      // YYYY-MM-DD, optional
  + parent_task_id?: string      // links recurring copies back to original
```

**Types (`types/index.ts`):**
- Add `recurrence` and related fields to the `Task` interface
- Add `RecurrenceCadence` type

**Files to create/modify:**
- `components/tasks/TaskForm.tsx` — add recurrence selector (None / Daily / Weekly / Monthly)
- `components/tasks/TaskItem.tsx` — show recurrence badge
- `app/api/tasks/recur/route.ts` — POST endpoint: when a recurring task is completed, create the next instance with the correct due date
- `app/api/chat/route.ts` — update `add_task` tool schema to accept `recurrence` field; update `update_task` handler to call the recur endpoint on completion

**Logic:** On task completion, if `recurrence` is set, compute next due date and write a new task doc copying title/description/tags/recurrence. The completed task stays in history as normal.

---

### 1B. Hydration Tracking

**What it is:** Daily water intake log with a goal (default 8 cups / 64 oz) and a dashboard indicator.

**Firestore:**
```
users/{uid}/hydration/{YYYY-MM-DD}
  glasses: number        // cups logged today
  goal: number           // default 8
  logs: Timestamp[]      // individual log events
  updated_at: string
```

**Types (`types/index.ts`):**
- Add `HydrationLog` interface

**Files to create/modify:**
- `components/health/HydrationWidget.tsx` — quick +1 button, goal ring, daily progress; lives on Health page and Dashboard
- `app/(pages)/health/page.tsx` — add Hydration section below existing health log
- `components/dashboard/` — add `HydrationDashboardWidget.tsx` (compact: "5 / 8 glasses")
- `app/api/hydration/route.ts` — GET today's log, POST to increment, PATCH to set goal
- `app/api/chat/route.ts` — add `log_water` and `get_hydration` tools
- `hooks/useHydration.ts` — Firestore real-time hook

**XP:** Award 10 XP when daily goal is hit.

---

## Phase 2 — Finance Expansion
*New tabs on the existing Finance page. No new top-nav entries needed.*

### 2A. Budget Tracking

**What it is:** Per-category monthly spending limits. Progress bars show actual vs. budget. Alerts when approaching or over.

**Firestore:**
```
users/{uid}/budgets/{YYYY-MM}         // one doc per month
  categories: {
    [category: string]: {
      limit: number,
      alert_threshold: number         // default 0.8 (80%)
    }
  }
  created_at: string
```

**Types (`types/index.ts`):**
- Add `BudgetMonth`, `BudgetCategory` interfaces

**Files to create/modify:**
- `components/finance/BudgetTracker.tsx` — category list with limit input + progress bar per category; pulls actual spend from existing transactions for current month
- `app/(pages)/finance/page.tsx` — add "Budget" to the Tab type and tab switcher
- `app/api/finance/budget/route.ts` — GET/POST/PATCH budget doc for current month
- `app/api/chat/route.ts` — add `set_budget`, `get_budget_status` tools
- `hooks/useBudget.ts` — fetches budget + computes actuals from transactions

**Dashboard widget:** Small "Budget Health" card showing categories in the red or approaching limit. Add to `components/dashboard/`.

---

### 2B. Net Worth Dashboard

**What it is:** Track assets and liabilities over time. Monthly snapshot stored automatically. Chart of net worth trend.

**Firestore:**
```
users/{uid}/net_worth/{YYYY-MM}
  assets: {
    [name: string]: { value: number, category: "cash" | "investment" | "property" | "other" }
  }
  liabilities: {
    [name: string]: { value: number, category: "loan" | "credit_card" | "mortgage" | "other" }
  }
  total_assets: number
  total_liabilities: number
  net_worth: number
  snapshot_date: string
  created_at: string
```

**Types (`types/index.ts`):**
- Add `NetWorthSnapshot`, `AssetEntry`, `LiabilityEntry` interfaces

**Files to create/modify:**
- `components/finance/NetWorthTracker.tsx` — asset/liability editor + monthly trend line chart (reuse the chart pattern from health/nutrition)
- `app/(pages)/finance/page.tsx` — add "Net Worth" tab
- `app/api/finance/net-worth/route.ts` — GET history, POST/PATCH current month snapshot
- `app/api/chat/route.ts` — add `update_net_worth`, `get_net_worth` tools
- `hooks/useNetWorth.ts`

**Auto-snapshot:** On first visit of a new month, prompt user to update values (or auto-carry forward previous month's entries as a starting point).

---

## Phase 3 — Health Expansion

### 3A. Workout Planner / Strength Tracker

**What it is:** Plan workouts, log sets/reps/weight per exercise, track PRs, Claude can generate weekly training plans.

**Firestore:**
```
users/{uid}/exercises/{exerciseId}    // exercise library
  name: string
  category: "push" | "pull" | "legs" | "core" | "cardio" | "other"
  pr_weight?: number
  pr_reps?: number
  pr_date?: string

users/{uid}/workouts/{workoutId}      // workout sessions
  date: string                        // YYYY-MM-DD
  name: string                        // e.g. "Push Day A"
  exercises: [
    {
      exercise_id: string
      exercise_name: string
      sets: [{ reps: number, weight: number, unit: "lbs" | "kg" }]
      notes?: string
    }
  ]
  duration_min?: number
  notes?: string
  created_at: string

users/{uid}/workout_plans/{planId}    // Claude-generated plans
  name: string
  days: [{ day: string, focus: string, exercises: string[] }]
  created_at: string
```

**Types (`types/index.ts`):**
- Add `Exercise`, `WorkoutSession`, `WorkoutSet`, `WorkoutPlan` interfaces

**Files to create/modify:**
- `app/(pages)/workout/page.tsx` — tab layout: Log / History / Plans / PRs
- `components/workout/WorkoutLogger.tsx` — today's session: add exercises, log sets inline
- `components/workout/ExerciseLibrary.tsx` — searchable list of exercises with PR badge
- `components/workout/WorkoutHistory.tsx` — past sessions with expand/collapse
- `components/workout/PRBoard.tsx` — personal records per exercise with trend
- `components/workout/WorkoutPlan.tsx` — display Claude-generated plan with day-by-day breakdown
- `app/api/workout/route.ts` — CRUD for sessions and exercises
- `app/api/chat/route.ts` — add tools: `log_workout`, `get_workout_history`, `get_prs`, `generate_workout_plan`, `list_exercises`
- `hooks/useWorkout.ts`
- TopNav / MobileNav — add Workout entry

**XP:** Award XP for completed workout sessions (e.g. 50 XP base + 10 per exercise logged).

**PR Detection:** On each set logged, compare against stored PR. If new PR, toast notification + update PR doc.

---

## Phase 4 — Productivity Stack
*Build Time Tracker first — Focus Timer logs to it.*

### 4A. Time Tracker

**What it is:** Toggl-style log of what you actually worked on. Entries link to tasks or projects. Surfaces in the weekly AI review.

**Firestore:**
```
users/{uid}/time_entries/{entryId}
  date: string                      // YYYY-MM-DD
  start_time: string                // ISO timestamp
  end_time: string                  // ISO timestamp
  duration_min: number
  description: string
  task_id?: string                  // optional link to task
  project_id?: string               // optional link to project
  category: "work" | "personal" | "health" | "learning" | "other"
  source: "manual" | "timer"        // timer = came from Focus/Pomodoro
  created_at: string
```

**Types (`types/index.ts`):**
- Add `TimeEntry` interface

**Files to create/modify:**
- `app/(pages)/time/page.tsx` — tab layout: Today / Week / By Project
- `components/time/TimeEntryForm.tsx` — manual log: description, category, duration, optional task/project link
- `components/time/TimeLog.tsx` — chronological list for selected day
- `components/time/WeeklyTimeChart.tsx` — bar chart by category (reuse health chart pattern)
- `components/time/ProjectBreakdown.tsx` — hours per project this week
- `app/api/time/route.ts` — CRUD for time entries
- `app/api/chat/route.ts` — add `log_time`, `get_time_summary` tools
- `app/api/weekly-review/route.ts` — inject time summary into weekly review prompt
- `hooks/useTimeTracker.ts`
- TopNav / MobileNav — add Time entry

---

### 4B. Focus / Pomodoro Timer

**What it is:** Timed focus sessions linked to a specific task. Counts down, notifies on completion, auto-logs time entry. Persists across navigation via context (like PlayerContext).

**No new Firestore collection needed** — completed sessions write to `time_entries` with `source: "timer"`.

**Files to create/modify:**
- `contexts/TimerContext.tsx` — global timer state: active task, seconds remaining, status (idle/running/paused/break). Wrap in `app/layout.tsx` alongside PlayerContext.
- `components/focus/FocusTimer.tsx` — the timer UI: task selector dropdown (pulls open tasks), duration picker (25/50/custom), countdown ring, pause/stop controls
- `components/focus/MiniFocusBar.tsx` — persistent bar at bottom (above MiniPlayer if active) showing "🍅 18:42 remaining — Build auth flow". Visible on all pages while timer is running.
- `app/(pages)/focus/page.tsx` — full-page timer view with stats (sessions today, total focus time this week)
- On session complete: write `TimeEntry` to Firestore via `/api/time`, show toast "Focus session complete — 25 min logged to [task name]", auto-start break timer (5 min)
- `app/api/chat/route.ts` — add `start_focus_session` tool (Claude can kick off a session for a named task)
- TopNav / MobileNav — Focus link (or accessible via MiniFocusBar)

---

## Phase 5 — AI & Reflection

### 5A. Morning Ritual / Daily Standup

**What it is:** A structured daily briefing Claude generates each morning. Pulls calendar events, open tasks (by priority), habits due today, and any flagged items. Delivered as a push notification and/or as a persistent dashboard card.

**Firestore:**
```
users/{uid}/daily_briefings/{YYYY-MM-DD}
  generated_at: string
  content: string           // Claude's markdown briefing
  calendar_events: number   // count pulled
  tasks_flagged: number
  habits_due: number
```

**Files to create/modify:**
- `app/api/daily-briefing/route.ts` — POST: assembles context (today's calendar events, top 5 priority tasks, habits scheduled for today, any goals with upcoming milestones) → sends to Claude → writes to Firestore. Secured with `CRON_SECRET`.
- `vercel.json` — add cron: `0 11 * * *` → `/api/daily-briefing` (7 AM ET)
- `components/dashboard/DailyBriefingWidget.tsx` — card on dashboard showing today's briefing (collapsed by default, expand to read). "Generate now" manual trigger button.
- `app/api/notifications/daily/route.ts` — extend existing morning briefing notification to include a summary line from the briefing content
- `app/api/chat/route.ts` — add `get_daily_briefing` tool so Claude can surface today's briefing in chat

**Note:** Different from the Weekly Review — this is daily, shorter, forward-looking ("here's today") vs. the weekly which is retrospective ("here's how the week went").

---

### 5B. Decision Journal

**What it is:** Log important decisions with context, reasoning, alternatives considered, and expected outcome. Claude prompts you to revisit old decisions. Over time becomes a personal decision log you can learn from.

**Firestore:**
```
users/{uid}/decisions/{decisionId}
  title: string                       // e.g. "Switch to freelance full-time"
  date: string                        // YYYY-MM-DD — when decision was made
  context: string                     // what situation prompted this
  options_considered: string[]        // alternatives you weighed
  chosen_option: string               // what you decided
  reasoning: string                   // why
  expected_outcome: string            // what you expect to happen
  review_date: string                 // YYYY-MM-DD — when to revisit (default: +90 days)
  review_notes?: string               // filled in on revisit
  outcome_rating?: number             // 1-5 — how did it turn out?
  status: "pending_review" | "reviewed"
  tags?: string[]
  created_at: string
  updated_at: string
```

**Types (`types/index.ts`):**
- Add `Decision` interface

**Files to create/modify:**
- `app/(pages)/decisions/page.tsx` — tab layout: Active / Pending Review / All
- `components/decisions/DecisionForm.tsx` — structured form: title, context, options (add/remove), chosen option, reasoning, expected outcome, review date
- `components/decisions/DecisionCard.tsx` — card view with expand; shows "Due for review" badge when review_date has passed
- `components/decisions/DecisionReview.tsx` — review modal: outcome notes + rating; updates status to "reviewed"
- `components/dashboard/DecisionReviewWidget.tsx` — dashboard nudge: "You have 2 decisions due for review"
- `app/api/decisions/route.ts` — CRUD
- `app/api/chat/route.ts` — add `log_decision`, `list_decisions`, `review_decision` tools
- `hooks/useDecisions.ts`
- TopNav / MobileNav — Decisions entry (or nest under Journal)
- `app/api/weekly-review/route.ts` — include count of decisions pending review in weekly report

---

## Suggested Build Order

| # | Feature | Effort | Why this order |
|---|---|---|---|
| 1 | Recurring Tasks | S | Pure extension of existing Task system, no new page |
| 2 | Hydration Tracking | S | Fits inside Health page, tiny Firestore footprint |
| 3 | Budget Tracking | M | New Finance tab, leverages existing transaction data |
| 4 | Net Worth Dashboard | M | New Finance tab, self-contained |
| 5 | Workout Planner | L | Biggest health feature, deserves its own phase |
| 6 | Time Tracker | M | Must exist before Focus Timer can log to it |
| 7 | Focus / Pomodoro Timer | M | Depends on Time Tracker |
| 8 | Morning Ritual | M | Depends on solid task/habit/calendar data existing |
| 9 | Decision Journal | M | Standalone, save for last — lowest daily utility urgency |

**Effort key:** S = 1–2 days, M = 3–5 days, L = 1 week+

---

## Cross-cutting Changes (do once, benefit all)

- **`types/index.ts`** — add all new interfaces in one pass before starting Phase 1
- **TopNav / MobileNav** — plan nav slots for Workout, Time, Focus, Decisions upfront so you're not reorganizing nav repeatedly
- **Weekly Review prompt (`app/api/weekly-review/route.ts`)** — after each phase, add that module's data to the review context (time summary, workout sessions, hydration average, decisions pending)
- **XP events** — extend `XPEventType` to cover `workout_complete`, `hydration_goal`, `focus_session`, `decision_logged`
