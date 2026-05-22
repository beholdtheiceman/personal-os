"use client";
import FocusTimer from "@/components/focus/FocusTimer";
import TimeLog from "@/components/time/TimeLog";

export default function FocusPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Focus</h1>
        <p className="text-text-secondary text-sm">Timed focus sessions. Completed sessions log automatically to Time Tracker.</p>
      </div>

      <div className="card">
        <FocusTimer />
      </div>

      <div className="card space-y-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Today's Time Log</p>
        <TimeLog />
      </div>
    </div>
  );
}
