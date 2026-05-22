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

---

## 📋 Roadmap

### Data & Integrations
- **Instacart / Walmart Grocery** — Push meal plan shopping list directly to a cart for pickup scheduling

### AI & Automation
- **Smart Notifications** — Streak at-risk alerts, habit nudges, goal deadline reminders

### Life OS Features
- **Reading List / Book Tracker** — Log books, highlights, key takeaways summarized by Claude
- **Workout Planner / Strength Tracker** — Plan and program workouts, log sets/reps/weight, track PRs, Claude-generated training plans; complements existing health logging and Google Health sync
- **Budget Tracking** — Per-category monthly spending limits with progress bars and alerts; makes the Finance module actionable rather than just historical
- **Net Worth Dashboard** — Track assets (savings, investments, property) and liabilities (loans, credit cards) over time with monthly snapshots; companion to Finance tracker
- **Time Tracker** — Log what you actually worked on (Toggl-style); pairs with tasks and projects; surfaces in weekly AI review to compare planned vs. actual time spent
- **Focus / Pomodoro Timer** — Start a timed focus session on a specific task, auto-log time on completion, integrates with task list and time tracker
- **Morning Ritual / Daily Standup** — Structured daily planning flow: Claude pulls calendar, open tasks, habits due, and flagged items into a prioritized "here's what today looks like" briefing; cron notification or dedicated dashboard section
- **Decision Journal** — Log important decisions with reasoning and expected outcomes; revisit months later to draw lessons; Claude prompts periodic reviews; integrates with journal and memory
- **Recurring Tasks** — Repeating task support with configurable cadence (daily, weekly, monthly); auto-recreates on completion
- **Hydration Tracking** — Daily water intake log with a goal and dashboard indicator; fits naturally with nutrition and health modules

---

## 💡 Ideas / Parking Lot
- Embedded Discord UI (iframe) — bypass bot API for DMs, blocked by Discord's X-Frame-Options
- Suno official API (no public API yet — check back)
- Mobile app (React Native or Capacitor wrapper)
- Browser extension for quick capture from any webpage
- Beeper Desktop API — MCP server covering WhatsApp, iMessage, Telegram, etc. Local-only, better as a Claude Desktop add-on
