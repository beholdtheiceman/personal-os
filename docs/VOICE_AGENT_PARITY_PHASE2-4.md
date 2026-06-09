# Voice Agent Parity — Phases 2–4 (implementation brief for Claude Code)

Continuation of `docs/VOICE_AGENT_PARITY_SPEC.md`. **Phase 1 is already merged** (commit `b74f48a`): client-tool layer, `lib/client-actions.ts`, 7 client tools in `lib/chat-tools.ts`, the dispatch branch in `RealtimeVoice.tsx`, the server guard in `/api/tools/execute`, and a listener in `DailyBriefingWidget`.

## Current state (verified)

Working end-to-end from voice:
- `navigate_to_page` → `router.push` (33 routes). ✅
- `open_quick_link` → matches saved Quick Link by title, `window.open`. ✅
- `regenerate_daily_summary` / `refresh_widget` for the Daily Briefing widget (it's the only listener). ✅

Registered but **broken — they dispatch a `CustomEvent` that nothing listens for, yet `runClientTool` returns a success string anyway**, so the agent claims success while nothing happens:
- `switch_dashboard_tab`
- `open_quick_capture`
- `start_focus_timer`
- `refresh_widget` for any widget other than Daily Briefing

Fixing that false-success behavior is the backbone of Phase 2. Don't just add listeners — change the architecture so a client tool can only report success if something actually handled it.

---

# Phase 2 — wire every remaining manual UI action, and make success honest

## 2.0 Key architecture facts (from the codebase)

- **Quick Capture** is a React context, mounted globally in `app/layout.tsx`: `contexts/QuickCaptureContext.tsx` exposes `useQuickCapture() → { isOpen, open, close }`.
- **Focus timer** is a React context: `contexts/TimerContext.tsx` exposes `useTimer() → { start(taskName, durationMin, options?), pause, resume, stop, status, ... }`.
- **Dashboard has NO tab system.** `app/(pages)/dashboard/page.tsx` renders a customizable widget grid via `widgetOrder` + `renderWidget(id)` (IDs: `what_matters`, `system_audit`, `xp`, `quick_links`, `daily_briefing`, `insights`, `decision_review`, `birthday`, `verse`, `tasks_habits`, …). There is nothing for `switch_dashboard_tab` to switch. **Remove that tool** (see 2.4).
- Refreshable widgets each fetch in their own `useEffect`; several already expose a refetch (`WeatherWidget`, `NewsBriefWidget`, `WhatMattersWidget`, `EmailAgentWidget`, `DailyBriefingWidget`, …).

## 2.1 Replace the event bus with a widget-action registry (fixes false success)

CustomEvents can't tell the caller whether anyone handled them — that's the root cause of false success. Replace them with a tiny module-level registry that widgets opt into on mount.

**New file `lib/client-action-registry.ts`:**
```ts
// Module-level registry of on-screen widget actions (refresh/regenerate).
// A widget registers a handler under a stable key while mounted; the client-tool
// dispatcher looks it up so it can report ACCURATE success/failure.
type Handler = () => void | Promise<void>;
const registry = new Map<string, Handler>();

export function registerWidgetAction(key: string, fn: Handler): () => void {
  registry.set(key, fn);
  return () => { if (registry.get(key) === fn) registry.delete(key); };
}
export function hasWidgetAction(key: string): boolean {
  return registry.has(key);
}
export async function runWidgetAction(key: string): Promise<boolean> {
  const fn = registry.get(key);
  if (!fn) return false;
  await fn();
  return true;
}
```

**Each refreshable widget registers itself** (example for `DailyBriefingWidget.tsx` — replace the Phase 1 `addEventListener` block with this):
```ts
import { registerWidgetAction } from "@/lib/client-action-registry";
// `regenerate` should be a useCallback that does the existing /api/daily-briefing refetch.
useEffect(() => registerWidgetAction("daily_briefing", regenerate), [regenerate]);
```
Do the same in each widget below, registering its existing refetch under the listed key. If a widget has no standalone refetch yet, extract its mount-effect fetch into a `useCallback` named `refetch` first.

| Widget file | key |
|---|---|
| `DailyBriefingWidget.tsx` | `daily_briefing` |
| `WeatherWidget.tsx` | `weather` |
| `NewsBriefWidget.tsx` (and/or `NewsFeedWidget.tsx`) | `news` |
| `WhatMattersWidget.tsx` | `what_matters` |
| `EmailAgentWidget.tsx` | `email_agent` |
| `MoodDashboardWidget.tsx` | `mood` |
| `HydrationDashboardWidget.tsx` | `hydration` |
| `BudgetDashboardWidget.tsx` | `budget` |
| `SavingsDashboardWidget.tsx` | `savings` |
| `InsightsWidget.tsx` | `insights` |
| `SpendingTrendsWidget.tsx` | `spending_trends` |
| `DecisionReviewWidget.tsx` | `decision_review` |

(Add others as desired — the pattern is one line per widget.)

## 2.2 Add context-backed actions to the dispatcher `Ctx`

Quick Capture and Focus are contexts, so pass real callbacks instead of firing events. Update **`lib/client-actions.ts`**:

```ts
"use client";
import { runWidgetAction, hasWidgetAction } from "@/lib/client-action-registry";

type Ctx = {
  navigate: (path: string) => void;
  getQuickLinks: () => { title: string; url: string }[];
  openQuickCapture: (text?: string) => boolean;   // returns false if unavailable
  startFocus: (minutes?: number) => boolean;       // returns false if unavailable
};

export async function runClientTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<string> {
  switch (name) {
    case "navigate_to_page": {
      const page = String(args.page ?? "");
      if (!page) return "No page specified.";
      ctx.navigate(`/${page}`);
      return `Opened the ${page} page.`;
    }
    case "open_quick_link": {
      const q = String(args.title_search ?? "").toLowerCase();
      const match = ctx.getQuickLinks().find((l) => l.title.toLowerCase().includes(q));
      if (!match) return `No quick link matching "${args.title_search}".`;
      window.open(match.url, "_blank", "noopener");
      return `Opened "${match.title}".`;
    }
    case "regenerate_daily_summary": {
      const ok = await runWidgetAction("daily_briefing");
      return ok ? "Regenerating the daily summary." : "The daily summary isn't on screen — open the dashboard first.";
    }
    case "refresh_widget": {
      const widget = String(args.widget ?? "");
      const ok = await runWidgetAction(widget);
      return ok ? `Refreshed the ${widget} widget.` : `The ${widget} widget isn't on screen right now.`;
    }
    case "open_quick_capture": {
      const ok = ctx.openQuickCapture(args.text ? String(args.text) : undefined);
      return ok ? "Opened quick capture." : "Couldn't open quick capture here.";
    }
    case "start_focus_timer": {
      const min = typeof args.minutes === "number" ? args.minutes : undefined;
      const ok = ctx.startFocus(min);
      return ok ? `Started a focus session${min ? ` for ${min} minutes` : ""}.` : "Couldn't start a focus session here.";
    }
    default:
      return `Unknown client tool: ${name}`;
  }
}
```

Note `refresh_widget`'s `widget` arg must use the **registry keys** above (`weather`, `news`, `budget`, …). Update that tool's description/enum in `lib/chat-tools.ts` to list the valid keys so the model passes the right one.

## 2.3 Supply the new Ctx from `RealtimeVoice.tsx`

Add the context hooks and pass real callbacks into `runClientTool`:
```ts
import { useQuickCapture } from "@/contexts/QuickCaptureContext";
import { useTimer } from "@/contexts/TimerContext";
// inside the component:
const { open: openCapture } = useQuickCapture();
const { start: startTimer } = useTimer();
// keep refs so the handleMessage useCallback closure stays current (same pattern as linksRef):
const captureRef = useRef(openCapture); useEffect(() => { captureRef.current = openCapture; }, [openCapture]);
const timerRef   = useRef(startTimer);  useEffect(() => { timerRef.current = startTimer;   }, [startTimer]);
```
In the client-tool branch of `handleMessage`:
```ts
toolResult = await runClientTool(toolName, toolArgs, {
  navigate: (p) => router.push(p),
  getQuickLinks: () => linksRef.current.map((l) => ({ title: l.title, url: l.url })),
  openQuickCapture: (text) => { captureRef.current(); return true; },          // open() takes no prefill today; see 2.5
  startFocus: (minutes) => { timerRef.current("Focus", minutes ?? 25, {}); return true; },
});
```

## 2.4 Remove `switch_dashboard_tab`

There is no tab UI. Delete it from: the `TOOLS` array, `CLIENT_TOOL_NAMES`, and the `runClientTool` switch. (If you later add a real tab/segment control, re-introduce it then.) Leaving it in guarantees a tool that always lies.

## 2.5 Optional polish
- To support prefilled quick capture, extend `QuickCaptureContext.open` to accept `(prefill?: string)` and have the modal seed its `text` state from it; then pass `args.text` through in 2.3.
- `start_focus_timer` currently labels the session "Focus"; optionally accept a `task` arg and pass it as the timer's `taskName`.

## Phase 2 acceptance
With the dashboard on screen, speak each and verify the real effect AND an honest spoken reply: "regenerate the daily summary", "refresh the weather widget", "open quick capture", "start a 30 minute focus session". Then, with the dashboard NOT on screen, "refresh the weather widget" must say it isn't on screen — not claim success.

---

# Phase 3 — same powers in text chat

## 3.0 How text chat runs tools today
`app/api/chat/route.ts` is **non-streaming**. It runs the Anthropic loop server-side: on `stop_reason === "tool_use"` it calls `executeTool(uid, tool.name, …)` and feeds results back, then returns a single `NextResponse.json({ text, actions, … })`. It **already returns an `actions` array to the client** — reuse that as the transport for client tools. `ChatInterface.tsx` calls `/api/chat` via `fetch` (around lines 277 and 435).

## 3.1 Server: don't execute client tools — forward them
In the tool loop in `app/api/chat/route.ts`:
```ts
import { TOOLS, isClientTool } from "@/lib/chat-tools";
// ...
for (const tool of toolUses) {
  if (isClientTool(tool.name)) {
    clientActions.push({ name: tool.name, arguments: tool.input }); // collect for the client
    toolResults.push({
      type: "tool_result",
      tool_use_id: tool.id,
      content: "Acknowledged — this UI action will run in the app.",
    });
    continue;
  }
  const result = await executeTool(uid, tool.name, tool.input as ToolInput, today, chatId);
  toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
}
```
Return `clientActions` alongside the existing payload: `NextResponse.json({ text, actions, clientActions, renamedChat })`. The synthetic ack keeps the model's final wording sane; the real effect happens client-side next.

## 3.2 Client: execute the forwarded actions
In `ChatInterface.tsx`, after a successful `/api/chat` response, run each forwarded client tool with the **same** `runClientTool` and a Ctx built from the chat component's hooks (`useRouter`, `useQuickLinks`, `useQuickCapture`, `useTimer`):
```ts
import { runClientTool } from "@/lib/client-actions";
// after parsing the response:
for (const a of (data.clientActions ?? [])) {
  await runClientTool(a.name, a.arguments ?? {}, chatCtx); // chatCtx === same shape as RealtimeVoice's
}
```
Factor the Ctx construction into a small shared hook (e.g. `hooks/useClientToolCtx.ts`) so `RealtimeVoice` and `ChatInterface` build it identically and you don't duplicate the closure logic.

## Phase 3 acceptance
In text chat: "go to my finance page", "open my <quick-link>", "regenerate the daily summary" each perform the real UI action, and the assistant's text matches what happened.

---

# Phase 4 — hardening

## 4.1 Confirm before destructive / irreversible actions
These 25 tools mutate or send irreversibly and currently fire instantly from voice:

`unsubscribe_from_email, send_email, reply_to_email, trash_email, delete_gmail_label, clear_shopping_list, delete_shopping_item, delete_task, delete_habit, delete_meal, delete_health_log, delete_journal_entry, delete_goal, delete_subscription, delete_memory, delete_project, delete_project_card, delete_recipe, delete_interaction, delete_person, delete_second_brain_item, delete_calendar_event, delete_debt, delete_drive_file, delete_google_contact`

Add to `lib/chat-tools.ts`:
```ts
export const DESTRUCTIVE_TOOL_NAMES = new Set<string>([ /* the 25 names above */ ]);
export const isDestructiveTool = (n: string) => DESTRUCTIVE_TOOL_NAMES.has(n);
```

Two layers (do both):
1. **Instruction-level (primary for voice).** In `RealtimeVoice.tsx`'s `session.update` instructions, add: *"Before any action that deletes data, sends an email, or is otherwise irreversible, briefly state what you're about to do and wait for the user to say yes. Never delete or send without an explicit confirmation in the same turn."* This is the cheapest, most reliable lever for a spoken interface.
2. **Code-level guard (text chat + belt-and-suspenders).** In `ChatInterface`/`/api/chat`, when an assistant turn calls an `isDestructiveTool`, surface a confirm UI (or require a `confirmed: true` arg) before `executeTool` runs. For voice you can optionally require the model to call a paired `confirm` first, but the instruction usually suffices — measure before adding friction.

## 4.2 Tool-count / selection accuracy
After Phase 2 you'll expose ~171 tools (166 server + 6 client, minus `switch_dashboard_tab`) to a single Realtime session. That's a lot of context and can degrade the model's ability to pick the right tool. Treat this as a watch item:
- **Symptom to watch:** the agent calls the wrong tool, invents args, or misses an obvious tool.
- **Mitigations, cheapest first:** tighten tool descriptions (shorter, more distinctive); drop rarely-voiced tools from the *realtime* list only (keep them in text chat) by filtering in `/api/realtime/tools`; or gate tools by context (expose a core set always, load a domain's tools after a `navigate_to_page`/intent). Don't pre-optimize — instrument first.
- Optional: log `response.function_call_arguments.done` tool names client-side to see which tools actually get used.

## Phase 4 acceptance
Voice: "delete my dentist task" → the agent reads it back and waits; only acts on "yes". "Send an email to Sam" → confirms recipient/subject before sending. No destructive tool fires without an in-turn confirmation.

---

# Files touched (Phases 2–4)

| File | Phase | Change |
|---|---|---|
| `lib/client-action-registry.ts` | 2 | **New.** Widget-action registry. |
| `lib/client-actions.ts` | 2 | Use registry; context-backed Ctx; honest result strings. |
| `lib/chat-tools.ts` | 2,4 | Remove `switch_dashboard_tab`; fix `refresh_widget` keys; add `DESTRUCTIVE_TOOL_NAMES`/`isDestructiveTool`. |
| `components/chat/RealtimeVoice.tsx` | 2,4 | Add `useQuickCapture`/`useTimer` + refs; pass new Ctx; add destructive-confirm instruction. |
| `components/dashboard/*Widget.tsx` (12) | 2 | Register a refetch under the registry key. |
| `contexts/QuickCaptureContext.tsx` | 2 (opt) | Accept optional prefill text. |
| `hooks/useClientToolCtx.ts` | 3 | **New (recommended).** Shared Ctx builder. |
| `app/api/chat/route.ts` | 3 | Forward client tools via `clientActions`; ack as tool_result. |
| `components/chat/ChatInterface.tsx` | 3,4 | Run forwarded client tools; destructive confirm UI. |

**Definition of done:** every action the user can perform by hand — navigate, open a quick link, open quick capture, start a focus session, refresh/regenerate any on-screen widget, plus all 166 data operations — is invokable from both voice and text chat; client tools report success only when something actually happened; destructive actions require confirmation.
