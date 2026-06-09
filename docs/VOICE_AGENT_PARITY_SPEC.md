# Voice Agent — Full App Parity Spec

**Goal:** Make the voice agent (and text chat) able to do *everything the user can do manually in the app*, including UI actions like navigating to a page, opening a quick link, opening a modal, switching a dashboard tab, and regenerating/refreshing an on-screen widget — not just server-side data writes.

This document is a complete implementation brief. Follow it top to bottom. It references real files and current conventions in this repo.

---

## 1. Current architecture (as-is)

- **Tool registry:** `lib/chat-tools.ts` exports `TOOLS: Anthropic.Tool[]` — currently **166 tools**, all server-side data operations. Shape:
  ```ts
  {
    name: "add_task",
    description: "...",
    input_schema: { type: "object" as const, properties: {...}, required: [...] },
  }
  ```
  `toOpenAITools(TOOLS)` maps these to `OpenAIRealtimeTool[]` (`{ type:"function", name, description, parameters }`) for the Realtime API.

- **Tool execution (server):** `lib/tool-executor.ts` → `executeTool(uid, toolName, input, today, chatId?)` is one big `switch (toolName)`. Every one of the 166 tools has a `case`. It runs on the server (Firestore admin, Gmail, Drive, etc.) and returns a `string`.

- **Voice → execution path:** `components/chat/RealtimeVoice.tsx`, in the `response.function_call_arguments.done` handler, **always** does:
  ```ts
  const res = await fetch("/api/tools/execute", { method:"POST", headers:{...auth}, body: JSON.stringify({ name, arguments }) });
  ```
  `/api/tools/execute/route.ts` verifies the Firebase token, checks the name against `TOOLS`, and calls `executeTool(uid, name, args, today)`.

- **Realtime tools list:** `/api/realtime/tools/route.ts` returns `toOpenAITools(TOOLS)` — i.e. **all** tools are exposed to voice.

### The gap

There is **no client-side execution path**. Every tool call goes to the server. So any action that must run *in the browser* is impossible today:

| User says | Today |
|---|---|
| "Build a meal plan" | ✅ works (data: `plan_meal` / `build_nutrition_plan`) |
| "Regenerate the daily summary" | ⚠️ server regenerates data, but the on-screen widget never re-renders |
| "Open a quick link" / "Go to my finance page" | ❌ no tool, and no way to run a browser action |

There are currently **zero** UI/navigation tools in `TOOLS`, and neither `RealtimeVoice` nor `ChatInterface` has any client-side dispatch.

---

## 2. Solution overview

Introduce a **client-tool layer** alongside the existing server tools:

1. **Mark client tools** in the registry with a `clientTool: true` flag (and a separate list so the executor/route can tell them apart).
2. **A browser action bus** (`lib/client-actions.ts`) — a single `runClientTool(name, args, ctx)` function that performs browser actions: navigate (Next router), `window.open`, or dispatch a `CustomEvent` that widgets listen for.
3. **Branch the executor in `RealtimeVoice`** (and `ChatInterface` for text parity): if the called tool is a client tool, run `runClientTool(...)` locally and return its string result to the model; otherwise POST to `/api/tools/execute` exactly as today.
4. **Wire interactive widgets/modals to the bus** via `os:*` CustomEvents (e.g. `DailyBriefingWidget` listens for `os:regenerate-daily-summary` and re-fetches).

Scaling after the foundation = add a registry entry + (sometimes) one event listener. ~5 lines each.

---

## 3. Implementation

### Step 3.1 — Type: distinguish client tools

In `lib/chat-tools.ts`, add an exported set of client-tool names and a typed extension. Keep `TOOLS` as `Anthropic.Tool[]` so nothing downstream breaks (the `clientTool` flag is tracked separately, not on the Anthropic type).

```ts
// lib/chat-tools.ts

// Names of tools that execute in the BROWSER, not on the server.
// RealtimeVoice / ChatInterface dispatch these via lib/client-actions.ts
// instead of POSTing to /api/tools/execute.
export const CLIENT_TOOL_NAMES = new Set<string>([
  "navigate_to_page",
  "open_quick_link",
  "refresh_widget",
  "regenerate_daily_summary",
  "switch_dashboard_tab",
  "open_quick_capture",
  "start_focus_timer",
]);

export const isClientTool = (name: string) => CLIENT_TOOL_NAMES.has(name);
```

### Step 3.2 — Add the client tool definitions to `TOOLS`

Append these to the `TOOLS` array (anywhere before the closing `]`). Keep descriptions tight and voice-friendly. The route enum for `navigate_to_page` is the full set of pages under `app/(pages)`:

`achievements, bible, calendar, chat, constitution, content, dashboard, decisions, discord, drive, finance, focus, gmail, goals, habits, health, journal, life-context, meal-planner, media, memory, news, nutrition, people, projects, reading, season, settings, share, tasks, time, weather, workout`

```ts
  // ── Client / UI actions (executed in the browser) ──
  {
    name: "navigate_to_page",
    description: "Open / navigate to a page in the app. Use when the user says 'go to', 'open', 'show me' a section.",
    input_schema: {
      type: "object" as const,
      properties: {
        page: {
          type: "string",
          enum: [
            "achievements","bible","calendar","chat","constitution","content","dashboard",
            "decisions","discord","drive","finance","focus","gmail","goals","habits","health",
            "journal","life-context","meal-planner","media","memory","news","nutrition","people",
            "projects","reading","season","settings","share","tasks","time","weather","workout",
          ],
          description: "Which page to open.",
        },
      },
      required: ["page"],
    },
  },
  {
    name: "open_quick_link",
    description: "Open one of the user's saved Quick Links by its title (e.g. 'open my bank link'). Opens in a new tab.",
    input_schema: {
      type: "object" as const,
      properties: {
        title_search: { type: "string", description: "Partial title of the quick link to match." },
      },
      required: ["title_search"],
    },
  },
  {
    name: "refresh_widget",
    description: "Refresh / reload a dashboard widget that is on screen so it shows the latest data.",
    input_schema: {
      type: "object" as const,
      properties: {
        widget: { type: "string", description: "Widget key, e.g. 'daily-briefing', 'weather', 'finance', 'news', 'mood', 'hydration'." },
      },
      required: ["widget"],
    },
  },
  {
    name: "regenerate_daily_summary",
    description: "Regenerate the Daily Briefing / daily summary and refresh it on screen.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "switch_dashboard_tab",
    description: "Switch the active tab/section on the dashboard.",
    input_schema: {
      type: "object" as const,
      properties: { tab: { type: "string", description: "Tab name to activate." } },
      required: ["tab"],
    },
  },
  {
    name: "open_quick_capture",
    description: "Open the quick-capture modal so the user can jot something down.",
    input_schema: {
      type: "object" as const,
      properties: { text: { type: "string", description: "Optional prefilled text." } },
      required: [],
    },
  },
  {
    name: "start_focus_timer",
    description: "Start a focus session / focus timer.",
    input_schema: {
      type: "object" as const,
      properties: { minutes: { type: "number", description: "Optional length in minutes." } },
      required: [],
    },
  },
```

> NOTE: `toOpenAITools` passes these through unchanged, so they automatically reach the Realtime session via `/api/realtime/tools`. No change needed there.

### Step 3.3 — The browser action bus: `lib/client-actions.ts` (NEW FILE)

```ts
// lib/client-actions.ts
// Executes "client tools" in the browser. Returns a short string for the model.
"use client";

type Ctx = {
  navigate: (path: string) => void;            // from next/navigation useRouter().push
  getQuickLinks: () => { title: string; url: string }[];
};

export async function runClientTool(
  name: string,
  args: Record<string, unknown>,
  ctx: Ctx,
): Promise<string> {
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
      window.dispatchEvent(new CustomEvent("os:regenerate-daily-summary"));
      return "Regenerating the daily summary.";
    }

    case "refresh_widget": {
      const widget = String(args.widget ?? "");
      window.dispatchEvent(new CustomEvent("os:refresh-widget", { detail: { widget } }));
      return `Refreshed the ${widget} widget.`;
    }

    case "switch_dashboard_tab": {
      const tab = String(args.tab ?? "");
      window.dispatchEvent(new CustomEvent("os:switch-dashboard-tab", { detail: { tab } }));
      return `Switched to ${tab}.`;
    }

    case "open_quick_capture": {
      window.dispatchEvent(new CustomEvent("os:open-quick-capture", { detail: { text: args.text ?? "" } }));
      return "Opened quick capture.";
    }

    case "start_focus_timer": {
      window.dispatchEvent(new CustomEvent("os:start-focus-timer", { detail: { minutes: args.minutes } }));
      return "Started a focus session.";
    }

    default:
      return `Unknown client tool: ${name}`;
  }
}
```

### Step 3.4 — Branch the dispatch in `RealtimeVoice.tsx`

In `components/chat/RealtimeVoice.tsx`:

1. Add imports + hooks at the top of the component:
   ```ts
   import { useRouter } from "next/navigation";
   import { isClientTool } from "@/lib/chat-tools";
   import { runClientTool } from "@/lib/client-actions";
   import { useQuickLinks } from "@/hooks/useQuickLinks";
   // ...
   const router = useRouter();
   const { links } = useQuickLinks();
   ```
   Keep `links` available to the handler via a ref so the `useCallback` closure stays current:
   ```ts
   const linksRef = useRef(links);
   useEffect(() => { linksRef.current = links; }, [links]);
   ```

2. In `handleMessage`, replace the body of `case "response.function_call_arguments.done"` so it branches before the fetch:
   ```ts
   case "response.function_call_arguments.done": {
     let toolResult: string;
     const toolName = msg.name as string;
     const toolArgs = JSON.parse(msg.arguments as string) as Record<string, unknown>;
     try {
       if (isClientTool(toolName)) {
         toolResult = await runClientTool(toolName, toolArgs, {
           navigate: (p) => router.push(p),
           getQuickLinks: () => linksRef.current.map((l) => ({ title: l.title, url: l.url })),
         });
       } else {
         const freshToken = await user!.getIdToken();
         const res = await fetch("/api/tools/execute", {
           method: "POST",
           headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshToken}` },
           body: JSON.stringify({ name: toolName, arguments: toolArgs }),
         });
         const data = await res.json() as { result?: string; error?: string };
         toolResult = data.result ?? data.error ?? "done";
       }
     } catch (err) {
       toolResult = err instanceof Error ? err.message : "tool error";
     }
     ws.send(JSON.stringify({
       type: "conversation.item.create",
       item: { type: "function_call_output", call_id: msg.call_id, output: toolResult },
     }));
     ws.send(JSON.stringify({ type: "response.create" }));
     break;
   }
   ```
   Add `router` to the `handleMessage` `useCallback` dependency array (and `startSession`'s, which depends on `handleMessage`).

### Step 3.5 — Guard the server route against client tools

In `app/api/tools/execute/route.ts`, reject client tools (they should never reach the server). After the `VALID_TOOL_NAMES` check:

```ts
import { isClientTool } from "@/lib/chat-tools";
// ...
if (isClientTool(name)) {
  return NextResponse.json({ error: "Client tool cannot run on server" }, { status: 400 });
}
```

### Step 3.6 — Wire the first widget: `DailyBriefingWidget`

`components/dashboard/DailyBriefingWidget.tsx` already has a `generating` state and a regenerate handler that POSTs to `/api/daily-briefing`. Extract that handler (call it `regenerate`) if it isn't already standalone, then add a listener:

```ts
useEffect(() => {
  const onRegen = () => { void regenerate(); };
  window.addEventListener("os:regenerate-daily-summary", onRegen);
  return () => window.removeEventListener("os:regenerate-daily-summary", onRegen);
}, [regenerate]); // ensure `regenerate` is stable (useCallback) or include correct deps
```

Optionally also handle the generic refresh:
```ts
const onRefresh = (e: Event) => {
  if ((e as CustomEvent).detail?.widget === "daily-briefing") void regenerate();
};
window.addEventListener("os:refresh-widget", onRefresh);
```

---

## 4. Text-chat parity (optional, same gap)

`components/chat/ChatInterface.tsx` has no client-side tool dispatch either. The text chat executes tools server-side (via `/api/chat`). To get the same UI powers in text chat, the streaming chat handler must surface tool calls to the client for client tools. Simplest approach: when the assistant calls a `isClientTool` tool, have the client run `runClientTool(...)` (same `ctx`) and feed the result back into the conversation, mirroring the voice branch. Do this **after** the voice slice is proven.

---

## 5. Phased plan

**Phase 1 — Foundation + proof (do first):**
- Steps 3.1–3.6.
- Ships: `navigate_to_page` (all 33 routes), `open_quick_link`, `regenerate_daily_summary`, `refresh_widget`.
- Acceptance: voice "go to finance" navigates; "open my \<x\> link" opens the tab; "regenerate the daily summary" visibly refreshes the widget.

**Phase 2 — Cover remaining manual UI actions.** For each, add a registry entry (3.2), a `runClientTool` case (3.3), and a widget/modal listener if needed:
- `open_quick_capture` → `components/capture/QuickCaptureModal.tsx`
- `start_focus_timer` → `components/focus/FocusTimer.tsx` / `MiniFocusBar.tsx`
- `switch_dashboard_tab` → dashboard tab state
- Per-widget refresh for: weather, news, mood, hydration, finance, savings, debt, spending-trends, insights, what-matters, email-agent, etc. (one shared `os:refresh-widget` listener per widget keyed by `detail.widget`).
- Any other on-screen button you can press manually → expose as a client tool.

**Phase 3 — Text-chat parity** (section 4).

**Phase 4 — Hardening:**
- Spoken confirmation before irreversible tools (`trash_email`, `send_email`, `delete_*`).
- Consider trimming/grouping the now-larger tool list if Realtime tool-selection accuracy degrades (170+ tools is a lot of context for one session).

---

## 6. Conventions & gotchas

- This is **Next.js App Router** — navigation is `useRouter().push("/route")` from `next/navigation`, not `next/router`.
- `runClientTool` and the bus are **client-only**. The file is `"use client"`; all handlers touch `window`. Never import it into a server route.
- CustomEvents are the decoupling layer: a tool dispatches, the widget that happens to be mounted reacts. If the relevant widget isn't on screen, the action no-ops gracefully — that's acceptable (consider navigating first, e.g. `regenerate_daily_summary` could `router.push("/dashboard")` before dispatching if you want it to always work).
- Keep `runClientTool` return strings short and natural — the model reads them aloud ("Opened the finance page.").
- Don't add the `clientTool` flag onto the `Anthropic.Tool` objects themselves (type mismatch); use the `CLIENT_TOOL_NAMES` set as the source of truth, consumed by both the client branch and the server guard.
- After adding tools, no change is needed in `/api/realtime/tools` or `toOpenAITools` — they pass everything through.

---

## 7. Files touched (summary)

| File | Change |
|---|---|
| `lib/chat-tools.ts` | Add `CLIENT_TOOL_NAMES` + `isClientTool`; append client tool defs to `TOOLS`. |
| `lib/client-actions.ts` | **New.** `runClientTool(name, args, ctx)` browser dispatcher. |
| `components/chat/RealtimeVoice.tsx` | Add router + quick-links; branch function-call handler on `isClientTool`. |
| `app/api/tools/execute/route.ts` | Reject client tools server-side. |
| `components/dashboard/DailyBriefingWidget.tsx` | Listen for `os:regenerate-daily-summary` / `os:refresh-widget`. |
| (Phase 2) various widgets/modals | Add `os:*` CustomEvent listeners. |
| (Phase 3) `components/chat/ChatInterface.tsx` | Mirror the client-tool branch for text chat. |

**Acceptance for Phase 1:** With the app open, start a voice session and verify each of these by speaking: "go to the workout page", "open my \<quick-link-title\>", "regenerate the daily summary". All three should act on the UI, and the agent should speak the confirmation string.
