"use client";
import { useState, useRef } from "react";
import { RiMicLine, RiMicOffLine, RiCloseLine, RiSendPlane2Line } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";

interface Props {
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}

export default function JournalForm({ onSave, onClose }: Props) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (data.text) setText((prev) => prev + (prev ? " " : "") + data.text);
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
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
              disabled={transcribing || saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                recording
                  ? "bg-danger/20 text-danger border border-danger/40 animate-pulse"
                  : "bg-bg-tertiary text-text-secondary border border-bg-border hover:border-accent/40 hover:text-accent"
              }`}
            >
              {recording ? <RiMicOffLine className="w-4 h-4" /> : <RiMicLine className="w-4 h-4" />}
              {recording ? "Stop" : transcribing ? "Transcribing…" : "Record"}
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
