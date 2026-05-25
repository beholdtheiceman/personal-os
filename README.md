# Personal OS

A personal AI-powered life dashboard built with Next.js 15, Firebase, and Claude AI. Tasks, habits, health, finance, relationships, and more — all in one place, with a conversational AI assistant that has full context of your life.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack), TypeScript
- **Auth & Database:** Firebase Auth (Google SSO), Firestore
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-5`)
- **Web Search:** Tavily API
- **File Storage:** Vercel Blob (audio files)
- **Styling:** Tailwind CSS, custom dark glass UI
- **Background:** Pixel art cherry blossom parallax (4-layer scroll)
- **Deployment:** Vercel (cron jobs via `vercel.json`)

---

## Features

### 🤖 AI Chat Assistant
- Persistent slide-in panel (400px desktop, full-screen mobile) on every page — no tab switching
- Full `/chat` page also available
- 30+ tools: full CRUD across tasks, calendar, habits, nutrition, health, journal, goals, finance, projects, memory, meal planner, people CRM, Drive, workouts, time tracker, focus timer, decisions, savings goals, supplements, content tracker, reading list, hydration, mood, body metrics, quick links, web search
- Second Brain integration — PARA vault auto-injected into chat context
- Voice input via Web Speech API (browser-native, no Whisper)
- Image attachment support
- Auto-named conversations
- Web search via Tavily with prompt injection defense

### ✅ Tasks
- Priority scoring, tags, due dates
- **Recurring tasks** — daily/weekly/monthly cadence, auto-spawns next instance on completion
- XP on completion
- Chat tools: create, update, complete, delete, list

### 🔄 Habits
- Daily/weekly habit tracking with streak counting
- 16-week GitHub-style heatmap, current streak, longest streak, 30-day rate
- Per-habit push notification reminders (multiple times per day)
- Streak bonus XP
- Chat tools: log, list, create habits

### 📅 Calendar
- Google Calendar OAuth integration
- View upcoming events on dashboard and calendar page
- Create/update/delete events via chat ("schedule a meeting tomorrow at 2pm")

### 📧 Gmail
- OAuth inbox with unread indicators, email detail, reply, archive, trash, mark read/unread
- Dashboard inbox preview widget
- Chat tools: search, read, reply, archive

### 🤖 Email Agent
- Daily cron scanner — classifies receipts and subscriptions using Claude Haiku
- Auto-writes transactions to Finance and subscriptions to Subscription tracker
- Inbox analysis with unsubscribe suggestions
- Manual trigger from dashboard widget
- Dedup logic prevents double-writes

### 🍽️ Meal Planner
- Weekly meal grid (Mon–Sun × Breakfast/Lunch/Dinner/Snack)
- Recipe library with ingredients, macros, tags
- Shopping list auto-generated from planned meals; check off items inline
- **Grocery Price Checker** — "Price Check" button on shopping list; Claude + Tavily agentic search; side-by-side comparison of up to 2 stores; per-item prices shown inline with store total
- Save shopping list to Google Drive (.docx) or download locally
- Chat tools: add recipes, plan meals, generate/read shopping list

### 👥 People / Relationships CRM
- Contact management: name, relationship, email, phone, birthday, company, location, gift ideas
- Interaction logging (call, text, email, in-person, social)
- Contact frequency targets with "Needs attention" dashboard section
- Follow-up dates and notes
- Google Contacts one-click import (OAuth, People API)
- Weekly auto-sync cron
- Chat tools: list contacts, add/update people, log interactions

### ☁️ Google Drive
- OAuth read-only access
- File browser with search across names and content
- Preview Google Docs, Sheets, Slides inline
- Chat tools: `search_drive`, `read_drive_file`

### 💰 Finance
- Income and expense tracking with categories, monthly net summary
- Subscription tracker with renewal dates and monthly cost rollup
- **Budget tracking** — per-category monthly spending limits with progress bars
- **Net Worth dashboard** — assets/liabilities with monthly snapshots and trend chart
- **Plaid integration** — auto-syncs bank/credit card transactions and recurring streams *(Sandbox — Production approval pending)*
- Chat tools: log transactions, set budgets, update net worth, list subscriptions

### 💪 Health
- Daily logging: sleep, energy, exercise, steps, notes
- **Google Health integration** — OAuth sync via Health API v4; sleep (hours/efficiency/stages), daily steps, resting heart rate, exercise sessions from Pixel Watch/Fitbit; auto-prefills log form; 15-min Firestore cache
- **Nightly auto-sync cron** — writes Google Health data automatically if no manual entry exists
- Weekly trend chart
- **Hydration tracking** — daily water intake with goal, quick +1 widget, dashboard indicator
- **Body metrics** — log weight, body fat %, measurements with trend charts
- **Supplement / Medication log** — daily checklist, one-tap "taken" toggle, add/edit modal
- Chat tools: log health, log water, log body metrics, get supplement status

### 🧘 Mood Tracker
- Daily mood check-in (1–10 with optional note)
- Cross-domain data available in AI Insights
- Dashboard widget
- Chat tools: log mood, get mood history

### 🏋️ Workout Planner
- Full workout logging (sets/reps/weight)
- PR tracking per exercise
- Claude-generated training plans
- Workout history with search
- Chat tools: log workout, get PRs, generate training plan

### ⏱️ Time Tracker
- Toggl-style time logging linked to tasks and projects
- Weekly bar chart by category
- Injected into weekly AI review
- Chat tools: start/stop timer, log entry, get summary

### 🍅 Focus / Pomodoro Timer
- Countdown timer linked to tasks
- Auto-logs time on completion
- Persistent MiniFocusBar across all pages
- Break timer
- Chat can start focus sessions

### 🎯 Goals
- Milestone-based goal tracking with progress bars
- AI motivating check-ins on demand
- **Goal inactivity cron** — weekly nudge when active goals haven't had progress in 14+ days
- Chat tools: create goals, toggle milestones, get check-in

### 📁 Projects
- Kanban board (todo / in progress / done)
- Color-tagged projects
- Card management via chat

### 📔 Journal
- Voice or text entries
- AI-generated summaries and mood scoring (1–10)
- Tag system
- XP per entry

### 🧠 Memory & Second Brain
- Persistent AI memory — facts, preferences, context
- PARA vault: upload local Obsidian/markdown folder → auto-injected into chat context
- Capture ideas to vault via chat

### 📖 Reading List / Book Tracker
- Log books with status: want to read / reading / finished / abandoned
- Star rating, highlights capture, takeaways
- Tabbed views with live counts and search
- Chat tools: add book, update status, log highlight, get list

### 🎙️ Content Calendar / Podcast Tracker
- Episode pipeline: idea → outlined → recorded → edited → published
- Kanban view, calendar view, all-episodes search
- Notes, tags, links per episode
- Chat tools: add episode, update status, list episodes

### 📰 News Feed
- RSS and Reddit JSON feeds fetched hourly via Vercel cron; classified by Claude Haiku (relevance 1–10, topic tags)
- `/news` page with category tabs, relevance-sorted list, save-to-reading-list, dismiss, and star articles
- **Star feedback loop** — starring articles tags them; those tags boost Haiku relevance scores on the next refresh cycle
- **Daily AI brief** — Claude Sonnet generates a 4–5 sentence prose summary of top stories each morning; cached in Firestore, shown collapsibly at the top of `/news`
- **Dashboard widget** — displays the brief summary + 3 source links; falls back to top 3 unread articles if no brief exists yet
- Chat tools: `get_news_feed`, `save_article`, `add_news_feed`

### 📊 Proactive AI Insights
- Daily cron uses Claude Opus to analyze 30 days of cross-domain data
- Surfaces correlations across mood, health, hydration, habits, workouts, nutrition, time, body metrics
- Dashboard widget with manual refresh
- Markdown-rendered insight cards with data source tags

### 🎮 XP & Gamification
- 75+ level system with unique titles
- XP for tasks, habits, journal, health logs, goal milestones, hydration goals
- Streak bonuses, level-up toasts

### 🏆 Achievements
- 35 Xbox-style milestone achievements across 9 categories (~740G Gamerscore)
- 3 point tiers: 10G / 25G / 50G
- Unlock sound + toast notification on every unlock
- 3 secret achievements: Night Owl, Early Bird, The Completionist (auto-awarded at 40 unlocks)
- `/achievements` page — full category grid; locked = dimmed + lock icon; secret+locked = `???`
- Dashboard widget showing last 3 unlocks and running Gamerscore
- Wired into: Tasks, Habits, Health, Journal, Chat, Hydration, Workouts

### 🔔 Smart Notifications (14 categories)
All configurable per-category with enable/time controls in Settings:

| Category | Trigger |
|---|---|
| Morning Briefing | Daily summary — calendar, tasks, habits |
| Streak Alert | Habit streak at risk of breaking |
| Task Reminder | Tasks due today / overdue |
| Goal Deadline | Goal target date approaching |
| Journal Reminder | Evening prompt (skipped if already journaled) |
| Health Log Reminder | Skipped if already logged |
| Weekly Review | Sunday summary |
| Birthday Reminders | Contact birthday approaching (configurable days ahead) |
| Savings Milestones | 25/50/75/100% of savings goal target |
| Mid-Day Progress Check | Behind on water, steps, habits, nutrition, workout — silent if on track |
| Evening Progress Check | End-of-day unmet targets only |
| Decision Review | Pending decision reviews due |
| Net Worth Check-In | Monthly reminder on 1st (skipped if already logged) |
| Daily Time Summary | End-of-day hours tracked (fires only if ≥10 min logged) |

### 🎵 Media Player
- YouTube search and IFrame playback
- **The Crate** — personal audio library: upload MP3/M4A/WAV/OGG/FLAC (up to 50MB), stored on Vercel Blob, streamed via audio proxy
- Persistent MiniPlayer bar across all pages
- Background playback persists across navigation

### 🌸 Dashboard
- **Customizable layout** — show/hide and reorder all 20 widgets; persisted to Firestore; "Customize" button opens a slide-in panel with eye toggles and ↑↓ reorder
- Widgets: XP/Level, Quick Links, AI Briefing, AI Insights, Decision Reviews, Birthdays, Bible Verse, Tasks+Habits, Hydration+Mood, Calendar+Nutrition, Health+Journal, Goals+Projects, Finance Summary, Budget+Savings, Weekly Review, API Usage, Email Agent, Unsubscribe Manager, Gmail Inbox, Achievements

### 📱 PWA & Browser Extension
- **PWA** — installable on Android home screen, FCM push notifications, offline-capable service worker
- **Android Share Target** — Personal OS appears in Android share sheet; tap Share on any article/URL → captured to reading list, Second Brain, task, or chat
- **Chrome Extension** — `extension/` folder; load unpacked at `chrome://extensions`; click toolbar button → opens `/share` popup pre-filled with current tab's URL and title; uses existing browser session (no separate auth)

### 📖 Bible
- Verse of the day on dashboard (NLT, free API)
- Full Bible reader with book/chapter navigation
- Daily read logging with streak

### 🔐 Auth & Security
- Firebase Auth (Google SSO only)
- Firebase ID token verification on all `/api/chat` calls; uid spoofing blocked
- Cron routes protected with `CRON_SECRET` bearer token
- Tavily search results treated as untrusted (prompt injection defense)

---

## Project Structure

```
personal-os/
├── app/
│   ├── (pages)/              # App pages (protected by auth layout)
│   │   ├── dashboard/        # Main dashboard
│   │   ├── achievements/     # Full achievements grid + Gamerscore total
│   │   ├── tasks/
│   │   ├── habits/
│   │   ├── health/
│   │   ├── journal/
│   │   ├── nutrition/
│   │   ├── goals/
│   │   ├── projects/
│   │   ├── finance/
│   │   ├── calendar/
│   │   ├── gmail/
│   │   ├── meal-planner/
│   │   ├── people/
│   │   ├── drive/
│   │   ├── workout/
│   │   ├── time/
│   │   ├── focus/
│   │   ├── decisions/
│   │   ├── content/          # Podcast/content calendar
│   │   ├── reading/          # Book tracker
│   │   ├── media/            # YouTube + The Crate
│   │   ├── memory/
│   │   ├── chat/
│   │   ├── settings/
│   │   ├── bible/
│   │   ├── share/            # PWA share target + extension capture page
│   │   └── layout.tsx        # Auth guard + TopNav + MobileNav + MiniPlayer + ChatPanel
│   ├── api/
│   │   ├── chat/             # Main Claude agent with 30+ tools
│   │   ├── notifications/    # daily dispatcher, habits, send
│   │   ├── gmail/            # OAuth, messages, agent, analyze
│   │   ├── calendar/         # OAuth, events
│   │   ├── drive/            # OAuth, files
│   │   ├── health/           # Google Health OAuth, data, auto-sync
│   │   ├── plaid/            # Link token, exchange, sync
│   │   ├── contacts/         # OAuth, sync
│   │   ├── meal-planner/     # Shopping list export, Drive save, price check
│   │   ├── insights/         # AI insights cron
│   │   ├── goals/checkin/    # On-demand AI check-in + inactivity cron
│   │   ├── weekly-review/    # Weekly AI review cron
│   │   ├── daily-briefing/   # Morning briefing cron
│   │   └── bible/            # Verse of the day, passage lookup
│   └── globals.css           # Design tokens (dark glass palette)
├── components/
│   ├── achievements/         # AchievementsWidget (dashboard)
│   ├── chat/                 # ChatInterface, ChatPanel, CameraCapture
│   ├── dashboard/            # All dashboard widgets + DashboardCustomizer
│   ├── habits/               # HabitCard, HabitStats (heatmap), HabitForm
│   ├── health/               # HealthForm, HydrationWidget, MoodWidget, BodyMetricsWidget, SupplementWidget
│   ├── finance/              # FinanceTracker, BudgetTracker, NetWorthTracker, SavingsGoals
│   ├── meal-planner/         # WeeklyPlanner, RecipeLibrary, ShoppingListView
│   ├── people/               # Contacts CRM, person detail, interaction log
│   ├── workout/              # WorkoutLogger, WorkoutHistory, PRBoard, WorkoutPlan
│   ├── focus/                # FocusTimer, MiniFocusBar
│   ├── decisions/            # DecisionCard, DecisionForm, DecisionReview
│   ├── content/              # ContentCalendar, EpisodeCard, EpisodeForm
│   ├── notifications/        # NotificationSettings (14 categories)
│   ├── layout/               # TopNav, MobileNav, ParallaxBackground
│   └── xp/                   # XPWidget, level system
├── hooks/
│   ├── useAchievements       # Real-time unlock listener + Gamerscore totals
│   ├── useDashboardSettings  # Widget order + visibility persistence
│   ├── useMealPlanner        # Recipes, meal plan, shopping list
│   ├── useWorkout            # Workout logs, PRs
│   ├── useTimeTracker        # Time entries
│   ├── useDecisions          # Decision journal
│   ├── useMood               # Mood logs
│   ├── useBodyMetrics        # Body metrics
│   ├── useSavingsGoals       # Savings goals
│   ├── useHydration          # Daily water intake
│   ├── useBudget             # Budget categories
│   ├── useNetWorth           # Net worth snapshots
│   ├── usePodcast            # Podcast episodes
│   ├── useBooks              # Reading list
│   └── ...
├── lib/
│   ├── firebase.ts           # Client SDK
│   ├── firebase-admin.ts     # Admin SDK
│   ├── env.ts                # Env var accessors (Turbopack-safe)
│   ├── achievements.ts       # 35 achievement definitions + ACHIEVEMENT_MAP
│   ├── checkAndAward.ts      # Shared unlock helper (Firestore dedup, sound, toast)
│   ├── awardXP.ts            # XP award helper
│   ├── recurrence.ts         # Recurring task date math
│   ├── second-brain.ts       # PARA vault Firestore helpers
│   ├── shopping-list-docx.ts # .docx builder (shared by export + Drive save)
│   └── timezone.ts           # Timezone-aware cron helpers
├── contexts/
│   ├── AuthContext
│   ├── PlayerContext         # Media player state
│   ├── ChatPanelContext      # Slide-in panel open/close state
│   └── TimerContext          # Focus timer state across pages
├── extension/                # Chrome MV3 extension (load unpacked)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   └── README.md
├── public/
│   ├── manifest.json         # PWA manifest (includes share_target)
│   ├── icons/
│   ├── sounds/               # achievement-unlock.mp3
│   └── cherry-blossom/       # Pixel art parallax layers
└── types/index.ts            # All shared TypeScript interfaces
```

---

## Environment Variables

```env
# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=         # FCM web push

# Firebase Admin (server-side)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# AI
ANTHROPIC_API_KEY=

# Google OAuth — one client for Calendar, Gmail, Drive, Contacts, Health
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=

# Web Search
TAVILY_API_KEY=

# Vercel Blob (The Crate audio storage)
BLOB_READ_WRITE_TOKEN=                  # Auto-injected when Blob store linked to project

# Plaid (Finance auto-sync)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox                       # sandbox | development | production

# Cron security
CRON_SECRET=                            # Bearer token checked by all cron GET handlers
```

---

## Google Cloud Setup

All Google integrations share a single OAuth 2.0 client.

**APIs to enable** (Google Cloud Console → APIs & Services → Library):
- Google Calendar API
- Gmail API
- Google Drive API
- People API
- Cloud Healthcare API (for Google Health)

**Authorized redirect URIs** to add to your OAuth client:
```
http://localhost:3000/api/calendar/callback
http://localhost:3000/api/gmail/callback
http://localhost:3000/api/drive/callback
http://localhost:3000/api/people/contacts-callback
http://localhost:3000/api/health/googlefit-callback
https://your-app.vercel.app/api/calendar/callback
https://your-app.vercel.app/api/gmail/callback
https://your-app.vercel.app/api/drive/callback
https://your-app.vercel.app/api/people/contacts-callback
https://your-app.vercel.app/api/health/googlefit-callback
```

**Firebase Auth authorized domains** (Firebase Console → Authentication → Settings → Authorized domains):
```
localhost
your-app.vercel.app
```

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

---

## Chrome Extension

Load the extension unpacked for personal use — no store submission needed:

1. Open `chrome://extensions`
2. Toggle **Developer mode** on
3. Click **Load unpacked** → select the `extension/` folder
4. Pin the 🌸 icon to your toolbar

Click the icon on any page → capture to reading list, Second Brain, task, or chat. Requires being logged into the Vercel-deployed app in Chrome.

---

## Firestore Data Structure

```
users/{uid}/
├── chats/{chatId}/
│   └── messages/{msgId}
├── tasks/{taskId}
├── habits/{habitId}
├── journal/{entryId}
├── nutrition/{logId}
├── health/{YYYY-MM-DD}
├── goals/{goalId}
├── transactions/{txId}
├── subscriptions/{subId}
├── projects/{projectId}/
│   └── cards/{cardId}
├── recipes/{recipeId}
├── meal_plans/{weekStart}
├── shopping_lists/{weekStart}
├── people/{personId}/
│   └── interactions/{interactionId}
├── workouts/{workoutId}
├── time_entries/{entryId}
├── focus_sessions/{sessionId}
├── decisions/{decisionId}
├── mood/{YYYY-MM-DD}
├── body_metrics/{entryId}
├── savings_goals/{goalId}
├── books/{bookId}
├── episodes/{episodeId}
├── supplements/{supplementId}
├── ai_insights/{YYYY-MM-DD}
├── budget/{categoryId}
├── net_worth/{YYYY-MM}
├── memory/{entryId}
├── second_brain/{path}
├── inbox/{itemId}            # Second Brain quick capture
├── news_feeds/{feedId}
├── news_items/{itemId}        # { title, url, feed_name, tags, relevance_score, status, starred, fetched_at }
├── news_brief/{YYYY-MM-DD}   # Daily AI synopsis (Claude Sonnet)
├── weekly_reviews/latest
├── achievements/{achievementId} # { id, unlockedAt, gamerscore }
├── xp/summary
├── xp_events/{eventId}
├── api_usage/{YYYY-MM-DD}
├── agent_runs/gmail
├── fcm_tokens/{tokenId}
├── notification_sent/{key}   # Dedup guards for cron notifications
├── settings/
│   ├── notifications         # 14 notification category preferences
│   ├── quick_links
│   ├── dashboard             # Widget order + hidden widgets
│   └── chat_migration
└── integrations/
    ├── gmail
    ├── google_calendar
    ├── drive
    ├── google_health
    ├── google_contacts
    └── plaid
```

---

## Cron Jobs

All crons run hourly (`0 * * * *`) and check local time internally, or at fixed UTC times for less frequent jobs. All handlers are GET routes protected by `Authorization: Bearer ${CRON_SECRET}`.

| Schedule | Route | Purpose |
|---|---|---|
| `0 * * * *` | `/api/notifications/daily` | Dispatches all time-based notifications: morning briefing, streak alerts, task reminders, journal/health reminders, decision reviews, net worth check-in, time summary, goal deadlines, progress mid-day/evening |
| `0 * * * *` | `/api/notifications/habits` | Per-habit reminder notifications based on each habit's configured reminder times |
| `0 * * * *` | `/api/gmail/agent` | Email agent — scans inbox, auto-classifies receipts and subscriptions |
| `0 * * * *` | `/api/weekly-review` | Generates Sunday weekly AI review |
| `0 * * * *` | `/api/daily-briefing` | Morning AI briefing (calendar, tasks, habits) |
| `0 6 * * *` | `/api/insights` | Proactive AI insights — 30-day cross-domain analysis via Claude Opus |
| `0 9 * * *` | `/api/goals/checkin` | Goal inactivity nudge — fires for goals with 14+ days no progress |
| `0 3 * * *` | `/api/health/auto-sync` | Pulls Google Health data for all connected users, writes daily health doc if no manual entry |
| `0 4 * * *` | `/api/plaid/sync` | Syncs Plaid transactions for all connected bank accounts |
| `0 5 * * 0` | `/api/contacts/sync` | Weekly Google Contacts sync — upserts all contacts via People API |
| `0 * * * *` | `/api/news/refresh` | Fetches RSS/Reddit feeds for all users, classifies articles with Claude Haiku |

---

## Deployment

Push to `main` → Vercel auto-deploys. All cron jobs activate automatically on the production deployment.

> **Note:** After first deploy, add your Vercel domain to Firebase Console → Authentication → Settings → Authorized domains so Google Sign-in works on the production URL.
