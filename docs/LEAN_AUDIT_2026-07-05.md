# Lean Audit — 2026-07-05
*Refocusing Personal OS as an automated personal assistant + second brain. Suggested list only — nothing below has been executed.*

Decisions already made (2026-07-05): keep Plaid/Finance, Google Health, and Gmail+Calendar integrations no matter what; cut the XP/gamification layer; People CRM is **not** a keeper. `claude-code-game-studios/` moved out of the repo (now at `C:/Users/Larry/claude-code-game-studios`).

---

## Where the app stands today

| Surface | Count | Note |
|---|---|---|
| Page routes | 36 | `app/(pages)/*` |
| API route groups | 46 | `app/api/*` |
| AI chat tools | **206** | was 172 in June — the voice-agent latency root cause, and it grew |
| Dashboard widgets | 29 | |
| Vercel crons | 18 | |
| Notification categories | 14 | |
| `lib/` code | 12,325 lines | `tool-executor.ts` (4,050) + `chat-tools.ts` (2,722) = 55% of it |

Since the June FOCUS_AUDIT recommended narrowing, seven **new** domains shipped instead (rate tracker, spaced repetition, CRM health scores + gifts, maintenance tracker, SOPs, Ideas vault, hydration goals). The audit was right and unexecuted; the surface kept compounding.

**The one-sentence diagnosis:** the AI-assistant plumbing (206 tools, ambient capture, day recap, context snapshot, passive syncs) is genuinely strong, but it's buried under ~25 manual-upkeep trackers that each demand a page visit — and the tool bloat now actively degrades the assistant itself (voice agent slows mid-call because every turn carries all 206 schemas).

**The test applied below:** does the feature (a) feed the assistant passively/zero-friction, (b) serve capture/recall (second brain), or (c) demand manual upkeep to stay useful? Keep a and b. Cut or demote c.

---

## KEEP — the core spine (~13 of 36 pages)

- **Chat** (panel + page + Realtime voice) — this *is* the product
- **Memory + Second Brain (PARA)** + Ambient Capture (`/api/ingest`) + Day Recap — the second-brain half; make Day Recap/Quick Capture the front door per AI_FIRST_GAME_PLAN Phase 0
- **Tasks** (incl. recurring tasks — this absorbs Maintenance, see below)
- **Calendar** + meeting prep
- **Habits** (streaks + heatmap stay — they're habit analytics, not the XP system)
- **Finance** — Plaid auto-sync, budgets, subscriptions, net worth, debt, rate tracker *(keeper)*
- **Health** — Google Health auto-sync + health log *(keeper)*; manual sub-trackers demoted (below)
- **Gmail agent** — classification, receipts→finance, unsubscribe review *(keeper)*
- **Goals** (absorbs OKRs, see below)
- **Dashboard** — slimmed to ~8 widgets
- **Settings, Home, Share target**
- Weather + TTS + transcribe stay as services feeding chat/briefing (no dedicated page needed)

## CONSOLIDATE — five AI-summary systems into two

`daily-briefing`, `daily-report`, `what-matters`, `insights`, and `weekly-review` all do "Claude reads your data and tells you things." Merge into:
1. **Morning briefing** (absorbs what-matters + daily insights + Bible verse-of-the-day line + birthday note)
2. **Weekly review** (absorbs sleep correlations + OKR-style check-in)

Same consolidation for goals: **OKRs merge into Goals** (two goal systems is one too many). **Maintenance tracker becomes recurring tasks** (it's reminders, not a domain). **SOPs and Ideas vault fold into Second Brain** (they're notes with a type field).

## DEMOTE to chat-only — tools stay, pages/widgets/forms go

You can still say "log my weight / mood / took my supplements / journal this" — the assistant files it. No dedicated UI to maintain:

- Journal, Mood, Body metrics, Supplements, Hydration, Decisions journal, Nutrition/food log, Workout logging

## CUT — delete pages, routes, widgets, tools, crons (data stays in Firestore, code stays in git)

- **XP / levels / achievements** *(decided)* — `xp.ts`, `awardXP.ts`, `checkAndAward.ts`, `achievements.ts`, `/achievements` page, XP widgets, and the award calls sprinkled through every logging path
- **People CRM** — page, relationship health, gift suggestions, contacts weekly cron *(not a keeper per your call; birthday line can survive inside the morning briefing if wanted)*
- **Media player + The Crate** — entertainment, not assistant
- **News feed** + hourly refresh cron — curation taste, not automatable (Phase 2 logic from AI_FIRST_GAME_PLAN)
- **Reading list**, **Content/podcast tracker** — creative-pipeline tools, park them
- **Meal planner + grocery price checker** — decision-making friction, not logging friction; not automatable
- **Discord** — already hidden; delete
- **Drive browser page** — keep the chat search/read tools, drop the UI
- **Bible page** — demote to a verse line in the morning briefing
- **Life-context / Season / Constitution pages** — park the reflection layer where ROADMAP has it; it's downstream of re-engagement, not the cause of it
- **Projects kanban, Time tracker, Focus timer** — borderline trio: keep only the ones you actually reached for in the last month; otherwise park
- **system-audit** cron + widget, **goals/checkin** cron, **okrs/review** cron, **sleep/correlations** cron (folded), **what-matters + insights** crons (folded)

## Resulting footprint (estimate)

| Surface | Now | After |
|---|---|---|
| Pages | 36 | ~13 |
| AI tools | 206 | ~70 (voice gets a ~25-tool subset — completes fix #3 of the voice-latency diagnosis) |
| Dashboard widgets | 29 | ~8 (briefing, budget/spending, weather, meeting prep, email agent, weekly review, quick links, habits) |
| Crons | 18 | ~10 |
| Notification categories | 14 | ~6 (morning briefing, task, habit/streak, budget, meeting prep, weekly review) |

## Hygiene items (small, do anytime)

- Root has 8 planning/report markdown files → move to `docs/` (this file starts the convention); `security-report-2026-06-13.md` already moved into `security-reports/`
- `tsconfig.tsbuildinfo` is tracked and shows as modified → add to `.gitignore`
- `scripts/_authz-domains.mjs`, `ruvector.db`, `extension/` — confirm still used; delete or document
- `tool-executor.ts` at 4,050 lines: when trimming tools, split it by domain so the next feature doesn't land in a monolith

## Suggested execution order

1. **Phase 0 of AI_FIRST_GAME_PLAN** (unchanged, still right): make Day Recap + Quick Capture the front door; repoint evening notifications at Day Recap
2. **Cut pass** per this list — pages/widgets/crons first (fast, visible), then the tool-schema trim (biggest AI win)
3. **Voice tool subset** — the ~25-tool voice list, completing the latency fix
4. Re-evaluate the borderline trio + parked reflection layer after 2–3 weeks of actual use
