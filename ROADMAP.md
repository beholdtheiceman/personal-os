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
- **Plaid Integration** — Auto-syncs bank/credit card transactions and recurring streams into the Finance tracker (link-token → exchange → sync to Firestore); surfaced in the Finance "Accounts" tab + chat tools. Live bank data active via Plaid Production approval.
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

- **Subscriptions Enhancement Pass** — `lib/streaming-services.ts` registry for 8 streaming services with TMDb provider IDs, cancel URLs, and account quick links; auto-populates form on known service name; auto-advance of past `next_billing_date` on load via `advancedBillingDate` in `lib/recurrence.ts`; `subscription_renewal` push notification category (15th type) with configurable `time` and `days_before`; TMDb content API at `app/api/subscriptions/content/route.ts`; `useWatchlist` hook + `users/{uid}/watchlist` Firestore collection; `ContentBrowser.tsx` poster grid with "Worth keeping?" verdict (cost-per-watchlisted-title); watchlist count badge and Browse button on streaming subscription rows

- **Personal Newsfeed Aggregator** — RSS and Reddit JSON feeds classified by Claude Haiku (relevance 1–10, topic tags); unread items stored in Firestore with dedup; category tabs, relevance-sorted list, save-to-reading-list, dismiss; star/like button feeds back into Haiku scoring (starred article tags boost relevance on next refresh); daily AI brief (Claude Sonnet, 4–5 sentence prose) cached at `news_brief/{date}` and shown at the top of `/news` and as a dashboard widget; fallback widget shows top 3 unread articles when no brief exists; hourly Vercel cron; chat tools: `get_news_feed`, `save_article`, `add_news_feed`

- **Agent Slash-Command Skills** — Type `/` in chat to open a floating skill picker; 7 built-in skills (`/financial-advisor` 💰, `/health-coach` 🏃, `/weekly-review` 📋, `/goal-check` 🎯, `/relationship-check` 👥, `/meal-planner` 🥗, `/focus` 🎧); each skill silently sends an opening message + injects a specialized system prompt block; active skill shown as a purple badge below input; `/end` or × exits to default mode; skills are pure data objects in `lib/skills.ts` with no new API routes needed

- **Voice Responses / TTS** — Speaker toggle in chat toolbar (next to mic); reads Claude responses aloud via OpenAI `tts-1` ("nova" voice) through `app/api/tts/route.ts`; markdown stripped before speaking; active-audio tracking for stop support; `localStorage` persistence; toggle in both ChatInterface and ChatPanel; `lib/tts.ts` + `hooks/useTTS.ts`; graceful no-op fallback if the route is unavailable; cost ~$0.005 per typical response

- **Ambient Capture / Transcript Ingestion** — 📥 Quick Capture button in TopNav opens a glass modal; pick a context type (general / meeting / doctor visit / workout / finance / relationship), paste text or dictate via voice (MediaRecorder → `/api/transcribe` Whisper); `POST /api/ingest/transcript` runs Claude Haiku to extract structured JSON and writes directly to Firestore (tasks, decisions, health, workouts, interactions, journal, transactions) tagged `source: "ambient_capture"`; inline results panel shows a summary + bulleted list of everything filed; `QuickCaptureContext` for global open/close state

- **PDF Chat Support** — Attach a PDF in chat (full page or slide-in panel); read as base64 client-side and sent to Claude as a native `document` content block (handles scanned PDFs via Anthropic's server-side OCR); replaced the old stub that hallucinated "limited browser PDF parsing"

- **Weather Integration** — Live conditions and 7-day forecast via Open-Meteo (free, no API key); browser geolocation + Nominatim reverse geocode → lat/lon + city name stored at `users/{uid}/settings/weather`; °F/°C toggle persisted per user; `lib/weather.ts` shared helper (WMO code map, emoji map, UV label, `fetchWeatherData()`); `GET /api/weather` authenticated route; compact dashboard widget (current temp + emoji + feels-like + high/low + 5-day strip); full `/weather` page (current conditions, 24h hourly scroll, 7-day forecast, UV index bar); weather injected into morning briefing prompt; `get_weather` chat tool; Weather added to Health nav section in TopNav + MobileNav; total cost: $0

- **Achievements** — Xbox-style milestone system (35 achievements, ~740G Gamerscore); 3 point tiers (10/25/50G); static definitions in `lib/achievements.ts` across 9 categories (Tasks, Habits, Health, Journal, Goals & Finance, Reading, People, AI & App, Secret); unlock state in `users/{uid}/achievements/{achievementId}`; shared `checkAndAward(uid, id)` helper with Firestore dedup, Web Audio unlock sound (`/sounds/achievement-unlock.mp3`), and toast notification; 3 secret achievements (Night Owl, Early Bird, The Completionist — auto-checked after every unlock); `/achievements` page with full category grid (locked = dimmed + lock icon, secret+locked = ???); dashboard widget showing last 3 unlocks + running Gamerscore; wired into Tasks, Habits, Health, Journal, Chat (ChatInterface + ChatPanel), Hydration, Workouts

---

## 🧭 Life OS Core ← Build This Next

> These are not features — they are the foundation. Every system already built, and everything on the roadmap below, becomes more valuable once this layer exists. The Personal Constitution is the first thing to build.

### Personal Constitution ✅ Complete
- **The "why" layer the entire app is missing.** Right now the app knows everything about what you do and almost nothing about why. The Constitution is a structured document stored in Firestore at `users/{uid}/constitution` and injected into Claude's chat context on every session — load-bearing context, not a page you visit occasionally.
- **What it contains:**
  - **Core values** — 3–7 values with personal definitions (not dictionary definitions — what *this value* means to *you*, how you'd know you were living it, how you'd know you weren't)
  - **Personal mission statement** — one or two sentences that capture what you're here to do and who you're trying to become
  - **Life roles** — the key roles you hold (man of faith, [key relationships], professional, etc.) with a sentence on what excellence looks like in each
  - **Long-term vision** — where you're trying to be in 10 years across the domains that matter most
  - **Non-negotiables** — things you will not compromise regardless of circumstance
  - **Legacy statement** — what you want to have been true about your life when it's over
- **Guided creation flow — not a form.** Claude walks you through 8–10 deep questions in a conversation before generating a draft:
  - "What would you regret not doing or becoming?"
  - "When have you felt most fully alive — what were you doing and why did it matter?"
  - "What do you want people to say about you at your funeral?"
  - "What would you do if money, time, and fear were removed?"
  - "What are you most proud of in the last 5 years, and what does that reveal about what you value?"
  - "Where is the biggest gap between who you are and who you want to be?"
  - Claude synthesizes answers into a draft Constitution; you refine it in a structured editor. The process of *arriving* at the document is half the value — it surfaces things you already know but haven't articulated.
- **Load-bearing in every system:**
  - Injected into chat system prompt so Claude references values naturally in every interaction
  - Goals and habits can be tagged to values — you can see which values your current commitments serve
  - Weekly review includes an alignment section (see below)
  - Annual report includes a values section
  - OKRs are explicitly linked to Constitution values
  - Morning briefing opens with a value-of-the-day or a reflection prompt drawn from your mission
  - Quarterly review prompt asks how the season served your Constitution, not just your metrics
- **Living document.** Prompted review each quarter (alongside OKR review) and annually (alongside the Annual Report). Claude notes which sections haven't been updated in over a year and asks if they still hold.

### Alignment Gap Detection ✅ Complete
- **The most powerful thing the Constitution unlocks.** Claude already has visibility into almost everything you do — time logs, habits, spending, journal entries, goals, workouts, interactions. Once it knows what you said matters most, it can notice when your actions don't match. Not harshly — honestly.
- **Weekly alignment section in the AI Review** — sits above all domain-specific metrics. Two questions: (1) How aligned was this week with your stated values? (2) Where was the biggest gap? Examples:
  - "You've listed faith as your top value, but this is the third week without a logged quiet time or church attendance."
  - "Your mission includes financial freedom, but you've exceeded discretionary spending four weeks in a row."
  - "You said family is your top priority. Your time tracker shows 31 hours of work and no logged quality time with family this week."
- **Framing matters.** These observations are delivered as honest observations from someone who knows you and wants you to win — not judgment, not a score. Claude notes the gap, names it plainly, and moves on. You decide what to do with it.
- **Alignment score** — optional, lightweight: a simple weekly read (🟢 Well-aligned / 🟡 Some drift / 🔴 Significant gap) based on behavior vs. Constitution. Not a metric to optimize — a mirror to look into.
- **Role-level check-ins** — beyond overall alignment, Claude can surface role-specific gaps: "Looking at your [key role], here's what excellent looks like by your own definition — and here's what last week actually looked like."

### Life Season System ✅ Complete
- **The key insight: seasons are recognized, not declared.** You don't always know what kind of period you're entering until you're already in it. A deliberate sprint toward a goal can be named in advance — but burnout, grief, uncertainty, and transition tend to arrive uninvited. The system shouldn't ask you to pick a season from a list. It should help you *notice* what's actually happening and name it so you can be intentional about it rather than just reactive.
- **Two scales that matter:**
  - **Life chapters** — the long arcs, years in length. Building a career. Early marriage. A period of significant loss. Raising young kids. These shape the backdrop against which everything else happens and don't change quickly.
  - **Seasons** — the medium-term periods within those chapters, weeks to months long. A focused sprint. A recovery stretch. A window of uncertainty. A period of exploration. These are what the system actively tracks and responds to.
  - *(Daily modes — the micro level — are already handled by the Life Scenes system.)*
- **How seasons surface — through conversation, not configuration.** Every few weeks Claude checks in with a simple, open question: "How would you describe where you are right now?" You answer in whatever language feels true. Claude helps you articulate it if you're not sure, reflects back what it's been observing in your data, and you arrive at a shared understanding together. No dropdown, no forced category.
- **Claude notices before you do.** Beyond the periodic check-in, Claude watches for patterns that suggest a season is shifting: energy levels dropping across multiple weeks, workouts being skipped, journal tone changing, a widening gap between what you planned and what actually happened. When patterns accumulate, Claude surfaces them gently — "I've been noticing some things over the last few weeks. It feels less like a Push period and more like something that might need a different gear. Does that land?" You confirm, correct, or reframe. The observation comes from the data; the meaning comes from the conversation.
- **The value isn't the label — it's the permission.** Naming a recovery season gives you permission to not push hard without feeling like you're failing. Naming a transition season gives you permission to hold your goals loosely. Without the name, most people keep running their Push-season playbook through a period that's calling for something completely different — and then wonder why everything feels off. The naming makes the implicit explicit so you can actually respond to where you are rather than where you think you should be.
- **How the app adjusts once a season is recognized:**
  - Morning briefing tone and emphasis shifts to match what the season calls for
  - Weekly review framing changes — what counts as a good week in a Recovery season looks nothing like a good week in a Push season
  - Notification pressure and accountability intensity adjust accordingly
  - Claude's proactive check-ins shift in frequency, depth, and what they're watching for
  - The "What Actually Matters" signal is recalibrated to the season's reality
- **Season transitions and archives** — when a season closes, Claude runs a short reflection: what did this period produce, what did you learn, what does the next season seem to be calling for? Seasons are archived chronologically as a timeline of your life's chapters — something genuinely worth looking back on over years.

### Longitudinal Memory & Pattern Recognition ✅ Complete
- **Advisors know your history. Claude should too.** Right now each week is relatively fresh context. This builds a living "life context" document that accumulates what Claude has learned about you over months and years — distinct from the PARA vault (which is your knowledge) and the Constitution (which is your values). This is Claude's understanding of *your patterns*.
- **What accumulates:**
  - Recurring themes in your journal entries over time
  - What tends to precede your best weeks vs. your worst
  - Commitments you've made and whether you kept them
  - What reliably derails you (specific triggers, seasons, circumstances)
  - What reliably unlocks you
  - Health correlations that have proven stable (e.g., sleep below 6.5 hours → mood drops next day, every time)
  - Patterns in how you respond to stress, setbacks, windfalls
- **Stored as** `users/{uid}/life_context` — a Claude-maintained document updated weekly after the AI review runs. Claude reads it at the start of each chat session alongside the Constitution.
- **Gets richer every month.** At year three, Claude knows things about you that you've probably forgotten about yourself. This is the compounding asset of the entire system — the thing that makes the advisor relationship genuinely irreplaceable over time.
- **Privacy architecture** — life context document is never used for anything other than your own chat context. No training, no external access. Worth calling out explicitly in the UI.

### "What Actually Matters" Signal ✅ Complete
- **One honest read, above all the noise.** The risk of a comprehensive life OS is that signal drowns in data. This feature cuts through everything and surfaces one plain-language synthesis at the top of the dashboard and as the opening of every morning briefing.
- **Not a metric. Not a widget. A sentence or two from Claude** — synthesized from your Constitution, your current Season, your recent patterns, and whatever's most urgent across all your systems: "This week, the thing that deserves most of your attention is [X]. Here's why given everything I know about where you are right now." Everything else is detail you can drill into if you want it.
- **Changes daily based on real context** — not a rotating tip or a fixed goal reminder. Claude looks across all of it and makes a genuine call. Some days it's about a relationship that's been neglected. Some days it's about an approaching deadline. Some days it's about the fact that your health metrics have been declining for three weeks and you keep deprioritizing it.
- **The metric is whether it's right.** Over time you should find yourself reading it and thinking "yes, that's the thing." If it's consistently off, the Constitution and longitudinal memory need refinement — which is itself useful feedback.

### System Integrity & Subtraction ✅ Complete
- **Every system needs a way to simplify itself or it becomes overhead.** As the app grows, this mechanic prevents it from collapsing under its own weight.
- **Quarterly system audit** — Claude reviews which features, trackers, and habits you've actually engaged with in the past 90 days. Surfaces what's become noise. Asks: "You haven't logged [X] in 11 weeks — is this still serving you?" One-tap to archive, pause, or retire any tracker or feature.
- **"Off the record" mode** — a chat mode where nothing is logged, no tools are called, no data is captured. Just a conversation. Some of the most important thinking happens when you're not being measured. The app should have space for that.
- **Complexity budget** — a design philosophy, not a feature: before anything new is added to the active UI, something should be evaluated for archival. The goal is depth and signal, not comprehensiveness.
- **Humanity protection** — designated untracked time (Sabbath, family time, whatever you define) that the app doesn't fill with nudges, notifications, or prompts. The best parts of life don't count toward anything.

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

### Finance
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

- **OpenAI Realtime API** *(3–5 days, depends on TTS first)* — Replace the Web Speech API → text → Claude pipeline with a true bidirectional audio WebSocket. Enables sub-300ms response latency, natural interruptions, and VAD (voice activity detection — no button needed, just talk). Requires: ephemeral session token endpoint at `/api/realtime/session`; `AudioWorklet` for PCM16 audio capture; streaming audio playback; `/api/tools/execute` endpoint so the browser can fire Firestore-writing tools server-side; extract `lib/chat-tools.ts` and `lib/tool-executor.ts` from the monolithic `/api/chat/route.ts` to share tools across routes. Note: voice sessions run on GPT-4o (OpenAI); text chat stays on Claude. See `docs/REALTIME_API.md`.
- **Real-time translation mode** *(1 day, depends on Realtime API)* — Travel interpreter that runs inside the Realtime API session with a different system prompt. Two modes: one-way (you speak English → target language comes out) and two-way (full conversation interpreter). Supports 16 languages with quality ratings. Language picker UI, accessible as a tab in the voice panel or via `/translate [language]` skill command. Personal OS context stays available in translation mode (health profile for allergy situations, budget data, etc.). See `docs/TRANSLATION_MODE.md`.

### Agent Skills System
See [`docs/AGENT_SKILLS.md`](./docs/AGENT_SKILLS.md) for full implementation details.

- **User-defined custom skills** *(~half day)* — Create, edit, and delete personal skills from within the app without deploying. Skills stored at `users/{uid}/custom_skills` in Firestore; `useSkills` hook merges them with the builtin set. Form fields: command name, emoji icon, description, system prompt addition, opening prompt. Optional: Claude-assisted skill writing ("describe what you want, Claude writes the prompt"). **Token consideration:** every skill activation prepends its system prompt block to the base prompt for the entire session — a verbose custom skill meaningfully increases per-turn token cost. Worth profiling token usage before enabling freeform user prompts here.

### Ambient Capture
See [`docs/TRANSCRIPT_INGESTION.md`](./docs/TRANSCRIPT_INGESTION.md) and [`docs/MEETING_INGESTION.md`](./docs/MEETING_INGESTION.md) for full implementation details.

- **Transcript ingestion endpoint** ✅ *Shipped — see "Ambient Capture / Transcript Ingestion" under ✅ Complete above.* Remaining v1 limitation: writes structured JSON directly to Firestore rather than firing the full chat tool set (no supplements/savings-goal routing yet, no OAuth-dependent tools).
- **Meeting bot integration — Recall.ai** *(1 week)* — A bot joins any Zoom, Google Meet, or Teams call via a link. Audio is transcribed by AssemblyAI and sent to a webhook when the meeting ends. Webhook processes the transcript through the ingestion pipeline and files action items → Tasks, decisions → Decisions, people mentions → People CRM, etc. UI: "Send bot to meeting" panel with meeting URL input and context selector. Push notification when notes are ready. See `docs/MEETING_INGESTION.md`.
- **Phone call integration — Twilio** *(3–4 days, after meeting bot)* — A Twilio number bridges phone call audio to the OpenAI Realtime API in real time. The agent listens, transcribes, and files the results when the call ends. Can also be conferenced into any existing call. Simplest alternative: record via Twilio + post-call transcription processing without real-time agent. See `docs/MEETING_INGESTION.md`.

### Weather

- **Severe weather push alerts** *(~1 day)* — Push notifications for freeze warnings, storm alerts, and extreme UV days via OpenWeatherMap alerts API. Requires `OPENWEATHERMAP_API_KEY`. Current Open-Meteo integration has no alert endpoint.

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

### Spaced Repetition / Active Recall
- **SRS review queue** — Surface your own captured content on a spaced repetition schedule: book highlights from the reading list, Second Brain notes, journal insights, and scripture memory (ties into Faith section below). Each card shows the original capture with context (source, date, your note). A simple "remembered / fuzzy / forgotten" response adjusts the next review interval. Goal: close the loop between capture and actual internalization. Dashboard widget shows cards due today; `/review` page for full sessions. Chat tool: `get_review_cards`. Integration point: reading list highlights are the first data source to wire in since the capture infrastructure already exists.

### Financial Independence / FIRE Tracker
- **FIRE number & projection** — Calculate your FI number (25× annual expenses, derived from Plaid transaction history and budget data already in Firestore). Track current net worth progress toward that number as a percentage. Project time-to-FI under different savings rate and return assumptions with an interactive slider. Dashboard widget shows FI % and projected date. Dedicated `/fire` tab on the Finance page alongside Budget and Net Worth. Inputs are almost entirely already available (net worth snapshots, Plaid transactions, budget categories) — this is mostly a calculation and visualization layer. Chat tools: `get_fire_projection`, `update_fire_assumptions`.

### Deliberate Practice / Skill Development
- **Practice log** — Track skill-building sessions that don't fit the workout model: instruments, languages, writing, coding, public speaking, anything requiring deliberate reps. Each session logs the skill, duration, what was worked on, and a self-rated quality score (1–5). Progress charts show weekly practice hours per skill and cumulative hours (toward the "10,000 hours" framing). Milestones fire achievement-style notifications (e.g., 100 hours logged). Pairs naturally with the D&D character sheet stat system — practice sessions can increment relevant stats (music → CHA/DEX, language → INT, etc.). Dedicated `/practice` page or tab on an expanded `/skills` page. Dashboard widget shows current skill streaks. Chat tools: `log_practice_session`, `get_practice_stats`.

### Faith / Spiritual Life
- **Full spiritual OS layer** — The Bible verse widget is a foundation; this expands it into a first-class domain:
  - **Scripture memory** — SRS-based verse memorization (feeds directly into the Spaced Repetition system above); add verses manually or from the verse-of-the-day; track memorized count and current review queue
  - **Prayer journal** — Structured prayer log with categories (thanksgiving, intercession, confession, requests); mark requests as answered with a date; answered prayer history is one of the most encouraging things to look back on
  - **Sermon / teaching notes** — Capture notes from sermons, podcasts, books with date, source, and key takeaways; searchable; feeds into Second Brain
  - **Church attendance tracker** — Simple log; can surface in the weekly AI review
  - **Tithing tracker** — Giving log tied into Finance; track giving as a % of income; separate from budget categories so it gets its own visibility
  - **Spiritual disciplines tracker** — Treat Bible reading, prayer, fasting, etc. as a distinct habit category with its own streak logic and dashboard widget

### Home & Vehicle Maintenance
- **Maintenance OS** — The most universally neglected life admin category; simple data model with high return on investment:
  - **Home items** — HVAC filter, water heater flush, smoke detector batteries, pest control, roof inspection, gutters, appliance warranties; each item has a last-service date, interval, and next-due date
  - **Vehicle items** — Oil changes, tire rotation, registration renewal, insurance renewal, inspection; supports multiple vehicles
  - **Warranty vault** — Store purchase date, warranty length, and retailer for appliances and electronics; push notification before warranty expires
  - **Contractor / vendor log** — Who did what work, when, what it cost; ties into People CRM for recurring vendors
  - Push notifications fire like habit reminders when maintenance is due. Dashboard widget shows items due in the next 30 days. Dedicated `/home` page. Chat tools: `log_maintenance`, `get_upcoming_maintenance`.

### Sleep Optimization
- **Sleep debt & optimization layer** — You already have sleep data flowing in from Google Health; this turns passive logging into active coaching:
  - **Sleep debt tracker** — Running cumulative deficit vs. your target hours; resets as debt is paid down; shown on the Health dashboard
  - **Correlation analysis** — Cross-reference sleep quality scores against same-day and prior-day variables already in Firestore: exercise, alcohol (if tracked in nutrition), caffeine (supplement log), mood, hydration, late screen time (journal mentions); Claude Haiku surfaces the strongest personal correlations monthly
  - **Smart bedtime reminder** — Calculates target bedtime based on tomorrow's earliest calendar event and your target sleep duration; fires a push notification; adjusts dynamically week to week
  - **Sleep quality trend chart** — 30/90-day view of sleep duration, efficiency, and quality on the Health page alongside existing metrics

### Career & Professional Development
- **Professional layer** — Currently the app is deeply personal-life focused; this adds the career dimension:
  - **Skills inventory** — A list of professional skills with self-rated proficiency (1–5) and growth trajectory (improving / maintaining / rusty); used to identify gaps against target role or goals
  - **Learning tracker** — Courses, certifications, books (ties to reading list), conferences; track completion and link to skills inventory
  - **1:1 meeting notes** — Structured notes for recurring 1:1s with manager, reports, or mentors; action items auto-flow to Tasks; searchable history
  - **Performance review prep** — Running log of wins, impact, and growth moments throughout the year so review season isn't a scramble; Claude can draft a self-review from the log
  - **Job / opportunity tracker** — If ever in job search mode: pipeline of roles, application status, interview notes, contacts at each company (ties to People CRM)
  - **Networking follow-through** — Flag contacts in People CRM as "professional" and surface follow-up nudges for dormant relationships that matter career-wise

### Event & Life Moments Planning
- **Life events planner** — For the handful of significant events each year (trips, parties, weddings, moves, big purchases) that need coordinated tasks, budget, and people:
  - Each event has a name, date, description, and type (trip / celebration / milestone / project)
  - Sub-tasks with due dates flow into the main Task system tagged to the event
  - A dedicated budget envelope tracks event spending separate from monthly budget categories (ties into Finance)
  - Guest / participant list pulls from People CRM
  - Packing list template for trips (reusable, editable per trip)
  - Post-event: Claude generates a summary and prompts for a journal entry
  - Dashboard widget shows upcoming events in the next 90 days. Dedicated `/events` page. Chat tools: `create_event_plan`, `get_event_tasks`, `log_event_expense`.

### Deeper Social Graph
- **Relationship map & network intelligence** — Extends the People CRM from a flat contact list into a true social graph:
  - **Visual relationship map** — Force-directed graph showing contacts grouped by context (family, work, church, college, etc.) with edge weight based on interaction frequency; built with D3.js; gives you a feel for where your relational energy is actually going
  - **Introducer tracking** — Record who introduced you to whom; useful for gratitude, reciprocity, and understanding how your network is connected
  - **Relationship strength score** — More nuanced than the current "needs attention" flag: a composite of recency, frequency, and depth of interactions; shown as a score and trend on each contact card
  - **Network gap analysis** — Claude identifies domains where your network is thin (e.g., "you have few contacts in finance / healthcare / your target industry") and surfaces warm-path introductions
  - **AI gift suggestions** — Already on the roadmap; fits here as part of the deeper CRM layer

### Life Scenes / Orchestrated Modes
- **Scene system** — A named bundle of tool calls Claude executes in sequence when you say the right thing. Not a new UI paradigm — just the chat's existing tool infrastructure given orchestration capability, a media player control hook, and a thin "active scene" state in Firestore the UI can react to. Built-in scenes to start:
  - **Deep Work** — Start a Pomodoro timer linked to your top-priority task, queue focus music from The Crate (mood-matched or scene-default), suppress non-urgent push notifications for the session duration, simplify the dashboard to a minimal "one thing" view
  - **Workout** — Pull up today's planned workout from the Workout Planner, queue an energizing playlist, start the workout timer
  - **Wind Down** — Soft music, surface tomorrow's top 3 tasks and first calendar event so you can mentally close the day, prompt a one-line journal entry, trigger the bedtime reminder calculation based on tomorrow's schedule
  - **Sleep** — Full DND on all notification categories, queue sleep/ambient audio, log intended sleep time for Google Health correlation
  - **Travel** — Switch dashboard to travel-relevant widget layout (itinerary, weather at destination, packing list progress), surface the active trip from the Events planner
  - **Custom scenes** — User-defined scenes with a name, trigger phrases, and a configurable list of actions; saved to `users/{uid}/scenes`
- **Media player control API** — The key missing hook: a `set_media` tool that accepts a mood label, playlist name, or search query and programmatically queues audio in the player. The Crate tracks are tagged with mood labels (deep focus / energizing / wind-down / ambient / upbeat); Claude selects based on scene + any natural language modifier ("same as usual but more energetic"). Falls back to YouTube search for moods not yet covered in The Crate.
- **Scene learning** — Claude passively notes which music + scene combinations correlate with your most productive/complete sessions (based on tasks finished, focus timer completion rate) and starts pre-suggesting them. Long-term: "You tend to focus best with lo-fi + morning blocks — want to set that as your Deep Work default?"
- **Trigger phrases** — Scenes activate via natural language in chat or voice: "I'm going into focus mode", "time to wind down", "heading to the gym", "I'm done for the day". Multiple phrases per scene. Active scene shown as a badge in the nav; `/end` or "I'm done" exits the scene and optionally fires a debrief (how many tasks completed, time logged, etc.).

### Travel
- **Travel page (`/travel`)** — A dedicated space for trip planning and active travel, pulling together data from existing systems that currently have no unified view:
  - **Trip dashboard** — Active trip shown prominently with destination, dates, countdown, and weather at destination (via the Weather integration); past trips archived and browsable
  - **Itinerary builder** — Day-by-day schedule with time blocks, locations, confirmation numbers, and notes; importable from copied text (Claude parses an email confirmation or booking into structured itinerary entries)
  - **Packing list** — Reusable templates by trip type (weekend, international, camping, business); checklist UI with check-off on departure; custom items per trip
  - **Trip budget** — Dedicated budget envelope per trip (ties into Finance); log expenses by category (flights, hotels, food, activities) with running total vs. budget; Plaid transactions auto-tagged to active trip by date + location when possible
  - **People on the trip** — Tag contacts from People CRM as traveling together; surfaces their info (dietary restrictions, preferences from CRM notes) in the travel context
  - **Documents & confirmations** — Store flight confirmation codes, hotel bookings, rental car info, travel insurance policy numbers; accessible offline via PWA
  - **Post-trip debrief** — Claude generates a trip summary from itinerary + expenses + any journal entries logged during the trip; prompts for highlights and what to remember; saves to Second Brain

- **Travel Agent skill (`/travel` slash command)** — A focused Claude mode that activates when planning or during a trip:
  - On activation: auto-pulls the active or most recent upcoming trip, weather forecast at destination, trip budget status, and any open packing list items
  - **Planning mode** — Help research destinations, build itineraries, estimate budgets, suggest activities based on your preferences (logged in memory) and travel companions from People CRM; can search the web via Tavily for current recommendations, hours, prices
  - **Active trip mode** — "What should I do near me?", "find somewhere to eat that fits my diet", "what's the weather tomorrow?", "I spent $47 on dinner" (logs to trip budget); context-aware because the agent knows your location, itinerary, budget remaining, and dietary preferences
  - **Packing assistant** — "Am I ready to pack?" runs through the checklist and surfaces missing items; "what should I pack for 5 days in Tokyo in October?" generates a context-aware list
  - **Post-trip** — Triggers the debrief flow, suggests People CRM updates for anyone met on the trip, flags any expenses that haven't been logged yet

### Expanded Agent Control (Settings, Reminders & Full App Config)
- **Goal: zero things that require navigating the UI when the agent can do it faster.** The chat already covers 30+ tools across tasks, health, finance, habits, and more. This pass closes the remaining gaps — primarily settings, notification configuration, and any system state that currently requires a UI visit:
  - **Settings tools** — `update_setting` covering: notification preferences (per-category enable/disable/time), home timezone, home location (for weather), theme/appearance, dashboard widget order and visibility, default views. "Turn off my mid-day progress reminders" or "set my morning briefing to 7am" should just work.
  - **Notification management** — Full CRUD on all 15 notification categories via chat. Also: "snooze all notifications until Monday", "pause habit reminders this week", "what notifications do I have enabled?" — a conversational interface over the existing NotificationSettings Firestore doc.
  - **One-off reminders** *(already noted under AI/Automation — formalized here)* — "Remind me to call Dr. Smith next Thursday at 10am", "ping me in 2 hours about the contract", "remind me every Monday morning to log my weight". Stored separately from recurring tasks; fire once via the notification cron; Claude confirms with the exact time it will fire.
  - **Integration management** — "Is my Google Health connected?", "disconnect Plaid", "when did I last sync Google Contacts?" — status and control over OAuth integrations without touching Settings UI.
  - **Dashboard control** — "Add the habit tracker widget to my dashboard", "move finance summary to the top", "hide the mood widget". Agent calls the same `useDashboardSettings` hook logic via a tool rather than requiring the Customizer panel.
  - **Voice-first parity** — Every one of these tools must work via voice input through the Web Speech API (and later the Realtime API). The test: a user should be able to configure their entire app without ever touching the screen. This is the long-term north star for agent control — the UI is for browsing and glancing, the agent is for doing.

### Accountability & Commitment Contracts
- **Commitment system** — A different motivational layer than XP and streaks; based on declared intent and outcome logging:
  - **Commitment contracts** — Write a formal commitment: what you will do, by when, and what's at stake if you don't (even if just personal acknowledgment); stored with a deadline and linked to a goal or task
  - **Check-in prompts** — Claude proactively asks about open commitments at the deadline; you log kept / broken / extended with a reason
  - **Commitment history** — A track record of kept vs. broken commitments over time; shown as a ratio; intentionally visible because the pattern matters more than any individual commitment
  - **Accountability partner mode** — Optional: designate a contact from People CRM as an accountability partner for specific commitments; system can draft a check-in message to send them (you send it manually)
  - **Ties into existing systems** — Commitments can reference goals, tasks, habits, or financial targets; completion of the linked item auto-resolves the commitment

### Family Health History & Mitigation Planning
- **The most meaningful health feature yet** — Family history is one of the strongest predictors of health outcomes, and almost no consumer app treats it seriously. The goal: log your family health tree, let Claude identify elevated risk categories, and generate mitigation plans that actively wire into the rest of the app rather than sitting as static notes.
- **Family health tree** — Structured data entry for first and second-degree relatives (parents, grandparents, siblings, aunts/uncles, children). Each entry captures: relationship, conditions diagnosed, age of onset, cause of death if applicable. A visual tree layout at `/health/family`. Claude uses this data — not as a one-time analysis but as living context that updates every mitigation plan whenever new history is added.
- **Personal medical history** — Complements the family tree with your own record: diagnoses, surgeries, hospitalizations, known allergies, chronic conditions, current prescriptions. Separate from the supplement log (which tracks what you're taking proactively) — this is your clinical history. Stored in `users/{uid}/medical_history`.
- **Risk assessment** — Claude analyzes the family tree and personal history to surface elevated risk categories with plain-language explanations of why. Example output: "Based on your father and paternal grandfather both having heart disease before 60, you have a significantly elevated cardiovascular risk. Your family history of colon cancer on your mother's side elevates your colorectal risk above average. Here's what the evidence suggests for each." Risk categories map to established medical frameworks (AHA, ACS, USPSTF guidelines) — always framed as informational, not medical advice.
- **Mitigation plans** — Per-risk action plans that don't just sit as text but actively connect to the rest of the app:
  - *Cardiovascular risk* → cardio exercise targets wired into Workout Planner, Mediterranean-style dietary goals in Nutrition Tracker, blood pressure and lipid panel tracking in Lab Results, stress management in Habits, regular check-in prompts
  - *Colon cancer risk* → high-fiber dietary targets, earlier colonoscopy recommendation in Screening Calendar, red/processed meat limits in Nutrition, hydration goals in Hydration Tracker
  - *Diverticulosis risk* → high-fiber and hydration targets (merged intelligently with colon cancer plan to avoid duplicate recommendations), specific foods to limit, exercise targets
  - Plans auto-merge when risk factors share interventions — you get one unified dietary recommendation, not three competing lists
  - Each plan action links to the relevant app section so you can act immediately
- **Screening calendar** — The highest-value output: a personalized schedule of recommended health screenings based on your age, sex, and risk factors, integrated with Google Calendar. Fires push notifications at the right life moments: "You're turning 40 this year — given your family history of colon cancer, your doctor may recommend a colonoscopy earlier than the standard 45. Here are questions to ask at your next appointment." Screening types: colonoscopy, lipid panel, blood pressure, blood glucose, skin check, eye exam, dental, prostate (PSA), cardiac stress test, and others driven by specific risk factors. Follows USPSTF and major medical society guidelines by default.
- **Lab results tracker** — Store and trend actual clinical data over time: lipid panel (total cholesterol, LDL, HDL, triglycerides), blood glucose / A1C, vitamin D, B12, ferritin, thyroid (TSH), blood pressure, resting heart rate (also from Google Health). Manual entry with date; Claude flags meaningful changes between readings ("Your LDL increased 22 points since your last panel — worth discussing with your doctor") and correlates trends with lifestyle data already in the app (sleep, exercise, diet). Results feed back into risk assessments and mitigation plans dynamically.
- **Doctor visit prep** — Before any appointment flagged as medical in Google Calendar, Claude surfaces: relevant family history for that specialty, current medications and supplements, recent lab results and trends, open questions from the mitigation plan, and a suggested list of things to discuss. You walk in prepared instead of forgetting half of what you wanted to ask.
- **Always-on framing** — Every feature in this section is explicitly "informational, based on published guidelines — not a substitute for medical advice." Claude consistently encourages regular consultations with healthcare providers and frames all mitigation plans as conversation starters, not prescriptions.

### Energy Level Tracker
- **Separate from mood** — Mood is emotional tone; energy is physical and cognitive readiness to perform. A quick 1–5 check-in available at any time (dashboard widget, chat tool, voice), with an optional note ("crashed after lunch", "great after the workout"). Stored as `users/{uid}/energy/{timestamp}` with time-of-day metadata so intra-day patterns are visible.
- **Correlation engine** — After 30+ days of data, Claude Haiku surfaces personal energy patterns: what time of day you peak, how sleep quality the night before affects your morning energy, whether workouts boost or drain your afternoon, caffeine timing effects, nutrition correlations. The goal is actionable insight: "Your energy on days you work out before noon averages 0.8 points higher in the afternoon than days you don't." Feeds into the weekly AI review and Proactive AI Insights.
- **Scene integration** — Active energy level informs scene suggestions. Low energy at 2pm? Claude might suggest a short walk before starting a focus session rather than jumping straight into Deep Work mode.
- **Dashboard widget** — Simple current energy log + 7-day sparkline. Chat tool: `log_energy`.

### Personal Annual Report ("Life Wrapped")
- **Year-in-review generated from real data** — All the inputs already exist; this is a presentation and narrative layer. Runs on January 1st via cron (and manually triggerable any time). Claude Sonnet synthesizes a full year of activity across every domain into a structured report:
  - Tasks completed, projects shipped, habits maintained and streaks hit
  - Books read, highlights captured, content published
  - Workouts logged, PRs set, miles tracked, health trends
  - Goals achieved and missed with honest reflection
  - Financial progress: net worth change, savings rate, budget performance
  - Relationships: interactions logged, new people met, birthdays remembered
  - Journal entries written, moods trended, decisions made and reviewed
  - XP earned, level reached, achievements unlocked, Gamerscore total
  - Words: most-used themes from journal entries and Second Brain captures (Claude identifies them)
  - One-sentence "year in a sentence" generated by Claude from all of the above
- **Rendered as a shareable page** — Beautiful, data-rich layout at `/annual-report/{year}`; can be exported as PDF. Styled differently from the rest of the app — this is a keepsake. Previous years archived and browsable.
- **Reflection prompts** — Alongside the stats, Claude asks 5 questions you answer in the app: what surprised you most, what do you want more of, what do you want less of, who mattered most, one word for the year. Answers stored and included in the report.

### Tax Preparation Assistant
- **Year-round deduction tracking** — With Plaid transactions flowing, the raw data is already there. A tax layer that lets you flag expense categories as potentially deductible: home office, business meals, professional development, charitable giving, medical expenses, vehicle mileage (manual log), investment losses. Each flagged category stores the relevant IRS rule reference so you understand why it might be deductible.
- **Deduction dashboard** — Running YTD total of potentially deductible expenses by category on a `/tax` page. Updates automatically as Plaid syncs new transactions. Manual override to include/exclude specific transactions.
- **Year-end summary** — Generates a clean export (PDF or CSV) of all flagged deductions organized by IRS schedule (Schedule A, Schedule C, etc.) for your accountant or TurboTax import. Includes totals, transaction-level detail, and any notes you've added.
- **Giving summary** — Integrates with the tithing/giving tracker from the Faith layer and People CRM gift log; produces a complete charitable giving statement.
- **Estimated taxes nudge** — If you have freelance or side income logged, Claude estimates quarterly tax liability and fires a reminder before estimated tax due dates (April 15, June 15, September 15, January 15).

### Investment Portfolio Tracker
- **Beyond net worth snapshots** — Track individual holdings: brokerage accounts, retirement accounts (401k, IRA, Roth), individual stocks, ETFs, real estate equity, crypto. Manual entry with ticker symbol, shares, cost basis, and account. Plaid's investment products can automate this for supported brokerages long-term.
- **Allocation view** — Pie chart of asset allocation (stocks/bonds/cash/real estate/other) and geographic/sector breakdown for equity holdings. Target allocation you define; deviation from target triggers a rebalancing nudge.
- **Performance tracking** — Portfolio value over time charted alongside net worth. Cost basis vs. current value per holding. Unrealized gain/loss. Simple IRR calculation for overall portfolio.
- **Rebalancing assistant** — When allocation drifts more than a defined threshold from your target, Claude flags it and calculates the buys/sells needed to rebalance. Never executes trades — always "here's what you'd need to do; take it to your brokerage."
- **Dividend & income log** — Track dividend payments and interest income; feeds into the tax layer.

### Ideas Vault
- **Friction-free idea capture** — A dedicated collection point for raw, unprocessed ideas before they're ready to become tasks, projects, or Second Brain notes. Product ideas, business concepts, creative sparks, things to investigate, observations. The key is zero friction: one tap from dashboard, voice input, browser extension quick-capture, share target.
- **Weekly triage** — Every Monday, Claude surfaces 5–10 ideas from the vault and helps you decide: develop now (→ task or project), park (back to vault with a tag), or discard. Ideas have a "last reviewed" date; ones that survive multiple triage sessions without being acted on get a gentle nudge to either commit or delete.
- **Tagging & search** — Tag ideas by domain (business, creative, health, tech, personal) with full-text search. Claude can cluster related ideas and surface connections you didn't notice.
- **Idea-to-project pipeline** — One tap to promote an idea to a Project in the Kanban board, pre-populating the project description from the idea note.
- **Chat tool** — `capture_idea` so you can say "add an idea: what if I..." in the middle of anything and it lands in the vault without breaking your flow.

### Meeting Prep Assistant
- **Proactive context surface** — 15–30 minutes before any Google Calendar event, Claude automatically assembles a briefing card:
  - Attendees pulled from People CRM with relevant context (last interaction, what you're working on together, any notes, upcoming birthday)
  - Open tasks tagged to this person or project
  - Previous meeting notes if the event title suggests it's recurring
  - Relevant files from Google Drive (matched by event title + attendee names)
  - Any decisions from the Decision Journal related to this topic
- **Delivered as a push notification** with a tap-to-expand briefing, or surfaced as a dashboard card that appears before the meeting and disappears after.
- **Post-meeting capture** — After the calendar event end time, Claude prompts: "How did your meeting with [person] go? Any action items or notes to capture?" Voice or text input; Claude extracts tasks (→ Task system), decisions (→ Decision Journal), and interaction notes (→ People CRM) automatically.
- **Meeting cost awareness** — Optional: log attendee count and estimated average salary; Claude calculates the cost of the meeting in real time and includes it in the briefing as a "this meeting costs ~$X/hour" framing.

### Personal OKRs
- **Quarterly cadence, separate from Goals** — OKRs operate at a higher altitude: Objectives are directional and qualitative ("Become the healthiest version of myself"), Key Results are measurable and binary at quarter-end ("Complete 48 workouts", "Average 7.5 hours of sleep", "Lose 8 lbs"). Structurally different from the current Goals system which is more project-like.
- **Planning ritual** — At the start of each quarter, Claude runs a guided OKR-setting session: reviews last quarter's performance, asks what matters most this quarter, helps draft 2–3 Objectives with 2–4 Key Results each. Pulls relevant data from across the app to ground the conversation in reality ("Last quarter you averaged 3.2 workouts/week — is 4/week achievable?").
- **Progress tracking** — Key Results auto-update where possible by linking to existing data sources (workout count from Workout Planner, sleep average from Google Health, etc.). Manual check-in for KRs that can't be automated.
- **Quarterly review** — End-of-quarter Claude review scores each KR (0–1.0, Google-style), identifies what drove hits and misses, and feeds learnings into the next quarter's planning session. Integrates with the weekly AI review in the final week of each quarter.
- **Alignment with Goals and habits** — OKRs sit above Goals in the hierarchy; Claude can suggest which existing goals and habits ladder up to each Objective, giving your day-to-day activity a clearer line of sight to what actually matters this quarter.

### SOPs & Personal Runbooks
- **Document how you do things so Claude can replicate them** — The infrastructure that makes the agent feel truly personal over time. An SOP is a named, step-by-step workflow you've defined: your morning routine, how you process email, your weekly review process, how you meal plan, how you close out a workday. Once documented, you can trigger any SOP by name and Claude walks through it with you — or executes the automatable steps automatically.
- **SOP builder** — Create an SOP with a name, trigger phrase, and ordered list of steps. Each step can be: a question Claude asks you, an action Claude takes (tool call), a reminder, or a navigation prompt ("open the habit tracker"). Steps can be conditional ("if you haven't logged weight this week, do that first").
- **SOP library** — Starter templates for common personal OS workflows: Morning Startup, Weekly Review, Monthly Finance Review, End of Day Shutdown, Quarterly OKR Review. User can edit, extend, or build from scratch.
- **Compounds over time** — Every time you find yourself doing the same sequence of things, that's an SOP candidate. The library grows as your workflows mature, and the agent becomes increasingly capable of running your life's operating system rather than just answering questions about it.
- **Accessible via chat** — "Run my morning routine", "let's do my weekly review", "start end-of-day shutdown". Active SOP shown as a badge in the nav with step progress.

### Day-End Micro-Review
- **2-minute daily close** — Lighter than the full journal; heavier than nothing. Three fixed questions at the end of each day: (1) What got done today? (2) What didn't, and why? (3) One thing to carry into tomorrow. Voice or text. Takes under 2 minutes.
- **Feeds the weekly AI review** — Currently the weekly review infers how the week went from activity data (tasks completed, habits logged, etc.). Day-end micro-reviews give it your *subjective* read on each day, making the weekly synthesis dramatically richer.
- **Wind-down scene integration** — Day-end review is a natural step in the Wind Down scene; can be triggered automatically as part of that flow.
- **Prompted by push notification** — A configurable "end of day" notification (default 9pm) that fires if you haven't completed that day's review. Silenced automatically once you do.
- **Streak & gamification** — Daily review streak tracked separately from the full journal streak; lighter commitment, easier to maintain, still awards XP.

### Debt Payoff Planner
- **Avalanche & snowball calculators** — Enter your debts (name, balance, interest rate, minimum payment, type). Avalanche method orders by highest interest rate; snowball by lowest balance. Claude calculates: payoff date, total interest paid, and the impact of any extra monthly payment you can throw at it.
- **Live progress tracking** — Update balances as you pay down; payoff date recalculates automatically. Milestone notifications at 25/50/75/100% of each debt paid off (same pattern as savings goals). Dashboard widget shows total debt, monthly payment, and projected payoff.
- **Plaid integration** — Where Plaid has visibility into credit card and loan balances, balances can auto-update on sync rather than requiring manual entry.
- **Payoff impact calculator** — "What if I put an extra $200/month toward my debt?" → Claude shows the new payoff date and interest saved. Motivating and concrete.
- **Debt-free milestone** — When total debt hits $0, a major achievement unlocks and the weekly AI review surfaces it as a featured win.

---

## 💡 Ideas / Parking Lot
- Beeper Desktop API — MCP server covering WhatsApp, iMessage, Telegram, etc. Local-only, better as a Claude Desktop add-on
- Net Worth snapshot carry-forward — when logging a new month, pre-populate from the previous month's entries as a starting point
