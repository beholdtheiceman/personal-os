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
- **Grocery Price Checker** — "Price Check" button on meal planner shopping list tab; store picker (6 quick-select + custom); Claude + Tavily agentic loop searches for current prices; results shown inline per item with store total banner; supports side-by-side comparison of up to 2 stores
- **PWA Share Target** — `share_target` in `manifest.json`; `/share` page receives URL/title/text and routes to reading list, Second Brain, task, or chat; appears in Android share sheet when PWA is installed
- **Browser Extension** — `extension/` folder: Chrome MV3, reads active tab URL+title, opens `/share` as a 500×620 popup window; reuses existing browser session (no separate auth); load unpacked at `chrome://extensions`
- **Dashboard customization** — Show/hide and reorder 20 dashboard widgets; `useDashboardSettings` hook persists `widgetOrder` + `hiddenWidgets` to `users/{uid}/settings/dashboard`; slide-in `DashboardCustomizer` panel with eye-icon toggles + ↑↓ reorder arrows; "Customize" button in dashboard header; new widgets auto-appended to saved order

- **Personal Newsfeed Aggregator** — RSS and Reddit JSON feeds classified by Claude Haiku (relevance 1–10, topic tags); unread items stored in Firestore with dedup; category tabs, relevance-sorted list, save-to-reading-list, dismiss; star/like button feeds back into Haiku scoring (starred article tags boost relevance on next refresh); daily AI brief (Claude Sonnet, 4–5 sentence prose) cached at `news_brief/{date}` and shown at the top of `/news` and as a dashboard widget; fallback widget shows top 3 unread articles when no brief exists; hourly Vercel cron; chat tools: `get_news_feed`, `save_article`, `add_news_feed`

- **Achievements** — Xbox-style milestone system (35 achievements, ~740G Gamerscore); 3 point tiers (10/25/50G); static definitions in `lib/achievements.ts` across 9 categories (Tasks, Habits, Health, Journal, Goals & Finance, Reading, People, AI & App, Secret); unlock state in `users/{uid}/achievements/{achievementId}`; shared `checkAndAward(uid, id)` helper with Firestore dedup, Web Audio unlock sound (`/sounds/achievement-unlock.mp3`), and toast notification; 3 secret achievements (Night Owl, Early Bird, The Completionist — auto-checked after every unlock); `/achievements` page with full category grid (locked = dimmed + lock icon, secret+locked = ???); dashboard widget showing last 3 unlocks + running Gamerscore; wired into Tasks, Habits, Health, Journal, Chat (ChatInterface + ChatPanel), Hydration, Workouts

---

## 📋 Roadmap

### Gamification (Beyond XP)
- **Streak XP multipliers** — habit streaks that reach 7 days apply a 1.5× XP multiplier on that habit; 30-day streaks apply 2×; multipliers stack with the existing streak bonus toasts and tie directly into the `Week One` / `The Long Game` / `Unbreakable` achievement milestones (hitting the achievement threshold also flips on the multiplier)
- **Daily & weekly challenges** — 3 rotating daily challenges generated each morning (e.g. "Complete 2 tasks", "Hit your water goal", "Log a meal before noon"); weekly challenges are larger ("4 workouts this week", "Finish a book"); challenges are surfaced on the dashboard and in the morning briefing; completing them awards bonus XP and can drive progress toward existing achievements (e.g. daily challenges nudge toward `Perfect Day`)
- **Boss Days** — monthly "Boss Day" challenge that appears on the 1st; harder composite goal (full morning routine + 3 tasks + all habits + journal all in one day); completing it gives a large XP burst + a unique achievement; fills the motivation gap between the 30-day and 100-day habit streak achievements
- **Life Balance Score** — composite score (0–100) across 5 domains: Health, Productivity, Relationships, Finance, Creativity; calculated from recent activity in each area (e.g. workouts logged, tasks completed, interactions logged, budget status, content/reading entries); shown on the dashboard as a ring or bar; low scores in a domain surface a gentle nudge; rewards you for whole-life awareness not just grinding one area
- **Personal best leaderboard** — "Your best week: 2,340 XP — this week: 1,890"; shown in the weekly AI review and on the XP/level card; competes only against your own history; no external comparison
- **Cosmetic rewards** — unlock new dashboard accent colors or UI themes at Gamerscore milestones (250G, 500G, 750G, 1,100G); purely visual, no functional impact; gives the Gamerscore total a destination and makes the `/achievements` page feel more rewarding to check
- **Titles / Prestige labels** — domain-earned titles shown on the dashboard profile header (e.g. "Athlete" at 50 workouts, "Scholar" at 10 books finished, "Chronicler" at 30 journal entries); titles change dynamically as activity patterns shift; personality-driven alternative to purely numeric level display
- **D&D Character Sheet** *(needs scoping before implementation)* — full RPG-style character sheet at `/character`; 6 core stats (STR, DEX, CON, INT, WIS, CHA) each fed by specific app activity; derived skills under each stat that level semi-independently; class auto-assigned from top two stats (Warrior, Wizard, Ranger, Monk, Bard, Cleric, Rogue, Paladin); HP as a CON-driven resilience score (sleep + hydration + mood); feats unlocked at stat milestones that grant temporary bonuses; background chosen at setup for flavor bonuses; existing achievements slot in as the feats section of the sheet; radar/hexagon chart as the ability score overview; dark glass layout styled like a real D&D sheet. Architecture: runs alongside (not replacing) the existing global XP/level system — every action awards global XP as today and also increments the relevant stat(s); a stat weight map in a single config file (e.g. `lib/character.ts`) routes each activity type to one or more stats with weighted increments (e.g. workout → STR +3, CON +1; journal → WIS +2; Bible/church → WIS +2, CHA +1); multi-stat activities are intentional and encouraged. Progression: logarithmic curve — early gains come quickly, later gains require sustained long-term effort; no hard cap; designed to still feel meaningful at year 10 and year 25, not just the first few months. Onboarding: short character creation screen (6–8 questions) at first launch establishes honest base stats so starting values reflect who you actually are today rather than resetting everyone to 1. Scoping questions still to answer: (1) do stats decay during extended inactivity — lean toward no but the Life OS framing (decades-long, not a campaign) makes permanent gains feel more appropriate; a visual "inactive domain" warning may be sufficient instead of actual decay; (2) feat design — what bonuses make sense for a life OS without feeling arbitrary; (3) how the /character page integrates into nav given ongoing consolidation efforts

### Subscriptions — Enhancement Pass
See [`SUBSCRIPTION_ENHANCEMENTS.md`](./SUBSCRIPTION_ENHANCEMENTS.md) for the full implementation plan with file-by-file details and code structure.

- **`lib/streaming-services.ts`** — Registry of known streaming services (Netflix, Disney+, Apple TV+, Prime Video, Max, Peacock, Paramount+, Hulu) with TMDb provider IDs, cancel URLs, and account quick links; auto-populates `tmdbProviderId` and `url` on the subscription form when a known service name is entered
- **Auto-advance renewal dates** — On load, active subscriptions with a past `next_billing_date` are silently advanced by one billing cycle via `updateDoc`; extends `lib/recurrence.ts` with `nextSubscriptionDate` and `advancedBillingDate` helpers covering weekly/monthly/quarterly/yearly cycles
- **Renewal push notifications** — New `subscription_renewal` category in `NotificationSettings` (15th notification type) with configurable `time` and `days_before`; `subscriptionRenewalHandler` in `lib/notification-handlers.ts`; wired into the daily notification cron alongside existing 14 categories
- **TMDb content API** — `app/api/subscriptions/content/route.ts`; fetches movies and TV shows currently available on a streaming provider via The Movie Database discover endpoints; interleaved results sorted by popularity; no date filter (shows full catalog depth, not just new releases); requires `TMDB_API_KEY` env var
- **Watchlist** — New Firestore collection `users/{uid}/watchlist`; `WatchlistItem` type in `types/index.ts`; `useWatchlist` hook with `toggleWatchlistItem`, `isOnWatchlist`, `getCountForSubscription`; watchlist count badge surfaced on subscription cards in `SubscriptionTracker`
- **Content Browser** — `components/subscriptions/ContentBrowser.tsx`; poster grid with hover overlay (plot summary + watchlist toggle); "Worth keeping?" verdict card showing cost-per-interested-title with categorical verdict (great value / decent / consider cancelling); opens from a Browse button on streaming subscription rows
- **Account quick links** — Per-service links (Account, Billing, Cancel) from `lib/streaming-services.ts` surfaced in the subscription form and/or row detail view

### Finance
- **Plaid Production approval** — Sandbox works; applying for Plaid Development/Production so live bank data flows automatically
- **Spending trend predictions** — AI mid-month alert ("you're on pace to overspend dining by $80") using current transactions vs. budget limits

### Extension
- **Right-click context menu** — capture selected text directly to Second Brain, journal, or task without opening the popup; uses Chrome `contextMenus` API (requires background service worker + `contextMenus` permission)
- **Keyboard shortcut** — trigger capture without clicking the toolbar icon (e.g. `Alt+Shift+C`); declared in `manifest.json` `commands`
- **Badge count** — show tasks due today or a live unread count on the toolbar icon; keeps the extension useful even when you're not capturing

### People / Relationships CRM
- **Relationship health score** — numeric score derived from interaction frequency vs. contact frequency target; surfaced per-contact and as a dashboard summary; replaces binary "needs attention" flag
- **AI gift suggestions** — Claude generates gift ideas from the notes, interests, and interaction history you've logged for a person; accessible from the person detail view and via chat

### Tasks / Productivity
- **Eisenhower matrix view** — 2×2 urgent/important grid as an alternate view on the Tasks page; mapped from existing priority score + due date
- **Task dependencies** — mark one task as blocked by another; blocked tasks visually suppressed until prerequisite is complete
- **Context tags** — home / work / errands / etc. tags with a one-tap filtered view; complements existing tag system

### Voice & Speech
See [`docs/VOICE_TTS.md`](./docs/VOICE_TTS.md) and [`docs/REALTIME_API.md`](./docs/REALTIME_API.md) for full implementation details.

- **Voice responses / TTS** *(quick win — 2–4 hours)* — Speak Claude's text responses back to the user using browser `SpeechSynthesis` (Option A, zero cost) or OpenAI TTS API (Option B, better quality). Add a speaker toggle to the chat toolbar. Strip markdown before speaking. Store preference in Firestore settings alongside notification prefs. See `docs/VOICE_TTS.md`.
- **OpenAI Realtime API** *(3–5 days, depends on TTS first)* — Replace the Web Speech API → text → Claude pipeline with a true bidirectional audio WebSocket. Enables sub-300ms response latency, natural interruptions, and VAD (voice activity detection — no button needed, just talk). Requires: ephemeral session token endpoint at `/api/realtime/session`; `AudioWorklet` for PCM16 audio capture; streaming audio playback; `/api/tools/execute` endpoint so the browser can fire Firestore-writing tools server-side; extract `lib/chat-tools.ts` and `lib/tool-executor.ts` from the monolithic `/api/chat/route.ts` to share tools across routes. Note: voice sessions run on GPT-4o (OpenAI); text chat stays on Claude. See `docs/REALTIME_API.md`.
- **Real-time translation mode** *(1 day, depends on Realtime API)* — Travel interpreter that runs inside the Realtime API session with a different system prompt. Two modes: one-way (you speak English → target language comes out) and two-way (full conversation interpreter). Supports 16 languages with quality ratings. Language picker UI, accessible as a tab in the voice panel or via `/translate [language]` skill command. Personal OS context stays available in translation mode (health profile for allergy situations, budget data, etc.). See `docs/TRANSLATION_MODE.md`.

### Agent Skills System
See [`docs/AGENT_SKILLS.md`](./docs/AGENT_SKILLS.md) for full implementation details.

- **Slash-command skills** *(1–2 days)* — Type `/skill-name` in chat to switch the agent into a focused expert mode. The skill injects a specialized system prompt and auto-fetches relevant data on activation. Skills are pure data objects in `lib/skills.ts` — adding a new skill requires no new API routes or components. A `/` button or "Skills" menu in the chat input shows all available skills. Active skill shown as a badge below the chat input; `/end` returns to default mode.
  - `/financial-advisor` — auto-pulls transactions, budget, net worth, savings goals; delivers structured financial snapshot + top concerns + specific recommendations
  - `/health-coach` — auto-pulls health logs, workouts, nutrition, hydration, mood, body metrics; surfaces cross-domain correlations
  - `/weekly-review` — auto-pulls 7 days of data across all domains; structured Wins / Gaps / Patterns / Next Week output
  - `/goal-check` — auto-pulls all active goals; traffic-light status (🟢/🟡/🔴) per goal; identifies stalled goals; ends with one concrete action for today
  - `/relationship-check` — auto-pulls contacts + interaction history; surfaces overdue contacts, upcoming birthdays, drifting relationships
  - `/meal-planner` — auto-pulls recipe library + current week's plan; fills gaps, suggests recipes by macro targets, offers shopping list
  - `/focus` — auto-pulls open tasks + active goals; decides 1–3 things to work on; starts a Pomodoro timer
  - Future: `/bible-study`, `/decision-helper`, `/content-planner`, `/supplement-review`

### Ambient Capture
See [`docs/TRANSCRIPT_INGESTION.md`](./docs/TRANSCRIPT_INGESTION.md) and [`docs/MEETING_INGESTION.md`](./docs/MEETING_INGESTION.md) for full implementation details.

- **Transcript ingestion endpoint** *(1–2 days)* — `POST /api/ingest/transcript` accepts any block of text (voice debrief, pasted notes, meeting transcript) with a context type and uses Claude to extract structured data and fire the appropriate existing tools automatically. Context types: `doctor_visit` (→ health log, supplements, follow-up tasks), `workout_debrief` (→ workout log), `financial_conversation` (→ transactions, decisions), `relationship_debrief` (→ interaction log, CRM updates), `general_debrief` (catch-all). UI: a "Quick Capture" modal with context dropdown and voice input. Requires extracting `lib/tool-executor.ts` from `/api/chat/route.ts`. See `docs/TRANSCRIPT_INGESTION.md`.
- **Meeting bot integration — Recall.ai** *(1 week)* — A bot joins any Zoom, Google Meet, or Teams call via a link. Audio is transcribed by AssemblyAI and sent to a webhook when the meeting ends. Webhook processes the transcript through the ingestion pipeline and files action items → Tasks, decisions → Decisions, people mentions → People CRM, etc. UI: "Send bot to meeting" panel with meeting URL input and context selector. Push notification when notes are ready. See `docs/MEETING_INGESTION.md`.
- **Phone call integration — Twilio** *(3–4 days, after meeting bot)* — A Twilio number bridges phone call audio to the OpenAI Realtime API in real time. The agent listens, transcribes, and files the results when the call ends. Can also be conferenced into any existing call. Simplest alternative: record via Twilio + post-call transcription processing without real-time agent. See `docs/MEETING_INGESTION.md`.

### Weather
See [`docs/WEATHER.md`](./docs/WEATHER.md) for full implementation details.

- **Weather integration** *(1 day)* — Live conditions and 7-day forecast via Open-Meteo (free, no API key). User sets home location in Settings via browser geolocation + Nominatim reverse geocode; lat/lon stored in Firestore so cron and server-side code can access it without browser. Dashboard widget shows current conditions, feels-like, high/low, and 5-day strip. Full `/weather` page with hourly scroll and UV index. Weather injected into morning briefing prompt so Claude can naturally factor conditions into workout/outdoor suggestions. Chat tool: `get_weather`. Total cost: $0. Phase 2 option: add OpenWeatherMap for severe weather push alerts (freeze warnings, storm alerts).

### Password Vault
See [`docs/PASSWORD_VAULT.md`](./docs/PASSWORD_VAULT.md) for full implementation details.

- **Bitwarden integration** *(1–2 days)* — Secure interface into your Bitwarden vault: search credentials, copy username/password to clipboard (auto-clears after 60 seconds), and generate strong passwords — without storing any secrets in Firestore. Two implementation paths: (A) `bw serve` CLI wrapper running as a persistent sidecar (recommended for self-hosted/Railway deployment), or (B) Bitwarden cloud API for serverless. The LLM (Claude) never sees actual passwords — chat tools return metadata only (username + URL). Vault health check surfaces reused, weak, and old passwords as counts. Audit log writes every vault access (item name only) to Firestore. Requires a persistent server process — not Vercel-native; deploy the vault bridge on Render or Railway.

### Financial Rate & Promotion Tracker
See [`docs/RATE_TRACKER.md`](./docs/RATE_TRACKER.md) for full implementation details.

- **Rate & offer aggregator** *(3–4 days)* — Pulls from Doctor of Credit RSS, DepositAccounts RSS, and r/churning / r/personalfinance / r/CreditCards (Reddit JSON API). Claude Haiku parses each item into structured offer data: `{institution, apy, bonus_amount, spend_requirement, spend_timeframe_days, new_customer_only, expires_at, ...}`. A personal rate profile (existing institutions, cards opened in last 24 months, current cards, avg monthly spend from Plaid, available balance to deploy) drives an eligibility layer that flags which offers you can actually get and estimates their dollar value for your situation. The `/rate-tracker` page shows offers sorted by eligible-and-highest-value first, with eligibility warnings ("you're over Chase 5/24") and freshness indicators. FRED API adds benchmark rates (Fed Funds, T-bills) as context. Push alerts fire when a new high-value eligible offer is found. No affiliate links, no "one-tap apply" — links open the offer page for you to apply manually. Chat tools: `get_rate_offers`, `get_benchmark_rates`, `mark_offer_taken`. Cron: every 6 hours. Cost: free (FRED key is free; no other keys needed for v1).

### AI / Automation
- **Natural language one-off reminders** — set a timed push notification from chat ("remind me to call Dr. Smith next Thursday"); stored separately from recurring tasks, fires once via the notification cron
- **Weekly email digest** — Sunday summary email (wins, gaps, upcoming week) as an alternative/complement to the push notification weekly review
- **Auto-tag journal entries** — Claude Haiku post-processes new journal entries to extract mood, topics, and people mentioned; stored as searchable tags

---

## 💡 Ideas / Parking Lot
- Beeper Desktop API — MCP server covering WhatsApp, iMessage, Telegram, etc. Local-only, better as a Claude Desktop add-on
- Net Worth snapshot carry-forward — when logging a new month, pre-populate from the previous month's entries as a starting point
