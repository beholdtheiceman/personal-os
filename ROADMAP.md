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

---

## 📋 Roadmap

### Data & Integrations
- **Grocery Price Checker** — When generating a shopping list from the meal planner, Claude searches for current prices at a store of your choice (via web search) and annotates the list with per-item estimates and a total; can compare across two or three stores
- **Google Health Auto-Sync** — Nightly cron pulls sleep, steps, heart rate, and exercise from Google Health API and writes to Firestore automatically; no manual refresh needed; pre-populates health log form when you open it *(15-min cache is live; full nightly cron still pending)*
- **Plaid Auto-Sync** — Daily cron keeps bank and credit card transactions current without requiring a manual "Sync now" tap; mirrors the Gmail agent pattern
- **Google Contacts Auto-Sync** — Weekly cron re-syncs contacts using the stored OAuth token; catches new additions and updated info without a manual import

### AI & Automation
- **Goals Check-in Cron** — Weekly automated notification if a goal has had no activity in 14+ days; `/api/goals/checkin` currently only handles `POST` (on-demand AI message for the UI) — needs a `GET` handler with inactivity detection and FCM push; cron is wired in `vercel.json` at `0 9 * * *`

### Dashboard
- **Dashboard customization** — Show/hide and reorder dashboard widgets; currently all widgets render unconditionally; a simple `settings/dashboard` doc with a widget order array would drive it

### Analytics
- **Habit analytics** — GitHub-style heatmap + streak history + completion rate chart per habit; data is all in Firestore, just no visualization beyond the basic checklist
- **Goal progress visualization** — Visual progress bar for milestone completion; milestones array exists in the type but isn't rendered graphically on the goals page

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
