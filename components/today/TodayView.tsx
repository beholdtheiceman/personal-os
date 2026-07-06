"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useChatPanel } from "@/contexts/ChatPanelContext";
import { format } from "date-fns";
import {
  RiSendPlane2Fill, RiMoonLine, RiCalendarLine,
  RiListCheck2, RiFireLine, RiLayoutGridLine, RiArrowRightLine,
} from "react-icons/ri";

// Quick-action chips. Each seeds the assistant with a complete opening line so a
// tap becomes a real conversation the assistant can act on and log from.
const CHIPS: { label: string; seed: string; accent?: boolean }[] = [
  { label: "Recap my day", seed: "I want to recap my day — ask me how it went and log whatever I mention.", accent: true },
  { label: "What's on today?", seed: "What's on my plate today?" },
  { label: "Log a workout", seed: "I did a workout — help me log it." },
];

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface TaskLite { title: string; priority_score?: number; due_date?: string | null }

export default function TodayView() {
  const { user } = useAuth();
  const chat = useChatPanel();
  const [input, setInput] = useState("");
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [habits, setHabits] = useState({ due: 0, done: 0 });
  const [events, setEvents] = useState<{ time: string; title: string }[]>([]);
  const [calConnected, setCalConnected] = useState(false);

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const dow = now.getDay();
  const greeting = greetingFor(now.getHours());
  const firstName = user?.displayName?.split(" ")[0] ?? "";

  // Top 3 active tasks (sorted client-side to avoid a composite index requirement).
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "tasks"), where("status", "==", "active"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data() as TaskLite)
        .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
        .slice(0, 3);
      setTasks(list);
    }, () => {});
  }, [user]);

  // Habits due today vs. done today (local date + day-of-week).
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "habits"), (snap) => {
      const all = snap.docs.map((d) => d.data() as { target_days?: number[]; completions?: string[] });
      const due = all.filter((h) => (h.target_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(dow));
      const done = due.filter((h) => (h.completions ?? []).includes(today)).length;
      setHabits({ due: due.length, done });
    }, () => {});
  }, [user, dow, today]);

  // Today's calendar events (best-effort — calendar is optional).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/calendar/events", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        setCalConnected(!!data.connected);
        const todays = ((data.events ?? []) as { title?: string; start?: string; allDay?: boolean }[])
          .filter((e) => (e.start ?? "").slice(0, 10) === today)
          .slice(0, 3)
          .map((e) => ({
            time: e.allDay ? "All day" : (e.start ?? "").slice(11, 16),
            title: e.title ?? "Untitled",
          }));
        setEvents(todays);
      } catch { /* calendar is optional */ }
    })();
    return () => { cancelled = true; };
  }, [user, today]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    chat.open(t);
    setInput("");
  };

  const habitsLeft = habits.due - habits.done;
  const needs: string[] = [];
  if (habitsLeft > 0) needs.push(`${habitsLeft} habit${habitsLeft > 1 ? "s" : ""} left`);
  if (tasks.length) needs.push(`${tasks.length} task${tasks.length > 1 ? "s" : ""} up next`);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {format(now, "EEEE, MMMM d")}{needs.length ? ` · ${needs.join(" · ")}` : ""}
        </p>
      </div>

      <div className="card">
        <p className="text-base font-medium text-text-primary mb-3">What&apos;s on your mind?</p>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Log a meal, add a task, jot a thought, or just ask…"
            className="input flex-1"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="btn-primary shrink-0 px-3 py-2.5 flex items-center justify-center"
            aria-label="Send to assistant"
          >
            <RiSendPlane2Fill className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              onClick={() => send(c.seed)}
              className={`text-sm px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                c.accent
                  ? "bg-accent/15 text-accent hover:bg-accent/25"
                  : "bg-white/5 text-text-secondary hover:text-text-primary border border-white/10"
              }`}
            >
              {c.accent && <RiMoonLine className="w-4 h-4" />}
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">Anything you type is filed automatically — no forms to hunt for.</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-text-muted mb-2 px-1">Today at a glance</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card">
            <div className="flex items-center gap-1.5 text-text-secondary text-sm mb-2.5">
              <RiCalendarLine className="w-4 h-4" /> Calendar
            </div>
            {calConnected ? (
              events.length ? (
                <div className="space-y-1.5">
                  {events.map((e, i) => (
                    <div key={i} className="text-sm text-text-primary">
                      <span className="text-text-muted">{e.time}</span> · {e.title}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">Nothing scheduled</p>
              )
            ) : (
              <p className="text-sm text-text-muted">Not connected</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center gap-1.5 text-text-secondary text-sm mb-2.5">
              <RiListCheck2 className="w-4 h-4" /> Top tasks
            </div>
            {tasks.length ? (
              <div className="space-y-1.5">
                {tasks.map((t, i) => (
                  <div key={i} className="text-sm text-text-primary truncate">{t.title}</div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">All clear</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center gap-1.5 text-text-secondary text-sm mb-2.5">
              <RiFireLine className="w-4 h-4" /> Habits
            </div>
            {habits.due ? (
              <>
                <div className="text-xl font-semibold text-text-primary mb-2">
                  {habits.done} <span className="text-sm font-normal text-text-muted">/ {habits.due} done</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: habits.due }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-3 h-3 rounded-full ${i < habits.done ? "bg-accent" : "bg-white/10 border border-white/20"}`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-text-muted">None due today</p>
            )}
          </div>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors pt-2"
      >
        <RiLayoutGridLine className="w-4 h-4" /> Full dashboard
        <span className="text-text-muted">— all your trackers and widgets</span>
        <RiArrowRightLine className="w-4 h-4" />
      </Link>
    </div>
  );
}
