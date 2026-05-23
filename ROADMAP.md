# Personal OS — Roadmap

## ✅ Complete

- **Phase 1** — App shell, Firebase Auth, Memory System, AI Chat, QuickLog, Daily AI Report
- **Phase 2** — Task Manager (AI priority scoring), Habit Tracker, Google Calendar integration
- **Phase 3** — Journal (voice + AI summary), Nutrition Tracker, Health Tab + Google Fit OAuth (sleep, steps, exercise)
- **Phase 4** — Goals (milestones + AI check-ins), Projects (Kanban), Finance Tracker
- **Chat Tool Use** — 30+ tools: full CRUD across tasks, calendar, habits, nutrition, health, journal, goals, finance, projects, memory, meal planner, people CRM, Drive, workouts, time tracker, focus timer, decisions, savings goals, supplements, insights, content tracker, reading list
- **Second Brain** — PARA vault auto-injected into chat context, search + capture tools
- **Bible Verse** — Verse of the day on dashboard (NLT, free API)
- **Phase 5** — Gmail integration: inbox, email detail, reply, archive, trash, mark read/unread, dashboard widget, chat tools
- **PWA** — Installable on Android home screen, FCM push notifications (morning briefing, habit reminders)
- **Discord** — Bot API: server/channel browser, read messages, send messages *(hidden — re-enable when ready)*
- **Media Player** — YouTube search + IFrame playback, Suno track management, persistent MiniPlayer
- **UI Redesign** — Top nav replacing sidebar, glassmorphism cards, cherry blossom color palette, pixel art parallax background
- **Web Speech API** — Live in chat and journal, replaced OpenAI Whisper (free, browser-native)
- **Web Search** — Tavily integration: live web search from chat, prompt injection defense
- **API auth** — `/api/chat` verifies Firebase ID token; uid spoofing blocked
- **Dashboard widgets** — Goals, projects, finance summary, XP, API usage, email agent, weekly review, quick links, mood, daily briefing, hydration, budget, savings, birthday, AI insights
- **XP / Gamification** — Level system (75+ levels), XP for tasks/habits/journal/health/goals, streak bonuses, level-up toasts
- **Email Agent** — Daily Gmail scanner: auto-classifies receipts + subscriptions, writes to Finance/Subscriptions, inbox analysis + unsubscribe suggestions
- **Meal Planner** — Recipe library, weekly meal grid (Mon–Sun × 4 slots), shopping list generation, Claude tools
- **Quick Links** — Configurable dashboard grid of frequently visited sites with auto-favicons
- **Weekly AI Review** — Sunday cron + manual trigger: Wins / Gaps / Insight / Focus for Next Week
- **Google Drive** — OAuth, file browser, content preview (Docs/Sheets/Slides), chat tools (search + read)
- **People / Relationships CRM** — Contacts, interaction history, contact frequency targets, follow-ups, gift ideas, Google Contacts import, Claude tools
- **Persistent Chat Panel** — Slide-in panel from right (400px desktop, full-screen mobile), pushes content, session-persistent state, Chat toggle in TopNav + MobileNav, full `/chat` page still available
- **Google Health Integration** — Google Health API v4 (`health.googleapis.com`); syncs sleep hours/quality/efficiency, daily steps, resting heart rate, and exercise sessions from Pixel Watch via Google Health; OAuth connect/disconnect flow; auto-prefills health log form; 15-min Firestore cache + server-side time filters to eliminate 15–30s sync lag
- **The Crate** — Personal audio library: upload any MP3/M4A/WAV/OGG/FLAC (up to 50MB) directly from your computer via Vercel Blob storage; files persist and stream through the audio proxy; YouTube + The Crate tab switcher on Media page; MiniPlayer redesigned to match dark glass aesthetic. Suno MP3s can be uploaded here directly.
- **Plaid Integration** — Auto-syncs bank/credit card transactions and recurring streams into the Finance tracker (link-token → exchange → sync to Firestore); surfaced in the Finance "Accounts" tab + chat tools. *(Sandbox-only — live bank data pending Plaid Production/Development approval)*
- **Timezone-Aware Notifications** — Device timezone captured on every app load via `Intl.DateTimeFormat` and stored in Firestore; `lib/timezone.ts` helper used by all cron handlers; all Vercel crons switched to hourly with local-time checks; home timezone picker in Settings
- **Recurring Tasks** — Daily/weekly/monthly recurrence on tasks with optional end date; next instance auto-spawned on completion; `lib/recurrence.ts` for date math; full chat tool support
- **Hydration Tracking** — Daily water intake log with goal, quick +1 widget on Health page, dashboard indicator, XP on goal completion, chat tools
- **Budget Tracking** — Per-category monthly spending limits with progress bars; Budget tab on Finance page; dashboard widget; chat tools
- **Net Worth Dashboard** — Assets and liabilities tracking with monthly snapshots and trend chart; Net Worth tab on Finance page; chat tools
- **Workout Planner / Strength Tracker** — Full workout logging (sets/reps/weight), PR tracking, Claude-generated training plans, workout history; dedicated /workout page; chat tools
- **Time Tracker** — Toggl-style time logging linked to tasks and projects; weekly chart by category; dedicated /time page; injected into weekly AI review; chat tools
- **Focus / Pomodoro Timer** — Countdown timer linked to tasks, auto-logs time on completion, persistent MiniFocusBar across all pages, break timer, TimerContext wired into app layout; chat can start sessions
- **Morning Ritual / Daily Standup** — Daily Claude briefing via cron (calendar, tasks, habits, flagged items); dashboard widget with manual trigger; chat tool
- **Decision Journal** — Structured decision logging with context, options, reasoning, expected outcomes, and scheduled reviews; dashboard nudge for pending reviews; dedicated /decisions page; chat tools
- **Birthday & Gift Reminders** — Push notification when a contact's birthday is approaching; pulls gift ideas from People CRM; dedup logic prevents repeat fires; wired into daily notification cron
- **Savings Goals** — "Save $X by Y date" goals with progress bars and projected completion dates; Claude tracks contributions, dashboard widget, chat tools; savings milestone push notification fires at 25/50/75/100%
- **Mood Tracker** — Standalone daily mood check-in (1–10 with optional note); cross-domain data available in AI Insights; dashboard widget; chat tools
- **Body Metrics Tracker** — Log weight, body fat %, and measurements over time with trend charts; Health page widget; chat tools
- **Gentle Progress Reminders** — Mid-day and evening push notifications that check actual progress against daily targets (hydration, steps, habits, nutrition, scheduled workouts); completely silent when targets are already met; configurable times in Settings
- **Smart Notifications** — Full notification system with 14 configurable categories: morning briefing, streak alert, task reminder, goal deadline, journal reminder, health reminder, weekly review, birthday, savings milestone, progress mid-day, progress evening, decision review, net worth monthly, end-of-day time summary; per-category enable/time controls in Settings; dedup guards on all handlers; Vercel crons at hourly + fixed schedules
- **Phase 7: Content Calendar / Podcast Tracker** — Episode pipeline (idea → outlined → recorded → edited → published), kanban view, calendar view, all-episodes search; episode cards with status advance, notes, tags, links; dedicated /content page; chat tools (add episode, update status, list episodes)
- **Phase 7: Reading List / Book Tracker** — Log books with status (want to read / reading / finished / abandoned), star rating, highlights capture, takeaways; tabbed views with live counts and search; dedicated /reading page; chat tools (add book, update status, log highlight, get reading list)
- **Phase 8: Supplement / Medication Log** — Daily checklist of active supplements with dosage and timing; one-tap "taken" toggle; "X/Y taken" counter; add/edit modal with name, dosage, timing, notes, active toggle; Health page widget; chat tools
- **Phase 8: Proactive AI Insights** — Daily cron uses Claude Opus to analyze 30 days of cross-domain data (mood, health, hydration, habits, workouts, nutrition, time entries, body metrics) and surfaces correlations; dashboard widget with manual refresh; Markdown-rendered insight cards with data source tags; stores to `users/{uid}/ai_insights/{date}`
- **Nav polish** — Desktop More dropdown reorganized into 5 labeled sections with dividers + max-height scroll (never clips); Mobile More sheet reorganized into 4 labeled sections with per-section grids + `overflow-y-auto` (never cut off on small phones); Settings now reachable on mobile (was desktop-only)
- **Goal progress visualization** — Progress bar + milestone checklist already rendered in GoalCard; confirmed complete
- **Goals Check-in Cron** — `GET /api/goals/checkin` handler uses Firestore `updateTime` to detect goals with 14+ days of inactivity; deduped once per week per user; respects `goal_inactivity` notification setting; cron already wired at `0 9 * * *` in `vercel.json`
- **Google Health Auto-Sync** — Nightly cron (`0 3 * * *`) at `GET /api/health/auto-sync`; loops all users with Google Health connected; calls internal `/api/health/data` to get processed sleep/steps/HR/exercise; writes to `users/{uid}/health/{today}` only if no manual entry exists; auto-builds notes string from available metrics
- **Plaid Auto-Sync** — Daily cron (`0 4 * * *`) via new `GET /api/plaid/sync` handler; sync logic extracted into shared `syncUserPlaid(uid, db)` function reused by both POST (user-triggered) and GET (cron); loops all users with connected Plaid items
- **Google Contacts Auto-Sync** — Weekly cron (`0 5 * * 0`) at `GET /api/contacts/sync`; refreshes OAuth token, fetches all contacts from Google People API, upserts by email-first then name-match; batches Firestore writes in groups of 400; updates `last_synced` on integration doc
- **Habit analytics** — 16-week GitHub-style heatmap in `HabitStats.tsx`; current streak, longest streak (365-day window), 30-day completion rate; expandable "Stats" toggle in each HabitCard via bar-chart icon button
- **Dashboard customization** — Show/hide and reorder 19 dashboard widgets; `useDashboardSettings` hook persists `widgetOrder` + `hiddenWidgets` to `users/{uid}/settings/dashboard`; slide-in `DashboardCustomizer` panel with eye-icon toggles + ↑↓ reorder arrows; "Customize" button in dashboard header; new widgets auto-appended to saved order

---

## 📋 Roadmap

### Data & Integrations
- **Grocery Price Checker** — When generating a shopping list from the meal planner, Claude searches for current prices at a store of your choice (via web search) and annotates the list with per-item estimates and a total; can compare across two or three stores

### Finance
- **Plaid Production approval** — Sandbox works; applying for Plaid Development/Production so live bank data flows automatically

---

## 💡 Ideas / Parking Lot
- Embedded Discord UI (iframe) — bypass bot API for DMs, blocked by Discord's X-Frame-Options
- Suno official API (no public API yet — check back)
- Mobile app (React Native or Capacitor wrapper)
- Browser extension for quick capture from any webpage
- Beeper Desktop API — MCP server covering WhatsApp, iMessage, Telegram, etc. Local-only, better as a Claude Desktop add-on
- Weekly/monthly PDF report export
- Net Worth snapshot carry-forward — when logging a new month, pre-populate from the previous month's entries as a starting point
