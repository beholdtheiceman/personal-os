"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { RiLeafLine, RiSendPlane2Line, RiRefreshLine, RiDeleteBin7Line } from "react-icons/ri";
import type { SeasonMessage, LifeSeason } from "@/types";

type View = "loading" | "empty" | "checkin" | "synthesizing" | "active" | "closing";

function weeksAgo(isoDate: string): number {
  const start = new Date(isoDate);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SeasonManager() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("loading");
  const [season, setSeason] = useState<LifeSeason | null>(null);
  const [messages, setMessages] = useState<SeasonMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [closingMode, setClosingMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/season/current`);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setSeason(null);
        setView("empty");
        return;
      }
      const data = snap.data() as LifeSeason;
      setSeason(data);
      if (data.checkin_complete && data.status === "active") {
        setView("active");
      } else if (data.status === "closing") {
        setMessages(data.messages ?? []);
        setClosingMode(true);
        setView("closing");
      } else if (data.messages?.length > 0) {
        setMessages(data.messages);
        setView("checkin");
      } else {
        setView("empty");
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function startCheckin() {
    if (!user) return;
    setSending(true);
    setClosingMode(false);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/season/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [] }),
      });
      const data = await res.json();
      const firstMsg: SeasonMessage = { role: "guide", content: data.content };
      const now = new Date().toISOString().slice(0, 10);
      await setDoc(doc(db, `users/${user.uid}/season/current`), {
        name: "",
        intention: "",
        claude_framing: "",
        messages: [firstMsg],
        checkin_complete: false,
        started_at: season?.started_at ?? now,
        status: "active",
      });
      setMessages([firstMsg]);
      setView("checkin");
    } catch {
      // silently handle
    } finally {
      setSending(false);
    }
  }

  async function resetCheckin() {
    if (!user) return;
    setMessages([]);
    setInput("");
    await deleteDoc(doc(db, `users/${user.uid}/season/current`));
  }

  async function startClosing() {
    if (!user || !season) return;
    setSending(true);
    setClosingMode(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/season/close", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [],
          currentSeason: { name: season.name, started_at: season.started_at },
        }),
      });
      const data = await res.json();
      const firstMsg: SeasonMessage = { role: "guide", content: data.content };
      const updatedSeason: LifeSeason = { ...season, messages: [firstMsg], status: "closing" };
      await setDoc(doc(db, `users/${user.uid}/season/current`), updatedSeason);
      setMessages([firstMsg]);
      setView("closing");
    } catch {
      // silently handle
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    if (!user || !input.trim() || sending) return;
    const userMsg: SeasonMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);

    try {
      const token = await user.getIdToken();

      if (closingMode && season) {
        const res = await fetch("/api/season/close", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messages: updatedMessages,
            currentSeason: { name: season.name, started_at: season.started_at },
          }),
        });
        const data = await res.json();

        if (data.type === "complete") {
          setView("synthesizing");
          const guideMsg: SeasonMessage = { role: "guide", content: data.content };
          const finalMessages = [...updatedMessages, guideMsg];
          await setDoc(
            doc(db, `users/${user.uid}/seasons/${season.started_at}`),
            {
              ...season,
              closed_at: new Date().toISOString().slice(0, 10),
              reflection: data.reflection ?? data.content,
              closing_messages: finalMessages,
            }
          );
          await deleteDoc(doc(db, `users/${user.uid}/season/current`));
        } else {
          const guideMsg: SeasonMessage = { role: "guide", content: data.content };
          const nextMessages = [...updatedMessages, guideMsg];
          setMessages(nextMessages);
          await setDoc(
            doc(db, `users/${user.uid}/season/current`),
            { ...season, messages: nextMessages, status: "closing" }
          );
        }
      } else {
        const res = await fetch("/api/season/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: updatedMessages }),
        });
        const data = await res.json();
        const ref = doc(db, `users/${user.uid}/season/current`);
        const now = new Date().toISOString().slice(0, 10);

        if (data.type === "complete") {
          setView("synthesizing");
          const guideMsg: SeasonMessage = { role: "guide", content: data.content };
          const finalMessages = [...updatedMessages, guideMsg];
          await setDoc(ref, {
            name: data.season.name,
            intention: data.season.intention,
            claude_framing: data.season.claude_framing,
            messages: finalMessages,
            checkin_complete: true,
            started_at: season?.started_at ?? now,
            status: "active",
          });
        } else {
          const guideMsg: SeasonMessage = { role: "guide", content: data.content };
          const nextMessages = [...updatedMessages, guideMsg];
          setMessages(nextMessages);
          await setDoc(ref, {
            name: season?.name ?? "",
            intention: season?.intention ?? "",
            claude_framing: season?.claude_framing ?? "",
            messages: nextMessages,
            checkin_complete: false,
            started_at: season?.started_at ?? now,
            status: "active",
          });
        }
      }
    } catch {
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  const guideCount = messages.filter((m) => m.role === "guide").length;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Synthesizing ─────────────────────────────────────────────────────────────
  if (view === "synthesizing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">
          {closingMode ? "Closing your season…" : "Naming your season…"}
        </p>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (view === "empty") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
          <RiLeafLine className="w-8 h-8 text-pink-400" />
        </div>
        <div className="max-w-md">
          <h2 className="text-xl font-semibold text-white mb-2">Your Current Season</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Life has chapters. Within them, seasons — focused sprints, recovery stretches, windows
            of uncertainty. Naming where you are helps you respond to it intentionally rather than
            reactively.
          </p>
        </div>
        <button
          onClick={() => void startCheckin()}
          disabled={sending}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-white font-medium transition-colors"
        >
          {sending ? "Starting…" : "Name Your Season"}
        </button>
      </div>
    );
  }

  // ── Checkin ──────────────────────────────────────────────────────────────────
  if (view === "checkin") {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
        <div className="shrink-0 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-pink-500/10 flex items-center justify-center">
              <RiLeafLine className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <span className="text-sm font-medium text-white">Season Check-In</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Turn {guideCount}</span>
            <button
              onClick={() => void resetCheckin()}
              disabled={sending}
              title="Start over"
              className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors disabled:opacity-40"
            >
              <RiDeleteBin7Line className="w-3.5 h-3.5" />
              Start over
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-sm"
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

        <div className="shrink-0 mt-3">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={sending}
              placeholder="Share your thoughts…"
              rows={3}
              className="flex-1 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
              style={{ background: "rgba(20, 8, 18, 0.85)" }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              className="shrink-0 w-10 h-10 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors"
            >
              <RiSendPlane2Line className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Closing ──────────────────────────────────────────────────────────────────
  if (view === "closing") {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
        <div className="shrink-0 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-pink-400/70 font-medium uppercase tracking-wider mb-0.5">
              Season Reflection
            </p>
            <h2 className="text-sm font-semibold text-white">
              Closing: {season?.name ?? ""}
            </h2>
          </div>
          <span className="text-xs text-gray-500">Turn {guideCount}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-pink-600 text-white rounded-br-sm"
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

        <div className="shrink-0 mt-3">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={sending}
              placeholder="Share your thoughts…"
              rows={3}
              className="flex-1 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-pink-500/50 disabled:opacity-50"
              style={{ background: "rgba(20, 8, 18, 0.85)" }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              className="shrink-0 w-10 h-10 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors"
            >
              <RiSendPlane2Line className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active ───────────────────────────────────────────────────────────────────
  if (!season) return null;
  const weeks = weeksAgo(season.started_at);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
          <RiLeafLine className="w-4 h-4 text-pink-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Life Season</h2>
      </div>

      <div className="rounded-xl px-6 py-5 space-y-4 border border-white/15" style={{ background: "rgba(10, 4, 16, 0.82)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-start justify-between gap-4">
          <span className="inline-block bg-purple-500/30 border border-purple-500/40 text-purple-100 text-base font-semibold px-4 py-1.5 rounded-full">
            {season.name}
          </span>
        </div>

        <p className="text-gray-100 text-sm leading-relaxed">{season.intention}</p>

        {season.claude_framing && (
          <p className="text-gray-400 text-xs leading-relaxed italic border-l-2 border-purple-500/30 pl-3">
            {season.claude_framing}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
          <span>Active since {formatDate(season.started_at)}</span>
          {weeks > 0 && (
            <span className="text-gray-500">
              ({weeks} {weeks === 1 ? "week" : "weeks"})
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => void startCheckin()}
          disabled={sending}
          style={{ background: "rgba(10, 4, 16, 0.82)", backdropFilter: "blur(12px)" }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-white/20 hover:border-white/35 text-gray-200 hover:text-white rounded-xl transition-colors disabled:opacity-50"
        >
          <RiRefreshLine className="w-4 h-4" />
          Check In Again
        </button>
        <button
          onClick={() => void startClosing()}
          disabled={sending}
          style={{ background: "rgba(10, 4, 16, 0.82)", backdropFilter: "blur(12px)" }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-pink-500/50 hover:border-pink-400/70 text-pink-300 hover:text-pink-200 rounded-xl transition-colors disabled:opacity-50"
        >
          Close This Season
        </button>
      </div>
    </div>
  );
}
