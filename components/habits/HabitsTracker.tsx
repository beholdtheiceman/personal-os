"use client";
// Full habit tracker — real-time Firestore, daily check-ins, streaks, weekly grid
import { useState, useEffect } from "react";
import { collection, onSnapshot, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addUserDoc } from "@/lib/firestore-helpers";
import { useAuth } from "@/contexts/AuthContext";
import HabitCard from "./HabitCard";
import HabitForm from "./HabitForm";
import LoadingDots from "@/components/ui/LoadingDots";
import { RiAddLine, RiLoopLeftLine, RiNotificationLine, RiNotificationOffLine } from "react-icons/ri";
import { format } from "date-fns";
import { useToday } from "@/hooks/useToday";
import { useNotifications } from "@/hooks/useNotifications";
import { useXP } from "@/hooks/useXP";
import { awardXP } from "@/lib/awardXP";
import { habitXP, streakMultiplier } from "@/lib/xp";
import { checkAndAward } from "@/lib/checkAndAward";
import toast from "react-hot-toast";
import type { Habit } from "@/types";

function calcStreak(completions: string[], todayStr: string): number {
  let streak = 0;
  const [y, m, d] = todayStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  for (let i = 1; i <= 365; i++) {
    const prev = new Date(base);
    prev.setDate(prev.getDate() - i);
    const s = prev.toLocaleDateString("en-CA");
    if (completions.includes(s)) streak++;
    else break;
  }
  return streak;
}

export default function HabitsTracker() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const todayStr = useToday();
  const { permission, enable } = useNotifications();
  const { totalXP } = useXP();

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "habits"),
      (snap) => {
        setHabits(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Habit)));
        setLoading(false);
      },
      (err) => {
        console.error("Habits listener error:", err);
        toast.error("Failed to load habits");
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  const addHabit = async (data: Partial<Habit>) => {
    if (!user) return;
    await addUserDoc(user.uid, "habits", {
      name: data.name,
      category: data.category ?? "",
      target_days: data.target_days ?? [1, 2, 3, 4, 5],
      completions: [],
    });
    toast.success("Habit created");
  };

  const updateHabit = async (id: string, data: Partial<Habit>) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "habits", id), data as Record<string, unknown>);
    toast.success("Habit updated");
  };

  const toggleToday = async (id: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit || !user) return;

    const completing = !habit.completions.includes(todayStr);
    const completions = completing
      ? [...habit.completions, todayStr]
      : habit.completions.filter((d) => d !== todayStr);

    await updateDoc(doc(db, "users", user.uid, "habits", id), { completions });

    if (completing) {
      const streak = calcStreak(habit.completions, todayStr);
      const newStreak = streak + 1;
      const mult = streakMultiplier(newStreak);
      const xp = habitXP(newStreak);
      await awardXP(user.uid, xp, "habit_complete", `Habit: ${habit.name}${mult > 1 ? ` (${mult}× streak)` : ""}`, totalXP);
      if (mult > 1) toast(`🔥 ${mult}× streak bonus!`, { duration: 2000 });
      await checkAndAward(user.uid, "creature_of_habit");
      if (newStreak >= 7)   await checkAndAward(user.uid, "week_one");
      if (newStreak >= 30)  await checkAndAward(user.uid, "the_long_game");
      if (newStreak >= 100) await checkAndAward(user.uid, "unbreakable");
      // Perfect day: all habits scheduled today are now completed
      const updatedCompletions = [...habit.completions, todayStr];
      const todayDow = new Date().getDay();
      const todayScheduled = habits
        .map((h) => (h.id === id ? { ...h, completions: updatedCompletions } : h))
        .filter((h) => h.target_days.includes(todayDow));
      if (todayScheduled.length > 0 && todayScheduled.every((h) => h.completions.includes(todayStr))) {
        await checkAndAward(user.uid, "perfect_day");
      }
    }
  };

  const deleteHabit = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "habits", id));
    toast.success("Habit deleted");
  };

  const setReminders = async (id: string, times: string[]) => {
    if (!user) return;
    // Request notification permission if setting reminders and not yet granted
    if (times.length > 0 && permission !== "granted") {
      await enable();
      if (Notification.permission !== "granted") {
        toast.error("Enable notifications in your browser to receive reminders");
        return;
      }
    }
    await updateDoc(doc(db, "users", user.uid, "habits", id), {
      reminder_enabled: times.length > 0,
      reminder_times: times,
      reminder_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (times.length > 0) {
      toast.success(`${times.length} reminder${times.length > 1 ? "s" : ""} saved`);
    } else {
      toast.success("Reminders cleared");
    }
  };

  const completedToday = habits.filter((h) => h.completions.includes(todayStr)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingDots />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Notification permission banner */}
      {permission === "default" && (
        <button
          onClick={enable}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent hover:bg-accent/15 transition-colors text-left"
        >
          <RiNotificationLine className="w-4 h-4 shrink-0" />
          <span className="flex-1">Enable notifications to receive habit reminders</span>
          <span className="text-xs opacity-70">Tap to allow →</span>
        </button>
      )}
      {permission === "denied" && (
        <div className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">
          <RiNotificationOffLine className="w-4 h-4 shrink-0" />
          Notifications blocked — enable them in your browser settings to receive reminders
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Habits</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {completedToday} / {habits.length} done today
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <RiAddLine className="w-4 h-4" /> New Habit
        </button>
      </div>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-500"
            style={{ width: `${(completedToday / habits.length) * 100}%` }}
          />
        </div>
      )}

      {/* Habits list */}
      {habits.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center group">
          <RiLoopLeftLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm mb-4">No habits yet.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            Add your first habit
          </button>
        </div>
      ) : (
        <div className="space-y-3 group">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              todayStr={todayStr}
              onToggle={toggleToday}
              onEdit={setEditingHabit}
              onDelete={deleteHabit}
              onSetReminders={setReminders}
            />
          ))}
        </div>
      )}

      {showForm && (
        <HabitForm onSave={addHabit} onClose={() => setShowForm(false)} />
      )}
      {editingHabit && (
        <HabitForm
          initial={editingHabit}
          onSave={(data) => updateHabit(editingHabit.id, data)}
          onClose={() => setEditingHabit(null)}
        />
      )}
    </div>
  );
}
