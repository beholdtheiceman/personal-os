"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection, onSnapshot, query, orderBy, limit,
  doc, getDoc, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchMemoryEntries, buildSystemPrompt, buildMemoryContext } from "@/lib/memory";
import ReactMarkdown from "react-markdown";
import LoadingDots from "@/components/ui/LoadingDots";
import TaskCard from "@/components/tasks/TaskCard";
import {
  RiRefreshLine, RiLoopLeftLine, RiTaskLine, RiCheckLine,
  RiMoonLine, RiFlashlightLine, RiBookLine, RiHeartPulseLine,
  RiCalendarLine, RiBowlLine, RiMailLine, RiLineChartLine,
  RiFolderLine, RiMoneyDollarCircleLine, RiArrowUpLine, RiArrowDownLine,
} from "react-icons/ri";

interface DailyVerse { text: string; reference: string; }
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { useToday } from "@/hooks/useToday";
import toast from "react-hot-toast";
import type { Task, Habit, HealthLog, JournalEntry, NutritionLog, Goal, Project, Transaction } from "@/types";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
}

function eventDayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, MMM d");
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHealth, setTodayHealth] = useState<HealthLog | null>(null);
  const [latestJournal, setLatestJournal] = useState<JournalEntry | null>(null);
  const [todayNutrition, setTodayNutrition] = useState<NutritionLog[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [verse, setVerse] = useState<DailyVerse | null>(null);
  const [gmailMessages, setGmailMessages] = useState<{ id: string; from: string; subject: string; date: string; read: boolean }[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const today = useToday();
  const thisMonth = today.slice(0, 7);

  // Load cached report
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid, "daily_reports", today)).then((snap) => {
      if (snap.exists()) setReport(snap.data().content);
    });
  }, [user, today]);

  // Live tasks (top 5 active by priority)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "tasks"),
      orderBy("priority_score", "desc"),
      limit(5)
    );
    return onSnapshot(q, (snap) => {
      setTasks(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Task))
          .filter((t) => t.status === "active")
          .slice(0, 5)
      );
    });
  }, [user]);

  // Live habits
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users", user.uid, "habits"), (snap) => {
      setHabits(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Habit)));
    });
  }, [user]);

  // Live health log for today
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid, "health", today), (snap) => {
      setTodayHealth(snap.exists() ? ({ id: snap.id, ...snap.data() } as HealthLog) : null);
    });
  }, [user, today]);

  // Live latest journal entry
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "journal"),
      orderBy("created_at", "desc"),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      setLatestJournal(
        snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as JournalEntry)
      );
    });
  }, [user]);

  // Live nutrition for today
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "nutrition"),
      orderBy("logged_at", "desc"),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NutritionLog));
      setTodayNutrition(all.filter((l) => l.date === today));
    });
  }, [user, today]);

  // Calendar events (one-time fetch — calendar API is server-side)
  useEffect(() => {
    if (!user) return;
    fetch(`/api/calendar/events?uid=${user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        setCalendarConnected(data.connected ?? false);
        setCalendarEvents(data.events ?? []);
      })
      .catch(() => {});
  }, [user]);

  // Verse of the day
  useEffect(() => {
    fetch("/api/bible/verse")
      .then((r) => r.json())
      .then(setVerse)
      .catch(() => {});
  }, []);

  // Gmail unread preview
  useEffect(() => {
    if (!user) return;
    fetch(`/api/gmail/messages?uid=${user.uid}&max=10`)
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setGmailConnected(true);
          setGmailMessages(data.messages ?? []);
        }
      })
      .catch(() => {});
  }, [user]);

  // Live goals
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "goals"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal)));
    });
  }, [user]);

  // Live projects
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "projects"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
    });
  }, [user]);

  // Live transactions
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "transactions"), orderBy("date", "desc"), limit(200));
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
    });
  }, [user]);

  const toggleHabit = async (id: string) => {
    if (!user) return;
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const completions = habit.completions.includes(today)
      ? habit.completions.filter((d) => d !== today)
      : [...habit.completions, today];
    await updateDoc(doc(db, "users", user.uid, "habits", id), { completions });
  };

  const completeTask = async (id: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    await updateDoc(doc(db, "users", user.uid, "tasks", id), {
      status: task.status === "completed" ? "active" : "completed",
    });
  };

  const generateReport = async () => {
    if (!user) return;
    setLoadingReport(true);
    try {
      const memory = await fetchMemoryEntries(user.uid);

      const topTasksText = tasks
        .slice(0, 5)
        .map((t, i) => `${i + 1}. ${t.title} (score: ${t.priority_score})`)
        .join("\n");

      const habitsText = habits
        .map((h) => `${h.name}: ${h.completions.includes(today) ? "done" : "not done"}`)
        .join(", ");

      const calendarText = calendarEvents.length
        ? calendarEvents
            .slice(0, 5)
            .map((e) => {
              const time = e.allDay
                ? "all day"
                : format(parseISO(e.start), "h:mm a");
              return `- ${e.title} (${eventDayLabel(e.start)}, ${time})`;
            })
            .join("\n")
        : "No upcoming events";

      const healthText = todayHealth
        ? `Sleep: ${todayHealth.sleep_hours}h, Quality: ${todayHealth.sleep_quality}/10, Energy: ${todayHealth.energy_level}/10${todayHealth.exercise_done ? ", Exercised" : ""}`
        : "Not logged today";

      const journalText = latestJournal
        ? `Mood ${latestJournal.mood_score}/10 on ${format(parseISO(latestJournal.created_at), "MMM d")}: ${latestJournal.ai_summary}`
        : "No recent entry";

      const nutritionTotals = todayNutrition.reduce(
        (acc, l) => ({
          cal: acc.cal + l.calories_estimated,
          protein: acc.protein + l.protein_g,
        }),
        { cal: 0, protein: 0 }
      );
      const nutritionText = todayNutrition.length
        ? `${nutritionTotals.cal} kcal, ${nutritionTotals.protein}g protein logged today (${todayNutrition.length} meal${todayNutrition.length > 1 ? "s" : ""})`
        : "Nothing logged today";

      const systemPrompt = buildSystemPrompt(
        buildMemoryContext(memory),
        user.displayName ?? "User",
        {
          date: new Date().toDateString(),
          calendarEvents: calendarText,
          topTasks: topTasksText || "No tasks",
          recentHabits: habitsText || "No habits",
          lastHealthLog: healthText,
          lastJournal: journalText,
          nutritionToday: nutritionText,
        }
      );

      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
        await setDoc(doc(db, "users", user.uid, "daily_reports", today), {
          content: data.report,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoadingReport(false);
    }
  };

  const completedToday = habits.filter((h) => h.completions.includes(today)).length;
  const nutritionTotals = todayNutrition.reduce(
    (acc, l) => ({ cal: acc.cal + l.calories_estimated, protein: acc.protein + l.protein_g }),
    { cal: 0, protein: 0 }
  );

  // Finance — this month's totals
  const monthTransactions = transactions.filter((t) => t.date?.startsWith(thisMonth));
  const monthIncome = monthTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const monthNet = monthIncome - monthExpense;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // Active goals with milestone progress
  const activeGoals = goals.filter((g) => g.status === "active").slice(0, 3);

  // Active projects
  const activeProjects = projects.filter((p) => p.status === "active").slice(0, 4);

  // Group upcoming calendar events — today + tomorrow only for dashboard
  const upcomingEvents = calendarEvents.filter((e) => {
    const d = parseISO(e.start);
    return isToday(d) || isTomorrow(d);
  }).slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
        <button
          onClick={generateReport}
          disabled={loadingReport}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          {loadingReport ? <LoadingDots /> : <><RiRefreshLine className="w-4 h-4" /> Generate Report</>}
        </button>
      </div>

      {/* ── AI Briefing ── */}
      <div className="card">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Today's Briefing
        </h2>
        {loadingReport ? (
          <div className="py-6 flex justify-center"><LoadingDots /></div>
        ) : report ? (
          <div className="prose-dark text-sm">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-text-secondary text-sm mb-4">
              No report yet. Generate one to get your morning briefing.
            </p>
            <button onClick={generateReport} className="btn-primary text-sm">
              Generate Morning Briefing
            </button>
          </div>
        )}
      </div>

      {/* ── Verse of the Day ── */}
      {verse && (
        <div className="card border-accent/20 bg-accent/5 flex items-start gap-3">
          <span className="text-lg mt-0.5">✝</span>
          <div>
            <p className="text-sm text-text-primary italic leading-relaxed">"{verse.text}"</p>
            <p className="text-xs text-accent-text mt-1.5 font-medium">— {verse.reference}</p>
          </div>
        </div>
      )}

      {/* ── Tasks + Habits ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiTaskLine className="w-3.5 h-3.5" /> Top Tasks
            </h2>
            <a href="/tasks" className="text-xs text-accent hover:text-accent-text">View all</a>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">
              No active tasks. <a href="/tasks" className="text-accent">Add one</a>
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={completeTask}
                  onDelete={() => {}}
                  onEdit={() => {}}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiLoopLeftLine className="w-3.5 h-3.5" /> Habits Today
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{completedToday}/{habits.length}</span>
              <a href="/habits" className="text-xs text-accent hover:text-accent-text">Manage</a>
            </div>
          </div>
          {habits.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">
              No habits yet. <a href="/habits" className="text-accent">Add one</a>
            </p>
          ) : (
            <div className="space-y-2">
              {habits.map((habit) => {
                const done = habit.completions.includes(today);
                return (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left ${
                      done ? "border-success/30 bg-success/5" : "border-bg-border hover:border-success/40"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      done ? "bg-success border-success" : "border-bg-border"
                    }`}>
                      {done && <RiCheckLine className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-sm flex-1 ${done ? "text-text-muted line-through" : "text-text-primary"}`}>
                      {habit.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Calendar + Nutrition ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiCalendarLine className="w-3.5 h-3.5" /> Upcoming
            </h2>
            <a href="/calendar" className="text-xs text-accent hover:text-accent-text">View all</a>
          </div>
          {!calendarConnected ? (
            <p className="text-xs text-text-muted text-center py-4">
              <a href="/calendar" className="text-accent">Connect Google Calendar</a>
            </p>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">Nothing today or tomorrow</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <span className="text-xs text-text-muted shrink-0 mt-0.5 w-16">
                    {event.allDay ? "All day" : format(parseISO(event.start), "h:mm a")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{event.title}</p>
                    {isToday(parseISO(event.start)) ? null : (
                      <p className="text-xs text-text-muted">Tomorrow</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiBowlLine className="w-3.5 h-3.5" /> Nutrition Today
            </h2>
            <a href="/nutrition" className="text-xs text-accent hover:text-accent-text">Log meal</a>
          </div>
          {todayNutrition.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">
              Nothing logged. <a href="/nutrition" className="text-accent">Add a meal</a>
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-text-primary font-medium">{nutritionTotals.cal}</span>
                  <span className="text-text-muted text-xs ml-1">kcal</span>
                </div>
                <div>
                  <span className="text-text-primary font-medium">{nutritionTotals.protein}g</span>
                  <span className="text-text-muted text-xs ml-1">protein</span>
                </div>
                <div>
                  <span className="text-text-muted text-xs">{todayNutrition.length} meal{todayNutrition.length > 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min(100, (nutritionTotals.cal / 2000) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted">{Math.max(0, 2000 - nutritionTotals.cal)} kcal remaining</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Health + Journal ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiHeartPulseLine className="w-3.5 h-3.5" /> Health Today
            </h2>
            <a href="/health" className="text-xs text-accent hover:text-accent-text">Log</a>
          </div>
          {todayHealth ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <RiMoonLine className="w-4 h-4 text-indigo-400" />
                <span className="text-text-primary font-medium">{todayHealth.sleep_hours}h</span>
                <span className="text-text-muted text-xs">sleep</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RiFlashlightLine className="w-4 h-4 text-amber-400" />
                <span className="text-text-primary font-medium">{todayHealth.energy_level}/10</span>
                <span className="text-text-muted text-xs">energy</span>
              </div>
              {todayHealth.exercise_done && (
                <div className="flex items-center gap-1.5">
                  <RiCheckLine className="w-4 h-4 text-success" />
                  <span className="text-text-primary font-medium">Exercised</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">
              Not logged yet. <a href="/health" className="text-accent">Log now</a>
            </p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiBookLine className="w-3.5 h-3.5" /> Latest Journal
            </h2>
            <a href="/journal" className="text-xs text-accent hover:text-accent-text">View all</a>
          </div>
          {latestJournal ? (
            <div className="space-y-1.5">
              <p className="text-xs text-text-muted">
                {format(parseISO(latestJournal.created_at), "MMM d · h:mm a")} · Mood {latestJournal.mood_score}/10
              </p>
              <p className="text-sm text-text-primary line-clamp-3">{latestJournal.ai_summary}</p>
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">
              No entries yet. <a href="/journal" className="text-accent">Write one</a>
            </p>
          )}
        </div>
      </div>

      {/* ── Goals + Projects ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiLineChartLine className="w-3.5 h-3.5" /> Active Goals
            </h2>
            <a href="/goals" className="text-xs text-accent hover:text-accent-text">View all</a>
          </div>
          {activeGoals.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">
              No active goals. <a href="/goals" className="text-accent">Add one</a>
            </p>
          ) : (
            <div className="space-y-3">
              {activeGoals.map((goal) => {
                const total = goal.milestones?.length ?? 0;
                const done = goal.milestones?.filter((m) => m.completed).length ?? 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-primary truncate flex-1">{goal.title}</span>
                      {total > 0 && (
                        <span className="text-xs text-text-muted ml-2 shrink-0">{done}/{total}</span>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiFolderLine className="w-3.5 h-3.5" /> Active Projects
            </h2>
            <a href="/projects" className="text-xs text-accent hover:text-accent-text">View all</a>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">
              No active projects. <a href="/projects" className="text-accent">Add one</a>
            </p>
          ) : (
            <div className="space-y-2">
              {activeProjects.map((project) => (
                <a
                  key={project.id}
                  href="/projects"
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: project.color_tag ?? "#C4728A" }}
                  />
                  <span className="text-sm text-text-primary flex-1 truncate">{project.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Finance ── */}
      {monthTransactions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiMoneyDollarCircleLine className="w-3.5 h-3.5" /> Finance — {format(new Date(), "MMMM")}
            </h2>
            <a href="/finance" className="text-xs text-accent hover:text-accent-text">Details</a>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-1.5">
              <RiArrowUpLine className="w-4 h-4 text-success shrink-0" />
              <span className="text-sm font-medium text-text-primary">{fmt(monthIncome)}</span>
              <span className="text-xs text-text-muted">income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RiArrowDownLine className="w-4 h-4 text-danger shrink-0" />
              <span className="text-sm font-medium text-text-primary">{fmt(monthExpense)}</span>
              <span className="text-xs text-text-muted">expenses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold ${monthNet >= 0 ? "text-success" : "text-danger"}`}>
                {monthNet >= 0 ? "+" : ""}{fmt(monthNet)}
              </span>
              <span className="text-xs text-text-muted">net</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Gmail ── */}
      {gmailConnected && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
              <RiMailLine className="w-3.5 h-3.5" /> Gmail
            </h2>
            <div className="flex items-center gap-2">
              {gmailMessages.filter((m) => !m.read).length > 0 && (
                <span className="text-xs font-semibold bg-accent/15 text-accent px-2 py-0.5 rounded-full">
                  {gmailMessages.filter((m) => !m.read).length} unread
                </span>
              )}
              <a href="/gmail" className="text-xs text-accent hover:text-accent-text">Open inbox</a>
            </div>
          </div>
          {gmailMessages.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-3">Inbox is empty</p>
          ) : (
            <div className="space-y-1">
              {gmailMessages.slice(0, 5).map((msg) => (
                <a
                  key={msg.id}
                  href="/gmail"
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  {!msg.read && <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                  {msg.read && <div className="w-1.5 h-1.5 shrink-0" />}
                  <span className={`text-sm flex-1 truncate ${!msg.read ? "font-medium text-text-primary" : "text-text-secondary"}`}>
                    {msg.subject || "(no subject)"}
                  </span>
                  <span className="text-xs text-text-muted shrink-0">{msg.from}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
