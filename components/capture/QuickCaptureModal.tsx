"use client";
import { useState, useRef } from "react";
import { useQuickCapture } from "@/contexts/QuickCaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

type State = "idle" | "recording" | "processing" | "results";

interface Results { summary: string; actions: string[] }

const CONTEXT_TYPES = [
  { id: "general_debrief", label: "General", emoji: "📝" },
  { id: "meeting", label: "Meeting", emoji: "🤝" },
  { id: "doctor_visit", label: "Doctor", emoji: "🏥" },
  { id: "workout_debrief", label: "Workout", emoji: "💪" },
  { id: "financial_conversation", label: "Finance", emoji: "💰" },
  { id: "relationship_debrief", label: "People", emoji: "👥" },
];

export default function QuickCaptureModal() {
  const { isOpen, close } = useQuickCapture();
  const { user } = useAuth();
  const [state, setState] = useState<State>("idle");
  const [contextType, setContextType] = useState("general_debrief");
  const [text, setText] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  async function getToken() {
    if (!user) throw new Error("Not authenticated");
    return (user as { getIdToken: () => Promise<string> }).getIdToken();
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("processing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("file", blob, "audio.webm");
          const token = await getToken();
          const res = await fetch("/api/transcribe", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
          const data = await res.json();
          if (data.text) setText((prev) => prev ? prev + " " + data.text : data.text);
        } catch {
          setError("Transcription failed. You can type your notes manually.");
        }
        setState("idle");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      setError("Microphone access denied.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function handleSubmit() {
    if (!text.trim()) { setError("Please enter some text first."); return; }
    setError("");
    setState("processing");
    try {
      const token = await getToken();
      const res = await fetch("/api/ingest/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, contextType, localDate: format(new Date(), "yyyy-MM-dd") }),
      });
      const data = await res.json();
      setResults(data);
      setState("results");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  function reset() {
    setText("");
    setResults(null);
    setError("");
    setState("idle");
  }

  const modalStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
  };

  const panelStyle: React.CSSProperties = {
    width: "100%", maxWidth: 560, margin: "0 16px",
    background: "rgba(18, 7, 15, 0.95)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 24,
    color: "#fff",
    position: "relative",
  };

  return (
    <div style={modalStyle} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>📥 Quick Capture</h2>
          <button onClick={close} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {state === "results" && results ? (
          <div>
            <p style={{ color: "var(--color-accent, #a78bfa)", fontWeight: 500, marginBottom: 12 }}>{results.summary}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>
              {results.actions.map((a, i) => (
                <li key={i} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                  • {a}
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={reset} style={pillBtn("#a78bfa")}>Capture more</button>
              <button onClick={close} style={pillBtn("rgba(255,255,255,0.15)")}>Done</button>
            </div>
          </div>
        ) : (
          <>
            {/* Context type pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {CONTEXT_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setContextType(ct.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 13, cursor: "pointer", border: "1px solid rgba(255,255,255,0.15)",
                    background: contextType === ct.id ? "var(--color-accent, #a78bfa)" : "rgba(255,255,255,0.07)",
                    color: contextType === ct.id ? "#fff" : "rgba(255,255,255,0.7)",
                    fontWeight: contextType === ct.id ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {ct.emoji} {ct.label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste notes or use the mic to record your debrief…"
              rows={6}
              style={{
                width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                color: "#fff", fontSize: 14, padding: "10px 12px", resize: "vertical",
                outline: "none", fontFamily: "inherit",
              }}
            />

            {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
              <button
                onClick={state === "recording" ? stopRecording : startRecording}
                disabled={state === "processing"}
                style={{
                  ...pillBtn(state === "recording" ? "#ef4444" : "rgba(255,255,255,0.12)"),
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {state === "recording" ? "⏹ Stop" : "🎙 Record"}
              </button>
              {state === "recording" && (
                <span style={{ fontSize: 12, color: "#ef4444", animation: "pulse 1s infinite" }}>● Recording…</span>
              )}
              <button
                onClick={handleSubmit}
                disabled={state === "processing" || state === "recording"}
                style={{ ...pillBtn("#a78bfa"), marginLeft: "auto" }}
              >
                {state === "processing" ? "Processing…" : "File it →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function pillBtn(bg: string): React.CSSProperties {
  return {
    padding: "8px 18px", borderRadius: 20, fontSize: 14, fontWeight: 500,
    cursor: "pointer", border: "none", background: bg, color: "#fff",
    transition: "opacity 0.15s",
  };
}
