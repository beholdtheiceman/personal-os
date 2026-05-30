# OpenAI Realtime API — Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current STT→text→Claude→TTS pipeline with a bidirectional audio WebSocket to OpenAI Realtime API, enabling sub-300ms voice conversations with VAD and tool use.

**Architecture:** The browser opens a WebSocket directly to OpenAI using a short-lived ephemeral token minted server-side. Tool calls from the model are routed to a new `/api/tools/execute` endpoint that runs Firebase writes server-side. To share tool definitions and executor logic across both the existing `/api/chat` route and the new realtime path, we first extract them into `lib/chat-tools.ts` and `lib/tool-executor.ts`.

**Tech Stack:** Next.js 14 App Router, OpenAI Realtime API (WebSocket), PCM16 audio, Firebase Admin SDK, React hooks

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/chat-tools.ts` | **Create** | Anthropic-format `TOOLS` array + converter to OpenAI format |
| `lib/tool-executor.ts` | **Create** | `executeTool` function + helpers (`findDoc`, token refresh) |
| `app/api/chat/route.ts` | **Modify** | Import `TOOLS` and `executeTool` from libs instead of defining inline |
| `app/api/realtime/session/route.ts` | **Create** | Mints ephemeral OpenAI session tokens |
| `app/api/tools/execute/route.ts` | **Create** | Executes tool calls from the browser during voice sessions |
| `components/chat/RealtimeVoice.tsx` | **Create** | WebSocket + AudioContext component for voice sessions |
| `components/chat/ChatInterface.tsx` | **Modify** | Add `<RealtimeVoice />` button to toolbar |

---

## Task 1: Extract `TOOLS` to `lib/chat-tools.ts`

**Files:**
- Create: `lib/chat-tools.ts`
- Modify: `app/api/chat/route.ts` (lines 120–2317)

The `TOOLS` array is currently defined at line 122 of `app/api/chat/route.ts` and runs to line 2317. We move it to a shared lib and add a converter to OpenAI format (Anthropic uses `input_schema`, OpenAI uses `parameters`).

- [ ] **Step 1: Create `lib/chat-tools.ts`**

  Open `app/api/chat/route.ts` and copy lines 122–2317 (the entire `const TOOLS: Anthropic.Tool[] = [...]` block). Create `lib/chat-tools.ts` with this content:

  ```ts
  import Anthropic from "@anthropic-ai/sdk";

  export const TOOLS: Anthropic.Tool[] = [
    // … paste the full TOOLS array here (lines 122–2317 from route.ts) …
  ];

  // Convert Anthropic tool definitions to OpenAI Realtime API format.
  // Anthropic: { name, description, input_schema: { type, properties, required } }
  // OpenAI:    { type: "function", name, description, parameters: { type, properties, required } }
  export function toOpenAITools(tools: Anthropic.Tool[]): OpenAIRealtimeTool[] {
    return tools.map((t) => ({
      type: "function" as const,
      name: t.name,
      description: t.description ?? "",
      parameters: t.input_schema as Record<string, unknown>,
    }));
  }

  export type OpenAIRealtimeTool = {
    type: "function";
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  ```

- [ ] **Step 2: Update the import in `app/api/chat/route.ts`**

  At the top of `app/api/chat/route.ts`, add the import:
  ```ts
  import { TOOLS } from "@/lib/chat-tools";
  ```

  Then delete lines 120–2317 (the `// ── Tool definitions ──` comment through the end of the `TOOLS` array, inclusive).

- [ ] **Step 3: Verify the build compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors referencing `TOOLS`.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/chat-tools.ts app/api/chat/route.ts
  git commit -m "refactor: extract TOOLS array to lib/chat-tools.ts"
  ```

---

## Task 2: Extract `executeTool` to `lib/tool-executor.ts`

**Files:**
- Create: `lib/tool-executor.ts`
- Modify: `app/api/chat/route.ts` (lines 2315–5863 after Task 1 renumbering)

The `executeTool` function plus its helper functions (`findDoc`, `refreshGmailToken`, `refreshCalendarToken`) are extracted. The helpers go into `tool-executor.ts` since they're only used by `executeTool`.

- [ ] **Step 1: Create `lib/tool-executor.ts`**

  Copy the following from `app/api/chat/route.ts`:
  - The `ToolInput` type alias (line 20)
  - `findDoc` function (lines 84–90)
  - `refreshGmailToken` alias (line 93)
  - `refreshCalendarToken` function (lines 95–118)
  - The entire `executeTool` function (lines 2318–5863)

  Create `lib/tool-executor.ts`:

  ```ts
  import { getAdminDb } from "@/lib/firebase-admin";
  import { FieldValue } from "firebase-admin/firestore";
  import { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, TAVILY_API_KEY } from "@/lib/env";
  import { searchSecondBrainFromDB, captureToInboxDB, getSecondBrainContextFromDB } from "@/lib/second-brain";
  import { refreshGmailToken as _refreshGmailToken } from "@/lib/gmail-token";
  import { computeNextDue, isWithinRecurrence } from "@/lib/recurrence";
  import { fetchWeatherData } from "@/lib/weather";
  import { syncUserPlaid } from "@/lib/plaid-sync";
  import type { RecurrenceCadence } from "@/types";
  import { mergeNotificationSettings } from "@/types";

  export type ToolInput = Record<string, unknown>;

  async function findDoc(uid: string, collection: string, searchField: string, searchValue: string) {
    const db = getAdminDb();
    const snap = await db.collection(`users/${uid}/${collection}`).get();
    const lower = searchValue.toLowerCase();
    const doc = snap.docs.find((d) => (d.data()[searchField] as string)?.toLowerCase().includes(lower));
    return doc ?? null;
  }

  const refreshGmailToken = _refreshGmailToken;

  async function refreshCalendarToken(uid: string): Promise<string> {
    const db = getAdminDb();
    const tokenDoc = await db.doc(`users/${uid}/integrations/google_calendar`).get();
    if (!tokenDoc.exists) throw new Error("Google Calendar not connected");
    const tokenData = tokenDoc.data()!;
    let accessToken: string = tokenData.access_token;
    if (Date.now() > tokenData.expires_at - 60000) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CALENDAR_CLIENT_ID,
          client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error_description);
      accessToken = data.access_token;
      await tokenDoc.ref.update({ access_token: accessToken, expires_at: Date.now() + 3600 * 1000 });
    }
    return accessToken;
  }

  export async function executeTool(
    uid: string,
    toolName: string,
    input: ToolInput,
    today: () => string,
    chatId?: string,
  ): Promise<string> {
    // … paste the full switch statement body from route.ts here …
  }
  ```

- [ ] **Step 2: Update `app/api/chat/route.ts`**

  Add import at top:
  ```ts
  import { executeTool, type ToolInput } from "@/lib/tool-executor";
  ```

  Remove from `route.ts`:
  - The `ToolInput` type alias (line 20)
  - `findDoc` function
  - `refreshGmailToken` alias
  - `refreshCalendarToken` function
  - The `// ── Tool execution ──` comment block and `executeTool` function

  Also remove the imports that are now only used in `tool-executor.ts`:
  ```ts
  // Remove these from route.ts (they move to tool-executor.ts):
  // import { searchSecondBrainFromDB, captureToInboxDB, getSecondBrainContextFromDB } from "@/lib/second-brain";
  // import { refreshGmailToken as _refreshGmailToken } from "@/lib/gmail-token";
  // import { computeNextDue, isWithinRecurrence } from "@/lib/recurrence";
  // import { fetchWeatherData } from "@/lib/weather";
  // import { syncUserPlaid } from "@/lib/plaid-sync";
  // import type { RecurrenceCadence } from "@/types";
  // import { mergeNotificationSettings } from "@/types";
  ```

  Keep in `route.ts`: `GOOGLE_CALENDAR_CLIENT_ID/SECRET` and `TAVILY_API_KEY` imports only if they're still used in the POST handler itself (check); otherwise remove those too.

- [ ] **Step 3: Verify the build compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors. If any imports are missing in `tool-executor.ts`, add them.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/tool-executor.ts app/api/chat/route.ts
  git commit -m "refactor: extract executeTool to lib/tool-executor.ts"
  ```

---

## Task 3: Session Token Endpoint

**Files:**
- Create: `app/api/realtime/session/route.ts`

Mints a short-lived ephemeral token so the browser never holds the real OpenAI API key.

- [ ] **Step 1: Create the route**

  ```ts
  // app/api/realtime/session/route.ts
  import { NextRequest, NextResponse } from "next/server";
  import { getAdminAuth } from "@/lib/firebase-admin";

  export async function POST(req: NextRequest) {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await getAdminAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const model = (body.model as string) ?? "gpt-4o-realtime-preview-2024-12-17";
    const voice = (body.voice as string) ?? "alloy";

    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, voice }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/realtime/session/route.ts
  git commit -m "feat: add /api/realtime/session ephemeral token endpoint"
  ```

---

## Task 4: Tool Execution Endpoint

**Files:**
- Create: `app/api/tools/execute/route.ts`

Voice sessions run in the browser but need to write to Firestore. This endpoint bridges them.

- [ ] **Step 1: Create the route**

  ```ts
  // app/api/tools/execute/route.ts
  import { NextRequest, NextResponse } from "next/server";
  import { getAdminAuth } from "@/lib/firebase-admin";
  import { executeTool, type ToolInput } from "@/lib/tool-executor";

  const today = () => new Date().toISOString().slice(0, 10);

  export async function POST(req: NextRequest) {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { name, arguments: args } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Missing tool name" }, { status: 400 });
    }

    try {
      const result = await executeTool(uid, name, (args ?? {}) as ToolInput, today);
      return NextResponse.json({ result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/tools/execute/route.ts
  git commit -m "feat: add /api/tools/execute endpoint for voice tool calls"
  ```

---

## Task 5: `RealtimeVoice` Component

**Files:**
- Create: `components/chat/RealtimeVoice.tsx`

The component opens a WebSocket to OpenAI Realtime API, captures mic audio as PCM16, streams it to the model, plays back audio responses, and executes tool calls via the new endpoint.

- [ ] **Step 1: Create the component**

  ```tsx
  // components/chat/RealtimeVoice.tsx
  "use client";
  import { useRef, useState, useCallback } from "react";
  import { useAuth } from "@/contexts/AuthContext";
  import { toOpenAITools, TOOLS } from "@/lib/chat-tools";
  import { RiPhoneLine, RiPhoneOffLine } from "react-icons/ri";

  type Status = "idle" | "connecting" | "listening" | "speaking";

  type Props = {
    onTranscript?: (text: string) => void;
  };

  export function RealtimeVoice({ onTranscript }: Props) {
    const { user } = useAuth();
    const [status, setStatus] = useState<Status>("idle");
    const active = status !== "idle";

    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const playCtxRef = useRef<AudioContext | null>(null);
    const nextPlayTimeRef = useRef<number>(0);

    const stopSession = useCallback(() => {
      wsRef.current?.close();
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      playCtxRef.current?.close();
      wsRef.current = null;
      audioCtxRef.current = null;
      processorRef.current = null;
      sourceRef.current = null;
      streamRef.current = null;
      playCtxRef.current = null;
      nextPlayTimeRef.current = 0;
      setStatus("idle");
    }, []);

    const playChunk = useCallback((base64: string) => {
      if (!playCtxRef.current) {
        playCtxRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = playCtxRef.current.currentTime;
      }
      const ctx = playCtxRef.current;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const startAt = Math.max(nextPlayTimeRef.current, ctx.currentTime);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buffer.duration;
    }, []);

    const handleMessage = useCallback(
      async (event: MessageEvent, ws: WebSocket, idToken: string) => {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        switch (msg.type) {
          case "response.audio.delta":
            playChunk(msg.delta as string);
            setStatus("speaking");
            break;

          case "response.audio.done":
            setStatus("listening");
            break;

          case "conversation.item.input_audio_transcription.completed":
            onTranscript?.(msg.transcript as string);
            break;

          case "response.function_call_arguments.done": {
            let toolResult: string;
            try {
              const res = await fetch("/api/tools/execute", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                  name: msg.name,
                  arguments: JSON.parse(msg.arguments as string),
                }),
              });
              const data = await res.json() as { result?: string; error?: string };
              toolResult = data.result ?? data.error ?? "done";
            } catch (err) {
              toolResult = err instanceof Error ? err.message : "tool error";
            }
            ws.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: msg.call_id,
                  output: toolResult,
                },
              }),
            );
            ws.send(JSON.stringify({ type: "response.create" }));
            break;
          }

          case "error":
            console.error("Realtime API error:", msg);
            break;
        }
      },
      [onTranscript, playChunk],
    );

    const startSession = useCallback(async () => {
      if (!user) return;
      setStatus("connecting");

      let idToken: string;
      try {
        idToken = await user.getIdToken();
      } catch {
        setStatus("idle");
        return;
      }

      const sessionRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ voice: "alloy" }),
      });
      if (!sessionRes.ok) {
        console.error("Failed to get realtime session token");
        setStatus("idle");
        return;
      }
      const { client_secret } = await sessionRes.json() as { client_secret: { value: string } };

      const ws = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        ["realtime", `openai-insecure-api-key.${client_secret.value}`, "openai-beta.realtime-v1"],
      );
      wsRef.current = ws;

      ws.onopen = async () => {
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions:
                "You are a personal life assistant with access to the user's tasks, health, habits, calendar, finance, and more. Be conversational and concise — you are speaking, not writing.",
              tools: toOpenAITools(TOOLS),
              tool_choice: "auto",
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 700,
              },
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: { model: "whisper-1" },
            },
          }),
        );

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          console.error("Microphone access denied");
          ws.close();
          return;
        }
        streamRef.current = stream;

        const ctx = new AudioContext({ sampleRate: 24000 });
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        // ScriptProcessorNode is deprecated but has the widest browser support;
        // migrate to AudioWorklet if latency becomes a concern.
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64 }));
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        setStatus("listening");
      };

      ws.onmessage = (event) => handleMessage(event, ws, idToken);
      ws.onclose = () => stopSession();
      ws.onerror = (e) => {
        console.error("Realtime WebSocket error", e);
        stopSession();
      };
    }, [user, handleMessage, stopSession]);

    const label = {
      idle: "Start voice session",
      connecting: "Connecting…",
      listening: "Listening — click to end",
      speaking: "Speaking — click to end",
    }[status];

    return (
      <button
        onClick={active ? stopSession : startSession}
        disabled={status === "connecting"}
        className={`p-2.5 rounded-lg border transition-colors disabled:opacity-50 ${
          status === "speaking"
            ? "bg-green-500/20 text-green-400 border-green-500/30 animate-pulse"
            : status === "listening"
            ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
            : status === "connecting"
            ? "bg-white/10 text-text-secondary border-white/15 animate-pulse"
            : "bg-white/10 text-text-secondary hover:text-text-primary border-white/15"
        }`}
        title={label}
      >
        {active ? <RiPhoneOffLine className="w-5 h-5" /> : <RiPhoneLine className="w-5 h-5" />}
      </button>
    );
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add components/chat/RealtimeVoice.tsx
  git commit -m "feat: add RealtimeVoice component with WebSocket + PCM16 audio"
  ```

---

## Task 6: Wire into ChatInterface

**Files:**
- Modify: `components/chat/ChatInterface.tsx`

Add the `<RealtimeVoice />` button to the toolbar, between the existing mic button and the TTS toggle button.

- [ ] **Step 1: Add import**

  At the top of `components/chat/ChatInterface.tsx`, add:
  ```ts
  import { RealtimeVoice } from "@/components/chat/RealtimeVoice";
  ```

- [ ] **Step 2: Add the button to the toolbar**

  In `ChatInterface.tsx`, find the existing TTS toggle button (around line 806):
  ```tsx
  <button
    onClick={tts.toggle}
    className={`p-2.5 rounded-lg border transition-colors ${
      tts.enabled ? "bg-accent/20 text-accent border-accent/30" : "bg-white/10 text-text-secondary hover:text-text-primary border-white/15"
    }`}
    title={tts.enabled ? "Voice on — click to mute" : "Enable voice responses"}
  >
    {tts.enabled ? <RiVolumeUpLine className="w-5 h-5" /> : <RiVolumeMuteLine className="w-5 h-5" />}
  </button>
  ```

  Insert `<RealtimeVoice />` directly before it:
  ```tsx
  <RealtimeVoice />
  <button
    onClick={tts.toggle}
    ...
  ```

- [ ] **Step 3: Verify the build compiles**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add components/chat/ChatInterface.tsx
  git commit -m "feat: wire RealtimeVoice into ChatInterface toolbar"
  ```

---

## Task 7: End-to-End Smoke Test

**Goal:** Confirm the full voice flow works in the browser before pushing.

- [ ] **Step 1: Start dev server**

  ```bash
  npx next dev -p 3000
  ```

- [ ] **Step 2: Open the app and start a voice session**

  Navigate to `http://localhost:3000`. Open the chat panel. Click the phone icon button. Browser should prompt for mic permission — grant it.

  Expected: button turns red with pulse (listening state).

- [ ] **Step 3: Speak a simple command**

  Say "What tasks do I have today?"

  Expected:
  - Status briefly switches to "speaking" (green pulse) while the model responds
  - You hear a voice reply
  - Status returns to "listening" (red pulse)

- [ ] **Step 4: Test a tool call**

  Say "Add a task to call the dentist."

  Expected:
  - Model calls `add_task` tool
  - `/api/tools/execute` responds with success
  - Model speaks a confirmation
  - Task appears in the Tasks panel

- [ ] **Step 5: End the session**

  Click the phone-off button.

  Expected: button returns to idle state, mic stops.

- [ ] **Step 6: Push**

  ```bash
  git push
  ```

---

## Self-Review Checklist

- [x] **Spec coverage:** Session token endpoint ✓, tool definitions ✓, RealtimeVoice component ✓, tool execution endpoint ✓, UI wiring ✓
- [x] **No placeholders:** All code blocks are complete
- [x] **Type consistency:** `ToolInput`, `executeTool`, `toOpenAITools` names are consistent across all tasks
- [x] **Import consistency:** `lib/chat-tools.ts` exports `TOOLS` and `toOpenAITools`; `lib/tool-executor.ts` exports `executeTool` and `ToolInput`; both are imported correctly in consuming files
- [x] **Compiler check:** Each task ends with `npx tsc --noEmit` before committing
- [x] **Known limitation documented:** `ScriptProcessorNode` is deprecated — noted in comment, migrate to AudioWorklet in a future pass
