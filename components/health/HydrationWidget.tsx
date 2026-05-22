"use client";
import { useState } from "react";
import { RiDropLine, RiCheckLine } from "react-icons/ri";
import { useHydration } from "@/hooks/useHydration";
import { format, parseISO } from "date-fns";

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HydrationWidget() {
  const { glasses, goal, logs, loading, increment, setGoal } = useHydration();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  if (loading) return null;

  const progress = Math.min(glasses / goal, 1);
  const offset = CIRCUMFERENCE * (1 - progress);
  const goalMet = glasses >= goal;

  const handleGoalSave = async () => {
    const n = parseInt(goalInput, 10);
    if (!isNaN(n) && n > 0) await setGoal(n);
    setEditingGoal(false);
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiDropLine className="w-4 h-4 text-info" />
          <h3 className="text-sm font-semibold text-text-primary">Hydration</h3>
        </div>
        {!editingGoal ? (
          <button
            onClick={() => { setGoalInput(String(goal)); setEditingGoal(true); }}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Goal: {goal} glasses
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={20}
              className="input-base w-16 text-xs py-1 px-2"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGoalSave(); if (e.key === "Escape") setEditingGoal(false); }}
              autoFocus
            />
            <button onClick={handleGoalSave} className="text-xs text-accent hover:text-accent-text px-1">Save</button>
          </div>
        )}
      </div>

      {/* Ring + button */}
      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width="96" height="96" className="-rotate-90">
            <circle
              cx="48" cy="48" r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-bg-tertiary"
            />
            <circle
              cx="48" cy="48" r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className={goalMet ? "text-success transition-all duration-500" : "text-info transition-all duration-500"}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {goalMet
              ? <RiCheckLine className="w-6 h-6 text-success" />
              : <span className="text-xl font-bold text-text-primary">{glasses}</span>
            }
            <span className="text-[10px] text-text-muted">/ {goal}</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <button
            onClick={increment}
            disabled={goalMet}
            className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RiDropLine className="w-4 h-4" />
            {goalMet ? "Goal reached!" : "+ Add glass"}
          </button>

          {/* Glass indicators */}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: goal }).map((_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border transition-colors ${
                  i < glasses
                    ? "bg-info/80 border-info"
                    : "bg-bg-tertiary border-bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Log timestamps */}
      {logs.length > 0 && (
        <div className="border-t border-bg-border pt-3 space-y-1">
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Today's log</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[...logs].reverse().map((ts, i) => (
              <span key={i} className="text-xs text-text-secondary">
                {format(parseISO(ts), "h:mm a")}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
