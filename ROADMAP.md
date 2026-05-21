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
- **Web Search** — Tavily integration: live web search from chat, prompt injection defense, links open in new tab
- **Chat date timezone fix** — Server now uses client's local date so nutrition/task entries logged in evening EST are correct
- **API auth** — `/api/chat` verifies Firebase ID token; uid spoofing blocked
- **Dashboard widgets** — Goals (milestone progress bars), active projects, finance monthly summary

---

## 🔄 In Progress / Partially Done

- **Suno playback** — URL-based track saving works; Suno CDN requires auth so playback needs a storage solution for uploaded MP3s
  - Options: Firebase Storage (Blaze plan upgrade), Vercel Blob (500MB free), Cloudflare R2 (10GB free)
- ~~**Web Speech API — Journal**~~ — Done, swapped to Web Speech API matching chat

---

## 📋 Roadmap

### Data & Integrations
- **Plaid Integration** — Auto-sync bank/credit card transactions into Finance tracker. No more manual entries. *(Direction confirmed)*
- **Google Drive** — Read docs into chat context, save exports, sync with second brain ✅
- **Instacart / Walmart Grocery** — Build grocery lists from meal plan and push to a cart for pickup scheduling. Instacart API covers Walmart, Target, and others.
- **Messaging Hub** — Unified inbox for chat platforms. Discord done.
  - Google Messages — no clean API, likely not feasible
  - **Beeper Desktop API** — Local REST API + MCP server covering WhatsApp, Telegram, Signal, iMessage, Messenger, Instagram, LinkedIn, X, Google Messages, Google Chat, Google Voice. Local-only (requires Beeper Desktop running) so not deployable to prod — better suited as a local Claude Desktop MCP add-on. Public beta. *(Consider)*

### Media
- **Suno MP3 uploads** — Requires storage solution (see above). Once solved: upload MP3s directly, full audio player

### Dashboard Additions
- **Quick Links** — Grid of frequently visited sites, configurable ✅

### AI & Automation
- **Weekly AI Review** — Sunday summary: what went well, what didn't, focus for next week ✅
- **Smart Notifications** — Streak alerts, habit nudges, goal deadline reminders

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
