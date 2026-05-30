"use client";
import { useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toOpenAITools, TOOLS } from "@/lib/chat-tools";
import { RiPhoneLine, RiPhoneFill } from "react-icons/ri";

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
    const ws = wsRef.current;
    if (!ws) return;           // already stopped — idempotent guard
    wsRef.current = null;      // null immediately to prevent re-entry
    ws.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    playCtxRef.current?.close();
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
    async (event: MessageEvent, ws: WebSocket) => {
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
            const freshToken = await user!.getIdToken();
            const res = await fetch("/api/tools/execute", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${freshToken}`,
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
    [onTranscript, playChunk, user],
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
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64 }));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      setStatus("listening");
    };

    ws.onmessage = (event) => handleMessage(event, ws);
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
      {active ? <RiPhoneFill className="w-5 h-5" /> : <RiPhoneLine className="w-5 h-5" />}
    </button>
  );
}
