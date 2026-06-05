"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { RiPhoneLine, RiPhoneFill, RiArrowDropDownLine } from "react-icons/ri";
import toast from "react-hot-toast";

type Status = "idle" | "connecting" | "listening" | "speaking";

type Props = {
  onTranscript?: (text: string) => void;
  compact?: boolean;
  float?: boolean;
};

const VOICES = [
  { id: "alloy",   label: "Alloy",   desc: "Neutral" },
  { id: "echo",    label: "Echo",    desc: "Clear, male" },
  { id: "fable",   label: "Fable",   desc: "Expressive" },
  { id: "onyx",    label: "Onyx",    desc: "Deep, male" },
  { id: "nova",    label: "Nova",    desc: "Bright, female" },
  { id: "shimmer", label: "Shimmer", desc: "Soft, female" },
  { id: "verse",   label: "Verse",   desc: "Conversational" },
  { id: "coral",   label: "Coral",   desc: "Warm, female" },
  { id: "sage",    label: "Sage",    desc: "Calm" },
  { id: "ash",     label: "Ash",     desc: "Crisp" },
  { id: "ballad",  label: "Ballad",  desc: "Melodic" },
] as const;

export function RealtimeVoice({ onTranscript, compact = false, float = false }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const active = status !== "idle";

  const [voice, setVoice] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("realtime-voice") ?? "alloy";
    }
    return "alloy";
  });
  const [showPicker, setShowPicker] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const stopSession = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;      // null immediately to prevent re-entry
    ws?.close();               // ws may be null if we failed before connecting (still clean up audio below)
    activeSourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* already ended */ } });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
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
    activeSourcesRef.current.push(src);
    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src);
    };
  }, []);

  const handleMessage = useCallback(
    async (event: MessageEvent, ws: WebSocket) => {
      const msg = JSON.parse(event.data as string) as Record<string, unknown>;
      switch (msg.type) {
        case "response.output_audio.delta":
          playChunk(msg.delta as string);
          setStatus("speaking");
          break;

        case "response.output_audio.done":
          setStatus("listening");
          break;

        case "input_audio_buffer.speech_started":
          // Stop every scheduled source node immediately so interruption is instant.
          activeSourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* already ended */ } });
          activeSourcesRef.current = [];
          nextPlayTimeRef.current = 0;
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
          console.error("Realtime API error:", JSON.stringify(msg.error ?? msg, null, 2));
          break;
      }
    },
    [onTranscript, playChunk, user],
  );

  const startSession = useCallback(async () => {
    setShowPicker(false);
    if (!user) return;
    setStatus("connecting");

    // iOS Safari/Chrome require getUserMedia + AudioContext to be created inside
    // the user gesture (this tap), BEFORE any async network round-trip. The old
    // code did this inside ws.onopen — after the socket connected — so iOS had
    // already lost user activation and rejected the mic, snapping the button
    // straight back to idle. Acquire the mic and prime both contexts up front.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      toast.error("Microphone is blocked. Allow mic access for this site, then tap the phone again.");
      setStatus("idle");
      return;
    }
    streamRef.current = stream;

    const inputCtx = new AudioContext({ sampleRate: 24000 });
    audioCtxRef.current = inputCtx;
    const playCtx = new AudioContext({ sampleRate: 24000 });
    playCtxRef.current = playCtx;
    nextPlayTimeRef.current = playCtx.currentTime;
    // Resume while still in the gesture — iOS starts AudioContexts suspended.
    try { await inputCtx.resume(); await playCtx.resume(); } catch { /* best effort */ }

    let idToken: string;
    try {
      idToken = await user.getIdToken();
    } catch {
      stopSession();
      return;
    }

    const sessionRes = await fetch("/api/realtime/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ voice }),
    });
    if (!sessionRes.ok) {
      toast.error("Couldn't start the voice session (server error).");
      stopSession();
      return;
    }
    const { client_secret } = await sessionRes.json() as { client_secret: { value: string } };

    const ws = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-realtime-1.5",
      ["realtime", `openai-insecure-api-key.${client_secret.value}`],
    );
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions:
              "You are a personal life assistant with access to the user's tasks, health, habits, calendar, finance, and more. Be conversational and concise — you are speaking, not writing.",
            output_modalities: ["audio"],
            audio: {
              input: {
                // Server VAD with a higher threshold + longer trailing silence so
                // ambient noise or the tail of the user's own speech doesn't trip a
                // false barge-in that cancels the model's reply (reason: turn_detected).
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.9,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 700,
                },
              },
              output: { voice: voice },
            },
          },
        }),
      );

      // Mic + context were already acquired in the gesture above (iOS requirement).
      const ctx = audioCtxRef.current;
      const activeStream = streamRef.current;
      if (!ctx || !activeStream) { stopSession(); return; }
      const source = ctx.createMediaStreamSource(activeStream);
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
  }, [user, voice, handleMessage, stopSession]);

  const label = {
    idle: "Start voice session",
    connecting: "Connecting…",
    listening: "Listening — click to end",
    speaking: "Speaking — click to end",
  }[status];

  return (
    <div ref={containerRef} className="relative flex items-center gap-0.5">
      {/* Voice dropdown */}
      {showPicker && (
        <div className={`absolute bottom-full mb-1 w-44 bg-[#1a1a2e] border border-white/15 rounded-lg shadow-xl z-50 py-1 overflow-hidden ${float ? "right-0" : "left-0"}`}>
          {VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setVoice(v.id);
                localStorage.setItem("realtime-voice", v.id);
                setShowPicker(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer hover:bg-white/10 transition-colors"
            >
              <span className="text-text-primary font-medium">{v.label}</span>
              <span className="text-text-secondary text-xs">{v.desc}</span>
              {voice === v.id && <span className="text-accent text-xs ml-1">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Phone button */}
      <button
        onClick={active ? stopSession : startSession}
        disabled={status === "connecting"}
        className={`transition-all disabled:opacity-50 flex items-center justify-center ${
          float
            ? `w-12 h-12 rounded-full shadow-lg hover:scale-105 active:scale-95 ${
                status === "speaking"
                  ? "bg-green-500 text-white shadow-green-500/40 animate-pulse"
                  : status === "listening"
                  ? "bg-red-500 text-white shadow-red-500/40 animate-pulse"
                  : status === "connecting"
                  ? "bg-accent/70 text-white animate-pulse"
                  : "bg-accent text-white shadow-accent/30 hover:bg-accent-hover"
              }`
            : `rounded-lg ${compact ? "p-1.5" : "p-2.5 border"} ${
                status === "speaking"
                  ? "bg-green-500/20 text-green-400 border-green-500/30 animate-pulse"
                  : status === "listening"
                  ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                  : status === "connecting"
                  ? "bg-white/10 text-text-secondary border-white/15 animate-pulse"
                  : "bg-white/10 text-text-secondary hover:text-text-primary border-white/15"
              }`
        }`}
        title={label}
      >
        {active
          ? <RiPhoneFill className={float ? "w-5 h-5" : compact ? "w-4 h-4" : "w-5 h-5"} />
          : <RiPhoneLine className={float ? "w-5 h-5" : compact ? "w-4 h-4" : "w-5 h-5"} />}
      </button>

      {/* Chevron — only when idle */}
      {!active && (
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors"
          title={`Voice: ${voice}`}
        >
          <RiArrowDropDownLine className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
