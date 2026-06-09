"use client";
// DayRecapButton (PA-2) — "Log my day" entry point. Opens a focused modal where the user
// describes their whole day (type or dictate) and one call to /api/ingest/day-recap logs
// mood, meals, workout, completed tasks, interactions, a journal seed, water, and expenses.
// Modeled on QuickCaptureModal. Self-contained: manages its own open state and also listens
// for an `os:open-day-recap` event so voice/chat client tools can trigger it.
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

type State = "idle" | "recording" | "processing" | "results";
interface Results { summary: string; actions: string[]; xp_awarded?: number }

export default function DayRecapButton({ variant = "button" }: { variant?: "button" | "icon" }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [text, setText] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const h = (e: Event) => {
      setIsOpen(true);
      const t = (e as CustomEvent).detail?.text;
      if (typeof t === "string" && t) setText(t);
    };
    window.addEventListener("os:open-day-recap", h);
    return () => window.removeEventListener("os:open-day-recap", h);
  }, []);

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
          setError("Transcription failed. You can type your recap manually.");
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
    if (!text.trim()) { setError("Tell me how your day went first."); return; }
    setError("");
    setState("processing");
    try {
      const token = await getToken();
      const res = await fetch("/api/ingest/day-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, localDate: format(new Date(), "yyyy-MM-dd") }),
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

  function closeModal() {
    setIsOpen(false);
    reset();
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={() => setIsOpen(true)}
          title="Log my day"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        >
          🌙
        </button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="btn-primary text-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          🌙 Log my day
        </button>
      )}

      {isOpen && (
        <div style={modalStyle} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>🌙 End-of-Day Recap</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
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
                  <button onClick={reset} style={pillBtn("#a78bfa")}>Add more</button>
                  <button onClick={closeModal} style={pillBtn("rgba(255,255,255,0.15)")}>Done</button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 12px" }}>
                  Describe your day in your own words — how you felt, what you ate, what you got done, who you talked to. I&apos;ll log it all.
                </p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Today was solid — worked out this morning, chicken and rice for lunch, finished the proposal, feeling about a 7…"
                  rows={6}
                  style={{
                    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                    color: "#fff", fontSize: 14, padding: "10px 12px", resize: "vertical",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
                {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                  <button
                    onClick={state === "recording" ? stopRecording : startRecording}
                    disabled={state === "processing"}
                    style={{ ...pillBtn(state === "recording" ? "#ef4444" : "rgba(255,255,255,0.12)"), display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {state === "recording" ? "⏹ Stop" : "🎙 Record"}
                  </button>
                  {state === "recording" && <span style={{ fontSize: 12, color: "#ef4444" }}>● Recording…</span>}
                  <button
                    onClick={handleSubmit}
                    disabled={state === "processing" || state === "recording"}
                    style={{ ...pillBtn("#a78bfa"), marginLeft: "auto" }}
                  >
                    {state === "processing" ? "Logging…" : "Log my day →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const modalStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
};

const panelStyle: React.CSSProperties = {
  width: "100%", maxWidth: 560, margin: "0 16px",
  background: "rgba(18, 7, 15, 0.95)",
  backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
  padding: 24, color: "#fff", position: "relative",
};

function pillBtn(bg: string): React.CSSProperties {
  return {
    padding: "8px 18px", borderRadius: 20, fontSize: 14, fontWeight: 500,
    cursor: "pointer", border: "none", background: bg, color: "#fff",
    transition: "opacity 0.15s",
  };
}
