# Personal OS

A personal AI-powered life dashboard built with Next.js 15, Firebase, and Claude AI. Manage your tasks, habits, health, finances, relationships, and more — all in one place, with a conversational AI assistant that has full context of your life.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Auth & Database:** Firebase Auth (Google SSO), Firestore
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **AI:** Anthropic Claude API (claude-sonnet-4-6, claude-haiku-4-5)
- **Styling:** Tailwind CSS, custom dark glass UI
- **Background:** Pixel art cherry blossom parallax (4-layer scroll)
- **Deployment:** Vercel

## Features

### 🤖 AI Chat Assistant
- Multi-conversation chat with persistent history
- **Persistent slide-in panel** — 400px panel fixed to the right edge of every page; pushes content on desktop, full-screen overlay on mobile; toggle from TopNav or MobileNav without leaving your current tab
- Full context of all your data (tasks, habits, health, goals, etc.)
- Second Brain integration — sync your local Obsidian/markdown vault
- 30+ tools: create tasks, log habits, schedule events, search Gmail, read Drive files, manage contacts, plan meals, and more — all via natural language
- Auto-names conversations based on content
- Voice input via Web Speech API
- Image attachment support
- Web search via Tavily

### ✅ Tasks
- Full task management with priority scoring, tags, and due dates
- Create, complete, and archive tasks via UI or AI chat
- XP awarded on completion

### 🔄 Habits
- Track daily and weekly habits with streak counting
- Completion toggle with XP rewards
- Push notification reminders (multiple times per day)
- Streak bonuses

### 📅 Calendar
- Google Calendar integration (OAuth)
- View upcoming events on dashboard and calendar page
- Create events via AI chat ("schedule a meeting tomorrow at 2pm")

### 📧 Gmail
- Gmail OAuth integration
- Inbox view with unread indicators
- Read and search emails via AI chat
- Dashboard inbox preview

### 🤖 Email Agent
- Automated Gmail scanner — runs daily via Vercel cron
- Classifies emails as receipts or subscriptions using Claude Haiku
- Auto-writes detected transactions to Finance and subscriptions to the Subscription tracker
- `source: "email-agent"` tag on all auto-written records for easy filtering
- Inbox analysis: Claude summarizes your inbox and flags unsubscribe candidates
- Manual "Run now" trigger from dashboard widget
- Dedup logic: fuzzy name match for subscriptions, description+amount+date for transactions

### 🗓️ Weekly AI Review
- Auto-generated every Sunday at 6 PM UTC via Vercel cron
- Pulls tasks, habits, journal entries, health, nutrition, and goals for the week
- Claude generates a structured 4-section report: Wins, Gaps, Insight, Focus for Next Week
- Manual "Generate" button — trigger anytime, not just Sundays
- Collapsed preview on dashboard with full expand

### 🍽️ Meal Planner
- Weekly meal grid (Mon–Sun × Breakfast/Lunch/Dinner/Snack)
- Recipe library with search, ingredients, macros, and tags
- Shopping list auto-generated from week's planned meals
- Claude tools: add recipes, plan meals, read week's plan, generate shopping list via chat

### 👥 People / Relationships CRM
- Contact management: name, relationship type, email, phone, birthday, company, location
- Interaction logging (call, text, email, in-person, social)
- Contact frequency targets with "Needs attention" dashboard section
- Follow-up dates and notes
- Gift ideas per person
- Google Contacts one-click import (OAuth, People API)
- Claude tools: list contacts, add/update people, log interactions

### ☁️ Google Drive
- OAuth integration with read-only Drive access
- File browser with search across file names and content
- Preview Google Docs, Sheets, Slides, and plain text files inline
- Claude tools: `search_drive`, `read_drive_file` — pull any doc into chat context

### 🔗 Quick Links
- Configurable grid of frequently visited sites on the dashboard
- Auto-fetches favicons; optional emoji override
- Add, remove, and edit links inline — persisted to Firestore

### 🎮 XP & Gamification
- Level system with 75+ levels and unique titles
- XP awarded for: completing tasks, logging habits, journal entries, health logs, goal milestones
- Progress bar and level badge on dashboard
- Level-up toast notifications
- Recent XP event feed

### 🧠 Memory & Second Brain
- Persistent AI memory — store facts, preferences, and context
- Second Brain sync: upload your local markdown folder (Obsidian/PARA) to Firestore
- AI automatically pulls relevant notes into chat context
- Capture ideas and tasks to your vault via chat

### 📓 Journal
- Voice or text journal entries
- AI-generated summaries and mood scoring (1–10)
- Tag system for themes
- XP for each entry

### 🥗 Nutrition
- Log meals with macro estimates (AI estimates calories/protein/carbs/fat from description)
- Daily and weekly views with bar charts
- Calorie goal tracking

### 💪 Health
- Daily health logging: sleep hours/quality, energy level, exercise, steps, notes
- **Google Health integration** — OAuth connect to Google Health API v4; auto-syncs sleep (hours, efficiency, stage breakdown), daily steps, resting heart rate, and exercise sessions from wearables (Pixel Watch, Fitbit, etc.)
- Health log form pre-fills from Google Health data with one-click import
- Weekly chart visualization
- Dashboard health snapshot

### 🎯 Goals
- Goal tracking with milestone system
- Progress bars based on milestone completion
- AI can create goals and toggle milestones via chat

### 💰 Finance
- Income and expense tracking with categories
- Monthly net summary on dashboard
- AI can log transactions via chat
- Subscription tracker with renewal dates and monthly cost rollup

### 📁 Projects
- Kanban-style project management (todo / in progress / done)
- Color-tagged projects
- Card management via AI chat

### 🎵 Media Player
- YouTube playlist player
- Background playback with mini player
- Persists across navigation

### 🔔 Notifications
- Push notifications via FCM (Firebase Cloud Messaging)
- Configurable categories: Morning Briefing, Streak Alerts, Task Reminders, Journal Reminder, Health Reminder, Weekly Review
- Per-habit reminder times (multiple per day)
- Cron-based delivery via Vercel
- Configure via UI or AI chat ("remind me every morning at 7am")

### 📊 Claude API Usage
- Real-time token usage tracking (input/output) per conversation
- Daily and monthly rollups stored in Firestore
- Dashboard widget with 7-day bar chart and estimated cost

### 🎨 UI / Design
- Dark cherry-blossom glass aesthetic throughout
- Pixel art parallax background (4 scrolling layers)
- Frosted glass cards (`backdrop-filter: blur`)
- Accent: cherry blossom rose `#C4728A`
- Fully responsive — mobile bottom nav, desktop top nav

## Project Structure

```
personal-os/
├── app/
│   ├── (pages)/          # App routes (dashboard, tasks, habits, drive, people, etc.)
│   ├── api/              # API routes (chat, gmail, drive, weekly-review, etc.)
│   └── globals.css       # Global styles, dark glass tokens
├── components/
│   ├── chat/             # Multi-conversation chat interface
│   ├── dashboard/        # Dashboard widgets (XP, API usage, email agent, weekly review, quick links)
│   ├── meal-planner/     # Recipe library, weekly grid, shopping list
│   ├── people/           # Contacts CRM, person detail, interaction log
│   ├── habits/           # Habit tracker
│   ├── tasks/            # Task manager
│   ├── health/           # Health logging + charts
│   ├── nutrition/        # Nutrition tracker
│   ├── journal/          # Journal with voice input
│   ├── goals/            # Goal + milestone tracker
│   ├── finance/          # Income/expense tracker
│   ├── projects/         # Kanban project boards
│   ├── media/            # YouTube media player
│   ├── memory/           # Memory manager + Second Brain sync
│   ├── notifications/    # Notification settings
│   ├── layout/           # TopNav, MobileNav, ParallaxBackground
│   └── xp/               # XP widget + level system
├── hooks/                # useAuth, useXP, usePeople, useMealPlanner, useQuickLinks, etc.
├── lib/                  # Firebase, memory, XP, gmail-token, drive-token, email-classifier, etc.
├── contexts/             # AuthContext, PlayerContext
├── public/
│   └── cherry-blossom/   # Pixel art background PNGs (5 layers)
└── types/                # Shared TypeScript types
```

## Environment Variables

```env
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# Firebase Admin (server)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# AI
ANTHROPIC_API_KEY=

# Google OAuth (Calendar, Gmail, Drive, Contacts — all same client)
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=

# Web Search
TAVILY_API_KEY=

# Google Health (sleep, steps, exercise, heart rate)
# Enable "Cloud Healthcare API" in Google Cloud Console > APIs & Services > Library
# Add /api/health/callback to your Google OAuth client redirect URIs
# Scopes: googlehealth.activity_and_fitness.readonly, googlehealth.sleep.readonly,
#         googlehealth.health_metrics_and_measurements.readonly
# No extra credentials needed — uses existing GOOGLE_CALENDAR_CLIENT_ID/SECRET

# Cron security
CRON_SECRET=
```

## Google Cloud Setup

All Google integrations (Calendar, Gmail, Drive, Contacts) share a single OAuth 2.0 client. Required setup:

1. **APIs to enable** in Google Cloud Console → APIs & Services → Library:
   - Google Calendar API
   - Gmail API
   - Google Drive API
   - People API (for Contacts import)

2. **Authorized redirect URIs** to add to your OAuth client:
   ```
   http://localhost:3000/api/calendar/callback
   http://localhost:3000/api/gmail/callback
   http://localhost:3000/api/drive/callback
   http://localhost:3000/api/people/contacts-callback
   http://localhost:3000/api/health/googlefit-callback
   http://localhost:3001/api/calendar/callback
   http://localhost:3001/api/gmail/callback
   http://localhost:3001/api/drive/callback
   http://localhost:3001/api/people/contacts-callback
   http://localhost:3001/api/health/googlefit-callback
   https://your-app.vercel.app/api/calendar/callback
   https://your-app.vercel.app/api/gmail/callback
   https://your-app.vercel.app/api/drive/callback
   https://your-app.vercel.app/api/people/contacts-callback
   https://your-app.vercel.app/api/health/googlefit-callback
   ```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google to get started.

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
├── memory/{entryId}
├── second_brain/{path}
├── weekly_reviews/latest
├── xp/summary
├── xp_events/{eventId}
├── api_usage/{YYYY-MM-DD}
├── agent_runs/gmail
├── settings/
│   ├── notifications
│   ├── quick_links
│   └── chat_migration
└── integrations/
    ├── gmail
    ├── google_calendar
    └── drive
```

## Cron Jobs (`vercel.json`)

| Schedule | Route | Purpose |
|---|---|---|
| `0 12 * * *` | `/api/notifications/daily` | Morning briefing push notification |
| `0 13 * * *` | `/api/notifications/habits` | Habit reminder push notification |
| `0 14 * * *` | `/api/gmail/agent` | Email agent — scan inbox, auto-write transactions/subscriptions |
| `0 18 * * 0` | `/api/weekly-review` | Sunday weekly AI review |

## Deployment

Deployed on Vercel. Push to `main` branch to trigger a production deploy.
