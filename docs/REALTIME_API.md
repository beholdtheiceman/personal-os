# OpenAI Realtime API — Implementation Guide

## Overview

Replace the current Web Speech API → text → Claude pipeline with a true bidirectional audio WebSocket connection via OpenAI's Realtime API. This enables low-latency spoken conversations, natural interruptions, VAD (voice activity detection), and function calling mid-speech.

**Estimated effort:** 3–5 days  
**Dependencies:** `OPENAI_API_KEY`, refactored `lib/chat-tools.ts` (see `TRANSCRIPT_INGESTION.md`)  
**Model:** GPT-4o Realtime (note: this replaces Claude for voice sessions only — text chat stays on Claude)

---

## Architecture

```
Browser                          Server                    OpenAI
───────                          ──────                    ──────
RealtimeVoice.tsx
  │
  ├─ POST /api/realtime/session ──────────────────────────► Creates ephemeral token
  │                             ◄──────────────────────────  Returns { token, session_id }
  │
  └─ WebSocket (wss://api.openai.com/v1/realtime) ────────► Direct connection using token
       │
       ├─ Audio chunks (PCM16) ──────────────────────────►  GPT-4o processes audio
       ◄─ Audio response + transcript ◄──────────────────   Speaks back + fires tools
       │
       └─ Tool calls ──────────────────────────────────────► Client executes via /api/chat tools
                      ◄──────────────────────────────────── Tool results sent back
```

---

## Step 1: Session Token Endpoint

The browser never holds your OpenAI API key. The server mints a short-lived session token.

### `app/api/realtime/session/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await getAdminAuth().verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { model = "gpt-4o-realtime-preview-2024-12-17", voice = "alloy" } = await req.json();

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice, // alloy | echo | fable | onyx | nova | shimmer
    }),
  });

  const data = await res.json();
  return NextResponse.json(data); // { id, client_secret: { value, expires_at }, ... }
}
```

---

## Step 2: Tool Definitions for Realtime

The Realtime API uses the same function-calling schema as the standard API. Once you've extracted `lib/chat-tools.ts`, pass those definitions when configuring the session:

```ts
// When sending session.update after connecting:
{
  type: "session.update",
  session: {
    instructions: "You are a personal life assistant with access to the user's tasks, health, habits, calendar, finance, and more. Be conversational and concise — you're speaking, not writing.",
    tools: ALL_TOOLS, // from lib/chat-tools.ts, same format
    tool_choice: "auto",
    turn_detection: {
      type: "server_vad", // voice activity detection — no button needed
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 700,
    },
    input_audio_format: "pcm16",
    output_audio_format: "pcm16",
    input_audio_transcription: { model: "whisper-1" }, // get text transcript too
  }
}
```

---

## Step 3: RealtimeVoice Component

### `components/chat/RealtimeVoice.tsx`

```tsx
"use client";
import { useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { RiMicLine, RiMicOffLine } from "react-icons/ri";

type RealtimeVoiceProps = {
  mode?: "push-to-talk" | "vad"; // vad = always listening within session
  onTranscript?: (text: string) => void;
  onToolCall?: (name: string, result: unknown) => void;
};

export function RealtimeVoice({ mode = "vad", onTranscript, onToolCall }: RealtimeVoiceProps) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "listening" | "speaking">("idle");
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startSession = useCallback(async () => {
    if (!user) return;
    setStatus("connecting");

    // 1. Get ephemeral token
    const idToken = await user.getIdToken();
    const sessionRes = await fetch("/api/realtime/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ voice: "alloy" }),
    });
    const { client_secret } = await sessionRes.json();

    // 2. Open WebSocket directly to OpenAI
    const ws = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
      ["realtime", `openai-insecure-api-key.${client_secret.value}`, "openai-beta.realtime-v1"]
    );
    wsRef.current = ws;

    ws.onopen = async () => {
      // Configure the session
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          instructions: "You are a personal life assistant. Be concise — you are speaking.",
          tools: [], // inject from lib/chat-tools.ts
          tool_choice: "auto",
          turn_detection: mode === "vad"
            ? { type: "server_vad", threshold: 0.5, silence_duration_ms: 700 }
            : { type: "none" }, // push-to-talk: manual commit
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: { model: "whisper-1" },
        }
      }));

      // 3. Start capturing mic audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor captures raw PCM and sends to WebSocket
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPcm16(float32);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64 }));
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      setStatus("listening");
      setActive(true);
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      await handleServerEvent(msg, ws, idToken);
    };

    ws.onclose = () => {
      setStatus("idle");
      setActive(false);
    };
  }, [user, mode]);

  const handleServerEvent = async (msg: Record<string, unknown>, ws: WebSocket, idToken: string) => {
    switch (msg.type) {
      case "response.audio.delta": {
        // Play audio chunk
        const audioData = base64ToFloat32(msg.delta as string);
        playAudioChunk(audioData);
        setStatus("speaking");
        break;
      }
      case "response.audio.done":
        setStatus("listening");
        break;

      case "conversation.item.input_audio_transcription.completed":
        onTranscript?.(msg.transcript as string);
        break;

      case "response.function_call_arguments.done": {
        // Execute tool call on your server (which has Firebase access)
        const result = await fetch("/api/tools/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ name: msg.name, arguments: JSON.parse(msg.arguments as string) }),
        });
        const toolResult = await result.json();
        onToolCall?.(msg.name as string, toolResult);

        // Send result back to the model
        ws.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: msg.call_id,
            output: JSON.stringify(toolResult),
          }
        }));
        ws.send(JSON.stringify({ type: "response.create" }));
        break;
      }
    }
  };

  const stopSession = useCallback(() => {
    wsRef.current?.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    setStatus("idle");
    setActive(false);
  }, []);

  return (
    <button
      onClick={active ? stopSession : startSession}
      className={`p-3 rounded-full border transition-all ${
        active
          ? status === "speaking"
            ? "bg-green-500/20 text-green-400 border-green-500/30 animate-pulse"
            : "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
          : "bg-white/10 text-text-secondary hover:text-text-primary border-white/15"
      }`}
      title={active ? "End voice session" : "Start voice session"}
    >
      {active ? <RiMicOffLine className="w-5 h-5" /> : <RiMicLine className="w-5 h-5" />}
    </button>
  );
}

// Helpers
function float32ToPcm16(float32: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    pcm16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  return pcm16;
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
  return float32;
}

// Simple audio playback queue (add proper AudioWorklet for production)
const audioQueue: Float32Array[] = [];
let isPlaying = false;
function playAudioChunk(data: Float32Array) {
  audioQueue.push(data);
  if (!isPlaying) drainQueue();
}
async function drainQueue() {
  if (!audioQueue.length) { isPlaying = false; return; }
  isPlaying = true;
  const ctx = new AudioContext({ sampleRate: 24000 });
  const data = audioQueue.shift()!;
  const buffer = ctx.createBuffer(1, data.length, 24000);
  buffer.getChannelData(0).set(data);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = drainQueue;
  source.start();
}
```

---

## Step 4: Tool Execution Endpoint

The Realtime client runs in the browser but needs to execute tools that write to Firestore (server-side). Add a thin executor route:

### `app/api/tools/execute/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { executeToolCall } from "@/lib/tool-executor"; // extracted from /api/chat

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { uid } = await getAdminAuth().verifyIdToken(token);
  const { name, arguments: args } = await req.json();
  const result = await executeToolCall(uid, name, args);
  return NextResponse.json(result);
}
```

---

## Step 5: Add to UI

Drop `<RealtimeVoice />` into `ChatInterface.tsx` next to the existing mic button, or add it to the chat panel header as a separate "Voice Mode" toggle. Consider making it full-screen on mobile when active.

---

## Translation Mode

To use as a real-time translator, change the session instructions when starting:

```ts
// Pass as a prop or state: translationMode: { enabled: boolean, targetLang: string }
const instructions = translationMode.enabled
  ? `You are a real-time interpreter. The user will speak in English. 
     Translate everything they say into ${translationMode.targetLang} and respond only in that language.
     When the user asks you to translate back, respond in English.
     Be natural and conversational.`
  : "You are a personal life assistant. Be concise — you are speaking.";
```

Add a language picker to the voice mode UI. See `TRANSLATION_MODE.md` for the full translation feature implementation.

---

## Cost Estimate

OpenAI Realtime API pricing (as of mid-2025):
- Audio input: ~$0.06 / minute
- Audio output: ~$0.24 / minute
- A 5-minute voice session ≈ $1.50

Consider adding a Realtime API usage tracker to the existing API Usage dashboard widget.

---

## Known Limitations

- **ScriptProcessorNode** is deprecated — for production, migrate to `AudioWorklet` for better performance
- **Audio queue** in the component above is simplified — a proper implementation uses a ring buffer
- **GPT-4o only** — voice sessions cannot use Claude; text chat still uses Claude as today
- **iOS Safari** may require additional handling for AudioContext creation after a user gesture
