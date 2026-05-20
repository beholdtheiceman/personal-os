# Personal OS

A personal AI-powered life dashboard built with Next.js 15, Firebase, and Claude AI. Manage your tasks, habits, health, finances, and more — all in one place, with a conversational AI assistant that has full context of your life.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Auth & Database:** Firebase Auth (Google SSO), Firestore
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **AI:** Anthropic Claude API (claude-sonnet-4, claude-haiku)
- **Styling:** Tailwind CSS, custom dark glass UI
- **Background:** Pixel art cherry blossom parallax (4-layer scroll)
- **Deployment:** Vercel

## Features

### 🤖 AI Chat Assistant
- Multi-conversation chat with persistent history
- Full context of all your data (tasks, habits, health, goals, etc.)
- Second Brain integration — sync your local Obsidian/markdown vault
- Tool use: create tasks, log habits, schedule events, search Gmail, and more — all via natural language
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
- Cron-based delivery via Vercel (Hobby: once daily; Pro: flexible schedule)
- Configure via UI or AI chat ("remind me every morning at 7am")

### 📊 Claude API Usage
- Real-time token usage tracking (input/output) per conversation
- Daily and monthly rollups stored in Firestore
- Dashboard widget with 7-day bar chart and estimated cost
- Pricing: $3 / $15 per 1M tokens (in / out) · Sonnet 4

### 🎨 UI / Design
- Dark cherry-blossom glass aesthetic throughout
- Pixel art parallax background (4 scrolling layers at different speeds)
- Frosted glass cards (`backdrop-filter: blur`)
- Accent: cherry blossom rose `#C4728A`
- Fully responsive — mobile bottom nav, desktop top nav

## Project Structure

```
personal-os/
├── app/
│   ├── (pages)/          # App routes (dashboard, tasks, habits, etc.)
│   ├── api/              # API routes (chat, notifications, second-brain sync)
│   └── globals.css       # Global styles, dark glass tokens, parallax keyframes
├── components/
│   ├── chat/             # Multi-conversation chat interface
│   ├── dashboard/        # Dashboard widgets (XP, API usage, etc.)
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
├── hooks/                # useAuth, useXP, useApiUsage, useNotifications, etc.
├── lib/                  # Firebase, memory, XP, second-brain, env helpers
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

# Google OAuth (Calendar + Gmail)
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=

# Web Search
TAVILY_API_KEY=

# Cron security
CRON_SECRET=
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
├── projects/{projectId}/
│   └── cards/{cardId}
├── memory/{entryId}
├── second_brain/{path}
├── xp/summary
├── xp_events/{eventId}
├── api_usage/{YYYY-MM-DD}
├── settings/notifications
├── settings/chat_migration
└── integrations/
    ├── gmail
    └── google_calendar
```

## Deployment

Deployed on Vercel. Push to `main` branch to trigger a production deploy.

- `main` → production
- `dev` → development / staging (merge to main manually after verification)

Cron jobs are configured in `vercel.json` for notification delivery. Vercel Hobby plan supports once-daily crons; upgrade to Pro for sub-daily scheduling.
