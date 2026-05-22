"use client";
import { useState, useEffect } from "react";
import { RiPlayLine, RiPauseLine, RiStopLine, RiCheckLine } from "react-icons/ri";
import { useTimer } from "@/contexts/TimerContext";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import type { TimeCategory } from "@/types";

const DURATIONS = [25, 50, 90];

const CATEGORY_OPTIONS: { value: TimeCategory; label: string }[] = [
  { value: "work",     label: "Work" },
  { value: "learning", label: "Learning" },
  { value: "personal", label: "Personal" },
  { value: "health",   label: "Health" },
  { value: "other",    label: "Other" },
];

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// SVG countdown ring
function CountdownRing({ progress, status }: { progress: number; status: string }) {
  const R = 72;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - Math.max(0, Math.min(1, progress)));
  const color = status === "break" ? "#34d399" : status === "paused" ? "#fbbf24" : "#a78bfa";

  return (
    <svg width="180" height="180" className="-rotate-90">
      <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle
        cx="90" cy="90" r={R}
        fill="none" stroke={color} strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        className="transition-all duration-1000"
        style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
      />
    </svg>
  );
}

export default function FocusTimer() {
  const { status, taskName, durationMin, secondsRemaining, sessionsToday, start, pause, resume, stop } = useTimer();
  const { todayEntries } = useTimeTracker();

  const [inputTask, setInputTask] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [category, setCategory] = useState<TimeCategory>("work");

  // Update page title with countdown when running
  useEffect(() => {
    if (status === "running" || status === "break") {
      document.title = `${fmtTime(secondsRemaining)} — ${status === "break" ? "Break" : taskName}`;
    } else {
      document.title = "Focus — Personal OS";
    }
    return () => { document.title = "Personal OS"; };
  }, [status, secondsRemaining, taskName]);

  const totalDurationSec = durationMin * 60;
  const progress = totalDurationSec > 0 ? secondsRemaining / totalDurationSec : 1;

  const handleStart = () => {
    const task = inputTask.trim() || "Focus session";
    const dur = customDuration ? parseInt(customDuration) || selectedDuration : selectedDuration;
    start(task, dur, { category });
  };

  const todayFocusMin = todayEntries.filter((e) => e.source === "timer").reduce((s, e) => s + e.duration_min, 0);

  if (status === "idle") {
    return (
      <div className="space-y-6">
        {/* Stats */}
        {(sessionsToday > 0 || todayFocusMin > 0) && (
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-text-muted text-xs">Sessions today </span>
              <span className="font-semibold text-text-primary">{sessionsToday}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs">Focus time </span>
              <span className="font-semibold text-text-primary">{Math.round(todayFocusMin)}m</span>
            </div>
          </div>
        )}

        {/* Task input */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">What are you working on?</p>
          <input
            className="input-base w-full text-sm py-2 px-3"
            placeholder="Task or description…"
            value={inputTask}
            onChange={(e) => setInputTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
          />
        </div>

        {/* Duration picker */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Duration</p>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => { setSelectedDuration(d); setCustomDuration(""); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedDuration === d && !customDuration
                    ? "bg-accent/40 text-white"
                    : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
                }`}
              >
                {d}m
              </button>
            ))}
            <input
              type="number" min={1} max={240} placeholder="Custom"
              className="input-base w-24 text-sm py-2 px-3"
              value={customDuration}
              onChange={(e) => { setCustomDuration(e.target.value); }}
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Category</p>
          <div className="flex gap-2 flex-wrap">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === c.value
                    ? "bg-accent/40 text-white"
                    : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          className="w-full btn-primary text-sm py-3 flex items-center justify-center gap-2"
        >
          <RiPlayLine className="w-4 h-4" />
          Start focus session
        </button>
      </div>
    );
  }

  const isBreak = status === "break";

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Ring */}
      <div className="relative">
        <CountdownRing progress={progress} status={status} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-text-primary tracking-tight">
            {fmtTime(secondsRemaining)}
          </span>
          <span className="text-xs text-text-muted mt-1">
            {isBreak ? "break" : status === "paused" ? "paused" : "focus"}
          </span>
        </div>
      </div>

      {/* Task label */}
      {!isBreak && (
        <p className="text-sm font-medium text-text-secondary text-center">{taskName}</p>
      )}
      {isBreak && (
        <p className="text-sm font-medium text-success text-center">Great work! Take a break.</p>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        {!isBreak && status === "running" && (
          <button onClick={pause} className="w-12 h-12 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center transition-colors">
            <RiPauseLine className="w-5 h-5" />
          </button>
        )}
        {!isBreak && status === "paused" && (
          <button onClick={resume} className="w-12 h-12 rounded-full bg-accent/20 hover:bg-accent/30 text-accent flex items-center justify-center transition-colors">
            <RiPlayLine className="w-5 h-5" />
          </button>
        )}
        <button onClick={stop} className="w-12 h-12 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-colors">
          <RiStopLine className="w-5 h-5" />
        </button>
        {isBreak && (
          <button onClick={stop} className="w-12 h-12 rounded-full bg-success/20 hover:bg-success/30 text-success flex items-center justify-center transition-colors">
            <RiCheckLine className="w-5 h-5" />
          </button>
        )}
      </div>

      <p className="text-xs text-text-muted">Sessions today: {sessionsToday}</p>
    </div>
  );
}
