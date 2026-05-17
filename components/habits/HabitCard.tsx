"use client";
import { RiEditLine, RiDeleteBinLine, RiFireLine } from "react-icons/ri";
import { format, subDays } from "date-fns";
import type { Habit } from "@/types";

const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

// Count consecutive completed days ending today
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

// Build last 7 days for the weekly grid
function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { dateStr: format(d, "yyyy-MM-dd"), dayLabel: DAYS_SHORT[d.getDay()] };
  });
}

interface HabitCardProps {
  habit: Habit;
  todayStr: string;
  onToggle: (id: string) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
}

export default function HabitCard({ habit, todayStr, onToggle, onEdit, onDelete }: HabitCardProps) {
  const completedToday = habit.completions.includes(todayStr);
  const streak = calcStreak(habit.completions);
  const week = last7Days();

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
              <button onClick={() => onEdit(habit)} className="p-1 text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                <RiEditLine className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(habit.id)} className="p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                <RiDeleteBinLine className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {habit.category && (
            <span className="text-[10px] text-text-muted">{habit.category}</span>
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
