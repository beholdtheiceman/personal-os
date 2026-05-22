# Personal OS — Roadmap

## ✅ Complete

- **Phase 1** — App shell, Firebase Auth, Memory System, AI Chat, QuickLog, Daily AI Report
- **Phase 2** — Task Manager (AI priority scoring), Habit Tracker, Google Calendar integration
- **Phase 3** — Journal (voice + AI summary), Nutrition Tracker, Health Tab + Google Fit OAuth (sleep, steps, exercise)
- **Phase 4** — Goals (milestones + AI check-ins), Projects (Kanban), Finance Tracker
- **Chat Tool Use** — 30+ tools: full CRUD across tasks, calendar, habits, nutrition, health, journal, goals, finance, projects, memory, meal planner, people CRM, Drive
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
- **Dashboard widgets** — Goals, projects, finance summary, XP, API usage, email agent, weekly review, quick links
- **XP / Gamification** — Level system (75+ levels), XP for tasks/habits/journal/health/goals, streak bonuses, level-up toasts
- **Email Agent** — Daily Gmail scanner: auto-classifies receipts + subscriptions, writes to Finance/Subscriptions, inbox analysis + unsubscribe suggestions
- **Meal Planner** — Recipe library, weekly meal grid (Mon–Sun × 4 slots), shopping list generation, Claude tools
- **Quick Links** — Configurable dashboard grid of frequently visited sites with auto-favicons
- **Weekly AI Review** — Sunday cron + manual trigger: Wins / Gaps / Insight / Focus for Next Week
- **Google Drive** — OAuth, file browser, content preview (Docs/Sheets/Slides), chat tools (search + read)
- **People / Relationships CRM** — Contacts, interaction history, contact frequency targets, follow-ups, gift ideas, Google Contacts import, Claude tools
- **Persistent Chat Panel** — Slide-in panel from right (400px desktop, full-screen mobile), pushes content, session-persistent state, Chat toggle in TopNav + MobileNav, full `/chat` page still available
- **Google Health Integration** — Google Health API v4 (`health.googleapis.com`) with `googlehealth.*` scopes; syncs sleep hours/quality/efficiency, daily steps, resting heart rate, and exercise sessions from Pixel Watch via Google Health; OAuth connect/disconnect flow; auto-prefills health log form
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
- **Savings Milestone Notifications** — Fires when a savings goal crosses 25%, 50%, 75%, or 100% of its target; dedup per milestone per goal
- **Gentle Progress Reminders** — Mid-day and evening push notifications that check actual progress against daily targets (hydration, steps, habits, nutrition, scheduled workouts); completely silent when targets are already met; configurable times in Settings; fixed truncated daily cron route as part of this work

---

## 📋 Roadmap

### Data & Integrations
- **Grocery Price Checker** — When generating a shopping list from the meal planner, Claude searches for current prices at a store of your choice (via web search) and annotates the list with per-item estimates and a total; can compare across two or three stores
- **Google Health Auto-Sync** — Nightly cron pulls sleep, steps, heart rate, and exercise from Google Health API and writes to Firestore automatically; no manual refresh needed; pre-populates health log form when you open it
- **Plaid Auto-Sync** — Daily cron keeps bank and credit card transactions current without requiring a manual "Sync now" tap; mirrors the Gmail agent pattern
- **Google Contacts Auto-Sync** — Weekly cron re-syncs contacts using the stored OAuth token; catches new additions and updated info without a manual import

### AI & Automation
- **Smart Notifications** — Streak at-risk alerts, habit nudges, goal deadline reminders
- **Proactive AI Insights** — Claude periodically analyzes patterns across all data sources (sleep, energy, mood, habits, nutrition, workouts, time logs) and surfaces correlations unprompted; weekly or daily insight card on dashboard; unique to this app because it holds all the data in one place
- **Decision Review Notifications** — Push notification when a logged decision hits its review date; uses the same dedup pattern as birthday and goal deadline handlers
- **Net Worth Monthly Reminder** — First-of-month prompt to update your net worth snapshot; carries forward previous month's entries as a starting point
- **Goals Check-in Cron** — Weekly automated review of goal milestone progress; nudges via notification if a goal has had no activity in 14+ days
- **End-of-Day Time Summary** — Evening notification summarizing hours logged, top category, and any tasks with time logged vs. estimated; only fires on days where at least one time entry exists

### Health
- **Body Metrics Tracker** — Log weight, body fat %, and measurements over time with trend charts; fills the gap in the health module alongside sleep, steps, heart rate, and nutrition
- **Supplement / Medication Log** — Track daily supplements and medications with dosage, timing, and notes; fits naturally alongside hydration and nutrition; reminder notification if not logged by a set time
- **Mood Tracker** — Standalone daily mood check-in (1–10 with optional note, separate from journal); enables cross-domain correlation with sleep, exercise, habits, and nutrition over time; pairs with Proactive AI Insights

### Finance
- **Savings Goals** — "Save $X by Y date" goals with progress bars and projected completion dates; natural extension of the budget and net worth modules; Claude can track contributions and nudge via Smart Notifications

### Creator
- **Content Calendar / Podcast Tracker** — Episode planning and status tracking (idea → recorded → edited → published) with publish dates, notes, and links; content calendar view; fits the Be Prepared Podcast workflow

### Life OS Features
- **Reading List / Book Tracker** — Log books, highlights, key takeaways summarized by Claude

---

## 💡 Ideas / Parking Lot
- Embedded Discord UI (iframe) — bypass bot API for DMs, blocked by Discord's X-Frame-Options
- Suno official API (no public API yet — check back)
- Mobile app (React Native or Capacitor wrapper)
- Browser extension for quick capture from any webpage
- Beeper Desktop API — MCP server covering WhatsApp, iMessage, Telegram, etc. Local-only, better as a Claude Desktop add-on
