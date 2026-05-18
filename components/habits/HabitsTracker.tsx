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
import { RiAddLine, RiLoopLeftLine } from "react-icons/ri";
import { format } from "date-fns";
import { useToday } from "@/hooks/useToday";
import toast from "react-hot-toast";
import type { Habit } from "@/types";

export default function HabitsTracker() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const todayStr = useToday();

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

    const completions = habit.completions.includes(todayStr)
      ? habit.completions.filter((d) => d !== todayStr)
      : [...habit.completions, todayStr];

    await updateDoc(doc(db, "users", user.uid, "habits", id), { completions });
  };

  const deleteHabit = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "habits", id));
    toast.success("Habit deleted");
  };

  const setReminder = async (id: string, time: string | null) => {
    if (!user) return;
    if (time) {
      await updateDoc(doc(db, "users", user.uid, "habits", id), {
        reminder_enabled: true,
        reminder_time: time,
        reminder_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      toast.success(`Reminder set for ${time}`);
    } else {
      await updateDoc(doc(db, "users", user.uid, "habits", id), {
        reminder_enabled: false,
        reminder_time: null,
      });
      toast.success("Reminder cleared");
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
              onSetReminder={setReminder}
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
