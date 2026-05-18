"use client";
import { useState, useRef } from "react";
import { RiMicLine, RiMicOffLine, RiCloseLine, RiSendPlane2Line } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";

interface Props {
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}

export default function JournalForm({ onSave, onClose }: Props) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const startRecording = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition isn't supported in this browser. Try Chrome.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setText((prev) => prev + (prev ? " " : "") + transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      const messages: Record<string, string> = {
        "not-allowed":         "Microphone permission denied — check browser settings",
        "no-speech":           "No speech detected — try again",
        "network":             "Network error — speech recognition requires internet",
        "service-not-allowed": "Speech service blocked — try on HTTPS",
        "audio-capture":       "No microphone found",
      };
      toast.error(messages[e.error] ?? `Speech error: ${e.error}`);
      setRecording(false);
    };

    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave(text.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
          <h2 className="font-semibold text-text-primary">New Journal Entry</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind? Speak or type freely…"
            rows={8}
            className="w-full bg-bg-tertiary border border-bg-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                recording
                  ? "bg-danger/20 text-danger border border-danger/40 animate-pulse"
                  : "bg-bg-tertiary text-text-secondary border border-bg-border hover:border-accent/40 hover:text-accent"
              }`}
            >
              {recording ? <RiMicOffLine className="w-4 h-4" /> : <RiMicLine className="w-4 h-4" />}
              {recording ? "Stop" : "Record"}
            </button>

            <div className="flex-1" />

            <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!text.trim() || saving}
              className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
            >
              {saving ? <LoadingDots /> : <><RiSendPlane2Line className="w-4 h-4" /> Save & Analyze</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
