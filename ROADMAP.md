# Personal OS — Roadmap

## ✅ Complete
- **Phase 1** — App shell, Firebase Auth, Memory System, AI Chat, QuickLog, Daily AI Report
- **Phase 2** — Task Manager (AI priority scoring), Habit Tracker, Google Calendar integration
- **Phase 3** — Journal (voice + AI summary), Nutrition Tracker, Health Tab + Google Health/Fitbit OAuth
- **Phase 4** — Goals (milestones + AI check-ins), Projects (Kanban), Finance Tracker
- **Chat Tool Use** — 16 tools: full CRUD across tasks, calendar, habits, nutrition, health, journal, goals, finance, projects, memory
- **Second Brain** — PARA vault auto-injected into chat context, search + capture tools
- **Bible Verse** — Verse of the day on dashboard (NLT, free API)
- **Phase 5** — Gmail integration: inbox, email detail, reply, archive, trash, mark read/unread, dashboard widget, chat tools
- **PWA** — Installable on Android home screen, FCM push notifications (morning briefing, habit reminders at 9pm EDT)
- **Discord** — Bot API: server/channel browser, read messages, send messages
- **Media Player** — YouTube search + IFrame playback, Suno track management (Firestore URL-based), persistent MiniPlayer
- **UI Redesign** — Top nav replacing sidebar, glassmorphism cards, cherry blossom color palette, animated gradient blob background
- **Web Speech API** — Live in chat, replaced OpenAI Whisper (free, browser-native, no API key)

---

## 🔄 In Progress / Partially Done

- **Suno playback** — URL-based track saving works; Suno CDN requires auth so playback needs a storage solution for uploaded MP3s
  - Options: Firebase Storage (Blaze plan upgrade), Vercel Blob (500MB free), Cloudflare R2 (10GB free)
- **Web Speech API — Journal** — Chat uses it. Journal voice input still uses old MediaRecorder → Whisper flow, needs same swap
- **Background photo** — Cherry blossom night photo implemented but text readability needs design work before re-enabling
- **YouTube in prod** — Needs `YOUTUBE_API_KEY` added to Vercel environment variables

---

## 📋 Roadmap

### Data & Integrations
- **Plaid Integration** — Auto-sync bank/credit card transactions into Finance tracker. No more manual entries. *(Direction confirmed)*
- **Google Drive** — Read docs into chat context, save exports, sync with second brain
- **Instacart / Walmart Grocery** — Build grocery lists from meal plan and push to a cart for pickup scheduling. Instacart API covers Walmart, Target, and others.
- **Messaging Hub** — Unified inbox for chat platforms. Discord done.
  - **Slack** — Read channels/DMs, send messages, AI draft replies
  - Google Messages — no clean API, likely not feasible

### Media
- **Suno MP3 uploads** — Requires storage solution (see above). Once solved: upload MP3s directly, full audio player
- **Spotify** — OAuth + Web Playback SDK, play/pause/skip/queue, music + podcasts. Requires Spotify Premium.

### Dashboard Additions
- **Dashboard widgets** — Goals progress, active projects, finance summary not yet on dashboard
- **Quick Links** — Grid of frequently visited sites, configurable

### AI & Automation
- **Web connectivity** — Give AI ability to search the web for recipes, news, research
  - Deferred: Claude's built-in knowledge covers most cases without it
  - Would unlock: live recipe search, grocery list generation, current events
- **Weekly AI Review** — Sunday summary: what went well, what didn't, focus for next week
- **Smart Notifications** — Streak alerts, habit nudges, goal deadline reminders

### UI / Design
- **Background photo** — Re-enable cherry blossom night photo (Meguro River) once text contrast solved
- **Hi-tech dashboard layout** — Large display typography, stat cards inspired by mockup

### Life OS Features
- **XP / Gamification** — Earn XP for completing tasks, habits, goals, journal entries. Level up, streaks, badges.
- **People / Relationships CRM** — Track contacts, last touchpoint, notes, follow-ups, gift ideas
- **Reading List / Book Tracker** — Log books, highlights, key takeaways summarized by Claude

---

## 💡 Ideas / Parking Lot
- Embedded Discord UI (iframe) — bypass bot API for DMs, blocked by Discord's X-Frame-Options
- Suno official API (no public API yet — check back)
- Mobile app (React Native or Capacitor wrapper)
- Browser extension for quick capture from any webpage
