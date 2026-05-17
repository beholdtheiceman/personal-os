# Personal OS — Roadmap

## ✅ Complete
- **Phase 1** — App shell, Firebase Auth, Memory System, AI Chat, QuickLog, Daily AI Report
- **Phase 2** — Task Manager (AI priority scoring), Habit Tracker, Google Calendar integration
- **Phase 3** — Journal (voice + AI summary), Nutrition Tracker, Health Tab + Google Health/Fitbit OAuth
- **Phase 4** — Goals (milestones + AI check-ins), Projects (Kanban), Finance Tracker
- **Chat Tool Use** — 16 tools: full CRUD across tasks, calendar, habits, nutrition, health, journal, goals, finance, projects, memory
- **Second Brain** — PARA vault auto-injected into chat context, search + capture tools
- **Bible Verse** — Verse of the day on dashboard (NLT, free API)

---

## 🔜 Next Up
- **Plaid Integration** — Auto-sync bank/credit card transactions into Finance tracker. No more manual entries. (Direction confirmed)

---

## 📋 Roadmap

### Data & Integrations
- **Web Search** — Tavily or Brave Search API as a chat tool. Real-time lookups, news, research.
- **Google Drive** — Read docs into chat context, save exports, sync with second brain.
- **Plaid** — Bank + credit card transaction sync for Finance tab.

### Media Player
Full **Media tab** with persistent mini-player at the bottom of the layout:
- **Spotify** — OAuth + Web Playback SDK. Play/pause/skip/queue, music + podcasts. Requires Spotify Premium.
- **YouTube** — IFrame Player API for video/music playback. YouTube Data API for search.
- **Suno Songs** — Upload downloaded `.mp3` files to Firebase Storage, custom audio player for your created tracks.

### Dashboard Additions
- **Quick Links** — Grid of frequently visited sites (LoanWell workspace, Lorcana sites, Godot docs, etc.). Configurable. *(Spitballing — not confirmed)*
- **Dashboard widgets for Phase 4** — Goals, Projects, Finance tiles not on dashboard yet.

### AI & Automation
- **Web Search in Chat** — Let Claude look things up in real time during conversations.
- **Weekly AI Review** — Sunday summary across all tabs: what went well, what didn't, focus for next week.
- **Smart Notifications** — Streak alerts, habit nudges, goal deadline reminders.

### Life OS Features
- **XP / Gamification** — Earn XP for completing tasks, habits, goals, journal entries. Level up, streaks, badges.
- **People / Relationships CRM** — Track important contacts, last touchpoint, notes, follow-ups, gift ideas.
- **Reading List / Book Tracker** — Log books, highlights, key takeaways summarized by Claude.
- **Inspirational content** — Bible verse ✅ done. Potential expansion: daily quote, devotional, etc.

### Voice & Input
- **Web Speech API** — Replace Whisper for journal voice input (browser-native, no API key needed). Already in backlog.

---

## 💡 Ideas / Parking Lot
- Local music files (requires Electron or file server — not possible in pure web app)
- Suno official API (no public API exists yet — check back)
- Mobile app (React Native or PWA wrapper)
- Browser extension for quick capture from any webpage
