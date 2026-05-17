"use client";
// Quick-log modal: type or speak a task, Claude extracts and saves it
import { useState, useRef } from "react";
import Modal from "@/components/ui/Modal";
import LoadingDots from "@/components/ui/LoadingDots";
import { useAuth } from "@/contexts/AuthContext";
import { addUserDoc } from "@/lib/firestore-helpers";
import { RiMicLine, RiMicOffLine, RiSendPlane2Line } from "react-icons/ri";
import toast from "react-hot-toast";
import type { Task } from "@/types";

interface QuickLogModalProps {
  onClose: () => void;
}

export default function QuickLogModal({ onClose }: QuickLogModalProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Voice recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (data.text) setInput(data.text);
    } catch {
      toast.error("Transcription failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!input.trim() || !user) return;
    setLoading(true);
    try {
      // Ask Claude to extract structured tasks from the free-form input
      const res = await fetch("/api/tasks/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const { tasks } = await res.json() as { tasks: Partial<Task>[] };

      // Save each extracted task to Firestore
      await Promise.all(
        tasks.map((t) =>
          addUserDoc(user.uid, "tasks", {
            title: t.title ?? input.trim(),
            description: t.description ?? "",
            status: "active",
            priority_score: t.priority_score ?? 50,
            tags: t.tags ?? ["personal"],
            due_date: null,
            source: "voice",
          })
        )
      );

      toast.success(
        tasks.length > 1
          ? `${tasks.length} tasks added`
          : "Task added"
      );
      onClose();
    } catch {
      toast.error("Failed to save task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Quick Log" onClose={onClose}>
      <p className="text-sm text-text-secondary mb-3">
        Type or speak — Claude will extract and save your task(s).
      </p>

      <textarea
        className="input-base resize-none h-28 mb-3"
        placeholder='e.g. "Call dentist tomorrow, finish the report by Friday, buy groceries"'
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={loading}
        autoFocus
      />

      <div className="flex items-center gap-2">
        {/* Voice button */}
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            recording
              ? "bg-danger/20 text-danger border border-danger/30 animate-pulse"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary border border-bg-border"
          }`}
        >
          {recording ? (
            <><RiMicOffLine className="w-4 h-4" /> Stop</>
          ) : (
            <><RiMicLine className="w-4 h-4" /> Voice</>
          )}
        </button>

        <div className="flex-1" />

        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <LoadingDots />
          ) : (
            <><RiSendPlane2Line className="w-4 h-4" /> Add Task</>
          )}
        </button>
      </div>
    </Modal>
  );
}
