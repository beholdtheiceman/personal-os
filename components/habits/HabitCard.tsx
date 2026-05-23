"use client";
import { useState } from "react";
import { RiEditLine, RiDeleteBinLine, RiFireLine, RiNotificationLine, RiNotificationOffLine, RiBarChartLine } from "react-icons/ri";
import { format, subDays } from "date-fns";
import type { Habit } from "@/types";
import HabitStats from "./HabitStats";

const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

function calcStreak(completions: string[]): number {
  const set = new Set(completions);
  let streak = 0;
  let date = new Date();
  while (set.has(format(date, "yyyy-MM-dd"))) {
    streak++;
    date = subDays(date, 1);
  }
  return streak;
}

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { dateStr: format(d, "yyyy-MM-dd"), dayLabel: DAYS_SHORT[d.getDay()] };
  });
}

// Format "14:00" → "2:00 PM"
function fmt12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface HabitCardProps {
  habit: Habit;
  todayStr: string;
  onToggle: (id: string) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
  onSetReminders: (id: string, times: string[]) => void;
}

export default function HabitCard({ habit, todayStr, onToggle, onEdit, onDelete, onSetReminders }: HabitCardProps) {
  const completedToday = habit.completions.includes(todayStr);
  const streak = calcStreak(habit.completions);
  const week = last7Days();

  // Support both old single reminder_time and new reminder_times array
  const times: string[] = habit.reminder_times?.length
    ? habit.reminder_times
    : habit.reminder_time ? [habit.reminder_time] : [];
  const hasReminders = habit.reminder_enabled && times.length > 0;

  const [showPanel, setShowPanel] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [newTime, setNewTime] = useState("08:00");
  const [adding, setAdding] = useState(false);

  const addTime = () => {
    if (!newTime || times.includes(newTime)) { setAdding(false); return; }
    const sorted = [...times, newTime].sort();
    onSetReminders(habit.id, sorted);
    setAdding(false);
    setNewTime("08:00");
  };

  const removeTime = (t: string) => {
    const next = times.filter((x) => x !== t);
    onSetReminders(habit.id, next);
  };

  return (
    <div className={`card transition-all ${completedToday ? "border-success/30" : "hover:border-accent/30"}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(habit.id)}
          className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
            completedToday
              ? "bg-success border-success text-white"
              : "border-bg-border hover:border-success"
          }`}
        >
          {completedToday && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <span className={`text-sm font-medium ${completedToday ? "text-text-secondary line-through" : "text-text-primary"}`}>
              {habit.name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {streak > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-warning font-medium">
                  <RiFireLine className="w-3.5 h-3.5" />
                  {streak}
                </span>
              )}
              {/* Bell toggle */}
              <button
                onClick={() => setShowPanel((v) => !v)}
                className={`p-1 transition-colors ${hasReminders ? "text-accent" : "text-text-muted hover:text-accent opacity-0 group-hover:opacity-100"}`}
                title={hasReminders ? `${times.length} reminder${times.length > 1 ? "s" : ""}` : "Set reminders"}
              >
                {hasReminders ? <RiNotificationLine className="w-3.5 h-3.5" /> : <RiNotificationOffLine className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setShowStats((v) => !v)}
                className={`p-1 transition-colors ${showStats ? "text-accent" : "text-text-muted hover:text-accent opacity-0 group-hover:opacity-100"}`}
                title="Toggle stats"
              >
                <RiBarChartLine className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onEdit(habit)} className="p-1 text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                <RiEditLine className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(habit.id)} className="p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                <RiDeleteBinLine className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {habit.category && (
              <span className="text-[10px] text-text-muted">{habit.category}</span>
            )}
            {hasReminders && (
              <span className="text-[10px] text-accent flex items-center gap-0.5">
                <RiNotificationLine className="w-2.5 h-2.5" />
                {times.map(fmt12h).join(" · ")}
              </span>
            )}
          </div>

          {/* Reminders panel */}
          {showPanel && (
            <div className="mt-2 p-2.5 bg-bg-tertiary rounded-xl space-y-2">
              {/* Existing times */}
              {times.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {times.map((t) => (
                    <span key={t} className="flex items-center gap-1 text-[11px] bg-accent/10 text-accent rounded-lg px-2 py-0.5">
                      {fmt12h(t)}
                      <button onClick={() => removeTime(t)} className="hover:text-danger transition-colors leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add time row */}
              {adding ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="input-base text-sm py-1 px-2 flex-1"
                    autoFocus
                  />
                  <button onClick={addTime} className="btn-primary text-xs py-1 px-3">Add</button>
                  <button onClick={() => setAdding(false)} className="text-xs text-text-muted hover:text-text-primary px-1">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="text-[11px] text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
                >
                  + Add reminder time
                </button>
              )}
            </div>
          )}

          {/* 7-day grid */}
          <div className="flex gap-1 mt-2">
            {week.map(({ dateStr, dayLabel }) => {
              const done = habit.completions.includes(dateStr);
              const isToday = dateStr === todayStr;
              return (
                <div key={dateStr} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`w-5 h-5 rounded-md ${
                      done
                        ? "bg-success"
                        : isToday
                        ? "bg-bg-tertiary border-2 border-dashed border-bg-border"
                        : "bg-bg-tertiary"
                    }`}
                  />
                  <span className={`text-[9px] ${isToday ? "text-accent" : "text-text-muted"}`}>
                    {dayLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stats panel */}
          {showStats && (
            <HabitStats
              completions={habit.completions}
              targetDays={habit.target_days ?? [0, 1, 2, 3, 4, 5, 6]}
              todayStr={todayStr}
            />
          )}
        </div>
      </div>
    </div>
  );
}
