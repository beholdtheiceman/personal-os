"use client";
import { useState } from "react";
import { RiEditLine, RiDeleteBinLine, RiFireLine, RiNotificationLine, RiNotificationOffLine } from "react-icons/ri";
import { format, subDays } from "date-fns";
import type { Habit } from "@/types";

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
  onSetReminder: (id: string, time: string | null) => void;
}

export default function HabitCard({ habit, todayStr, onToggle, onEdit, onDelete, onSetReminder }: HabitCardProps) {
  const completedToday = habit.completions.includes(todayStr);
  const streak = calcStreak(habit.completions);
  const week = last7Days();
  const hasReminder = habit.reminder_enabled && habit.reminder_time;

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerTime, setPickerTime] = useState(habit.reminder_time ?? "08:00");

  const handleSave = () => {
    onSetReminder(habit.id, pickerTime);
    setShowTimePicker(false);
  };

  const handleClear = () => {
    onSetReminder(habit.id, null);
    setShowTimePicker(false);
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
              {/* Bell / reminder toggle */}
              <button
                onClick={() => setShowTimePicker((v) => !v)}
                className={`p-1 transition-colors ${hasReminder ? "text-accent" : "text-text-muted hover:text-accent opacity-0 group-hover:opacity-100"}`}
                title={hasReminder ? `Reminder at ${fmt12h(habit.reminder_time!)}` : "Set reminder"}
              >
                {hasReminder
                  ? <RiNotificationLine className="w-3.5 h-3.5" />
                  : <RiNotificationOffLine className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => onEdit(habit)} className="p-1 text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                <RiEditLine className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(habit.id)} className="p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                <RiDeleteBinLine className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {habit.category && (
              <span className="text-[10px] text-text-muted">{habit.category}</span>
            )}
            {hasReminder && (
              <span className="text-[10px] text-accent flex items-center gap-0.5">
                <RiNotificationLine className="w-2.5 h-2.5" />
                {fmt12h(habit.reminder_time!)}
              </span>
            )}
          </div>

          {/* Inline time picker */}
          {showTimePicker && (
            <div className="mt-2 flex items-center gap-2 p-2 bg-bg-tertiary rounded-xl">
              <input
                type="time"
                value={pickerTime}
                onChange={(e) => setPickerTime(e.target.value)}
                className="input-base text-sm py-1 px-2 flex-1"
              />
              <button onClick={handleSave} className="btn-primary text-xs py-1 px-3">
                Save
              </button>
              {hasReminder && (
                <button onClick={handleClear} className="text-xs py-1 px-2 text-danger hover:bg-danger/10 rounded-lg transition-colors">
                  Clear
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
        </div>
      </div>
    </div>
  );
}
