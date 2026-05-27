"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { RiShieldLine, RiSendPlane2Line, RiEditLine, RiCheckLine, RiCloseLine } from "react-icons/ri";
import ReactMarkdown from "react-markdown";
import type { ConstitutionMessage, PersonalConstitution } from "@/types";

type View = "loading" | "empty" | "interview" | "synthesizing" | "document";

export default function ConstitutionManager() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("loading");
  const [constitution, setConstitution] = useState<PersonalConstitution | null>(null);
  const [messages, setMessages] = useState<ConstitutionMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Real-time listener on the constitution doc
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/constitution/main`);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setView("empty");
        return;
      }
      const data = snap.data() as PersonalConstitution;
      setConstitution(data);
      if (data.interview_complete) {
        setView("document");
        setEditContent(data.content);
      } else if (data.interview_messages?.length > 0) {
        setMessages(data.interview_messages);
        setQuestionCount(
          data.interview_messages.filter((m) => m.role === "guide").length
        );
        setView("interview");
      } else {
        setView("empty");
      }
    });
    return () => unsub();
  }, [user]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function startInterview() {
    if (!user) return;
    setSending(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/constitution/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [] }),
      });
      const data = await res.json();
      const firstQuestion: ConstitutionMessage = { role: "guide", content: data.content };
      const now = new Date().toISOString();
      await setDoc(doc(db, `users/${user.uid}/constitution/main`), {
        content: "",
        interview_messages: [firstQuestion],
        interview_complete: false,
        created_at: now,
        updated_at: now,
      });
      setMessages([firstQuestion]);
      setQuestionCount(1);
      setView("interview");
    } catch {
      // silently handle
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    if (!user || !input.trim() || sending) return;
    const userMsg: ConstitutionMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/constitution/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();
      const now = new Date().toISOString();
      const ref = doc(db, `users/${user.uid}/constitution/main`);

      if (data.type === "complete") {
        setView("synthesizing");
        const guideMsg: ConstitutionMessage = { role: "guide", content: data.content };
        const finalMessages = [...updatedMessages, guideMsg];
        await setDoc(ref, {
          content: data.content,
          interview_messages: finalMessages,
          interview_complete: true,
          created_at: constitution?.created_at ?? now,
          updated_at: now,
        });
        setEditContent(data.content);
        setView("document");
      } else {
        const guideMsg: ConstitutionMessage = { role: "guide", content: data.content };
        const nextMessages = [...updatedMessages, guideMsg];
        const nextCount = nextMessages.filter((m) => m.role === "guide").length;
        setMessages(nextMessages);
        setQuestionCount(nextCount);
        await setDoc(ref, {
          content: "",
          interview_messages: nextMessages,
          interview_complete: false,
          created_at: constitution?.created_at ?? now,
          updated_at: now,
        });
      }
    } catch {
      // revert on error
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  async function saveEdit() {
    if (!user || !constitution) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, `users/${user.uid}/constitution/main`),
        { content: editContent, updated_at: new Date().toISOString() },
        { merge: true }
      );
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  async function redoInterview() {
    if (!user) return;
    setView("empty");
    setMessages([]);
    setQuestionCount(0);
    setConstitution(null);
    // Clear Firestore doc so onSnapshot triggers empty state
    await setDoc(doc(db, `users/${user.uid}/constitution/main`), {
      content: "",
      interview_messages: [],
      interview_complete: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Synthesizing ─────────────────────────────────────────────────────────────
  if (view === "synthesizing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">Synthesizing your Personal Constitution…</p>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (view === "empty") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
          <RiShieldLine className="w-8 h-8 text-blue-400" />
        </div>
        <div className="max-w-md">
          <h2 className="text-xl font-semibold text-white mb-2">Your Personal Constitution</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            A guided conversation that helps you articulate your deepest values, mission, and vision.
            Claude will ask 10 reflective questions — one at a time — and synthesize your answers into
            a living document that shapes every AI interaction.
          </p>
        </div>
        <button
          onClick={startInterview}
          disabled={sending}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-medium transition-colors"
        >
          {sending ? "Starting…" : "Begin the Interview"}
        </button>
      </div>
    );
  }

  // ── Interview ────────────────────────────────────────────────────────────────
  if (view === "interview") {
    const progress = Math.min((questionCount / 10) * 100, 100);
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="shrink-0 mb-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>Question {Math.min(questionCount, 10)} of 10</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white/8 text-gray-200 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white/8 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 mt-3">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
              }}
              disabled={sending}
              placeholder="Share your thoughts…"
              rows={3}
              className="flex-1 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
              style={{ background: "rgba(20, 8, 18, 0.85)" }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              className="shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors"
            >
              <RiSendPlane2Line className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Document ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <RiShieldLine className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Personal Constitution</h2>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => { setEditMode(false); setEditContent(constitution?.content ?? ""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
              >
                <RiCloseLine className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={() => void saveEdit()}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <RiCheckLine className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
              >
                <RiEditLine className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => void redoInterview()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
              >
                Redo Interview
              </button>
            </>
          )}
        </div>
      </div>

      {editMode ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full min-h-[60vh] bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-gray-200 font-mono leading-relaxed resize-none focus:outline-none focus:border-blue-500/50"
        />
      ) : (
        <div className="prose prose-invert prose-sm max-w-none bg-white/5 border border-white/10 rounded-xl px-6 py-5">
          <ReactMarkdown>{constitution?.content ?? ""}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
